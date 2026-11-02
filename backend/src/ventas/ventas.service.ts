import { Inject, Injectable } from '@nestjs/common';
import { Dinero } from '../comun/dinero';
import { ErrorConflicto, ErrorValidacion } from '../comun/errores';
import { REGISTRO_ADAPTADORES, REPO_VENTAS } from '../comun/tokens';
import { RegistroAdaptadores } from '../filiales/adaptadores/registro-adaptadores';
import { LoteNormalizado } from '../filiales/adaptadores/lote-normalizado';
import { FilialesService } from '../filiales/filiales.service';
import { Repositorio } from '../infraestructura/persistencia/repositorio';
import { InventarioService } from '../inventario/inventario.service';
import { ProductosService } from '../productos/productos.service';
import { Venta } from './venta';

export interface FiltroVentas {
  filiales?: string[];
  sku?: string;
  desde?: string;
  hasta?: string;
}

export interface ResultadoImportacion {
  filial: string;
  formato: string;
  ventasImportadas: number;
  ventasDuplicadas: number;
  stocksActualizados: number;
  advertencias: string[];
}

@Injectable()
export class VentasService {
  constructor(
    @Inject(REPO_VENTAS) private readonly repo: Repositorio<Venta>,
    @Inject(REGISTRO_ADAPTADORES) private readonly adaptadores: RegistroAdaptadores,
    private readonly filiales: FilialesService,
    private readonly productos: ProductosService,
    private readonly inventario: InventarioService,
  ) {}

  listar(filtro: FiltroVentas = {}): Venta[] {
    const desde = filtro.desde ? new Date(`${filtro.desde}T00:00:00Z`) : null;
    const hasta = filtro.hasta ? new Date(`${filtro.hasta}T23:59:59Z`) : null;
    return this.repo
      .listar(
        (v) =>
          (!filtro.filiales || filtro.filiales.includes(v.filialCodigo)) &&
          (!filtro.sku || v.sku === filtro.sku.toUpperCase()) &&
          (!desde || v.fecha >= desde) &&
          (!hasta || v.fecha <= hasta),
      )
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /** Venta registrada en mostrador: valida filial, producto y descuenta stock. */
  registrar(datos: {
    filialCodigo: string;
    sku: string;
    cantidad: number;
    precioUnitario: number;
    fecha?: string;
  }): Venta {
    const filial = this.filiales.obtenerActiva(datos.filialCodigo);
    const producto = this.productos.obtener(datos.sku);
    if (!producto.activo) throw new ErrorConflicto(`El producto ${producto.sku} está descontinuado.`);
    const venta = new Venta({
      fecha: datos.fecha ? new Date(`${datos.fecha}T12:00:00Z`) : new Date(),
      filialCodigo: filial.codigo,
      sku: producto.sku,
      cantidad: datos.cantidad,
      precioUnitario: Dinero.de(datos.precioUnitario, filial.moneda),
      origen: 'MANUAL',
    });
    this.inventario.retirar(filial.codigo, producto.sku, venta.cantidad);
    return this.repo.guardar(venta);
  }

  /** Previsualiza un archivo de la filial pasando por su adaptador (no guarda nada). */
  previsualizar(filialCodigo: string, contenido: string): LoteNormalizado & { skusDesconocidos: string[] } {
    const filial = this.filiales.obtenerActiva(filialCodigo);
    const lote = this.adaptadores.obtener(filial.formatoDatos).adaptar(contenido, filial.moneda);
    const skus = new Set([...lote.ventas.map((v) => v.sku), ...lote.inventario.map((s) => s.sku)]);
    return { ...lote, skusDesconocidos: [...skus].filter((s) => !this.productos.existe(s)) };
  }

  /**
   * Integración de datos (requisito 1): el adaptador de la filial normaliza el archivo
   * y aquí se guardan las ventas (sin duplicar referencias) y se actualiza el inventario.
   */
  importar(filialCodigo: string, contenido: string): ResultadoImportacion {
    const filial = this.filiales.obtenerActiva(filialCodigo);
    const lote = this.previsualizar(filial.codigo, contenido);
    if (!lote.ventas.length && !lote.inventario.length) {
      throw new ErrorValidacion('El archivo no contiene ventas ni existencias válidas.');
    }
    const advertencias = [...lote.advertencias];
    const referencias = new Set(
      this.repo.listar((v) => v.filialCodigo === filial.codigo).map((v) => v.referenciaExterna),
    );
    let importadas = 0;
    let duplicadas = 0;

    for (const v of lote.ventas) {
      if (lote.skusDesconocidos.includes(v.sku)) {
        advertencias.push(`Venta ${v.referencia}: el SKU ${v.sku} no está registrado.`);
        continue;
      }
      if (referencias.has(v.referencia)) {
        duplicadas++;
        continue;
      }
      try {
        this.repo.guardar(
          new Venta({
            fecha: v.fecha,
            filialCodigo: filial.codigo,
            sku: v.sku,
            cantidad: v.cantidad,
            precioUnitario: Dinero.de(v.precioUnitario, v.moneda),
            origen: 'IMPORTACION',
            referenciaExterna: v.referencia,
          }),
        );
        referencias.add(v.referencia);
        importadas++;
      } catch (e) {
        advertencias.push(`Venta ${v.referencia}: ${(e as Error).message}`);
      }
    }

    let stocks = 0;
    for (const s of lote.inventario) {
      if (lote.skusDesconocidos.includes(s.sku)) {
        advertencias.push(`Existencia: el SKU ${s.sku} no está registrado.`);
        continue;
      }
      this.inventario.fijar(filial.codigo, s.sku, s.cantidad);
      stocks++;
    }

    return {
      filial: filial.codigo,
      formato: filial.formatoDatos,
      ventasImportadas: importadas,
      ventasDuplicadas: duplicadas,
      stocksActualizados: stocks,
      advertencias,
    };
  }
}
