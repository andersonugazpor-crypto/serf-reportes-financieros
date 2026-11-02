import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracionCorporativa } from '../configuracion/configuracion-corporativa';
import { CONFIGURACION, REPO_STOCK } from '../comun/tokens';
import { FilialesService } from '../filiales/filiales.service';
import { Repositorio } from '../infraestructura/persistencia/repositorio';
import { ProductosService } from '../productos/productos.service';
import { Stock } from './stock';

export interface FilaInventario {
  filialCodigo: string;
  filialNombre: string;
  sku: string;
  producto: string;
  categoria: string;
  cantidad: number;
  critico: boolean;
  valorCostoEur: number;
  actualizadoEn: string;
}

@Injectable()
export class InventarioService {
  constructor(
    @Inject(REPO_STOCK) private readonly repo: Repositorio<Stock>,
    @Inject(CONFIGURACION) private readonly config: ConfiguracionCorporativa,
    private readonly filiales: FilialesService,
    private readonly productos: ProductosService,
  ) {}

  obtenerOCrear(filialCodigo: string, sku: string): Stock {
    return this.repo.buscarPorId(Stock.clave(filialCodigo, sku)) ?? new Stock(filialCodigo, sku);
  }

  cantidad(filialCodigo: string, sku: string): number {
    return this.repo.buscarPorId(Stock.clave(filialCodigo, sku))?.cantidad ?? 0;
  }

  /** Recepción de un lote importado desde China en una filial. */
  ingresar(filialCodigo: string, sku: string, unidades: number): Stock {
    this.filiales.obtenerActiva(filialCodigo);
    this.productos.obtener(sku);
    const stock = this.obtenerOCrear(filialCodigo, sku.toUpperCase());
    stock.ingresar(unidades);
    return this.repo.guardar(stock);
  }

  retirar(filialCodigo: string, sku: string, unidades: number): Stock {
    const stock = this.obtenerOCrear(filialCodigo, sku);
    stock.retirar(unidades);
    return this.repo.guardar(stock);
  }

  fijar(filialCodigo: string, sku: string, cantidad: number): Stock {
    const stock = this.obtenerOCrear(filialCodigo, sku);
    stock.fijar(cantidad);
    return this.repo.guardar(stock);
  }

  listarStocks(filiales?: string[]): Stock[] {
    return this.repo.listar((s) => !filiales || filiales.includes(s.filialCodigo));
  }

  /** Vista detallada para la interfaz, con valorización a costo en EUR. */
  detalle(filiales?: string[]): FilaInventario[] {
    const tasaUsd = this.config.tasaHaciaConsolidacion('USD');
    return this.listarStocks(filiales)
      .map((s) => {
        const producto = this.productos.obtener(s.sku);
        const filial = this.filiales.obtener(s.filialCodigo);
        return {
          filialCodigo: s.filialCodigo,
          filialNombre: filial.nombre,
          sku: s.sku,
          producto: producto.nombre,
          categoria: producto.categoria,
          cantidad: s.cantidad,
          critico: s.esCritico(this.config.stockMinimo),
          valorCostoEur: Math.round(producto.costoImportacion.monto * tasaUsd * s.cantidad * 100) / 100,
          actualizadoEn: s.actualizadoEn.toISOString(),
        };
      })
      .sort((a, b) => a.filialNombre.localeCompare(b.filialNombre) || a.sku.localeCompare(b.sku));
  }
}
