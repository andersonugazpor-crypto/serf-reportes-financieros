import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracionCorporativa } from '../../configuracion/configuracion-corporativa';
import { CONFIGURACION } from '../../comun/tokens';
import { FilialesService } from '../../filiales/filiales.service';
import { InventarioService } from '../../inventario/inventario.service';
import { Categoria, ETIQUETA_CATEGORIA } from '../../productos/producto';
import { ProductosService } from '../../productos/productos.service';
import { VentasService } from '../../ventas/ventas.service';
import { DatosConsolidados, ResumenCategoria, ResumenFilial, ResumenProducto } from './datos-consolidados';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Consolida ventas e inventarios de varias filiales en la moneda corporativa.
 * Responsabilidad única: calcular cifras. No sabe nada de formatos de reporte.
 */
@Injectable()
export class ConsolidacionService {
  constructor(
    @Inject(CONFIGURACION) private readonly config: ConfiguracionCorporativa,
    private readonly filiales: FilialesService,
    private readonly productos: ProductosService,
    private readonly ventas: VentasService,
    private readonly inventario: InventarioService,
  ) {}

  consolidar(desde: string, hasta: string, codigos: string[]): DatosConsolidados {
    const filiales = this.filiales.validarCodigos(codigos);
    const moneda = this.config.monedaConsolidacion;
    const tasaUsd = this.config.tasaHaciaConsolidacion('USD');
    const ventas = this.ventas.listar({ filiales: filiales.map((f) => f.codigo), desde, hasta });

    const porFilial = new Map<string, ResumenFilial>(
      filiales.map((f) => [
        f.codigo,
        { codigo: f.codigo, nombre: f.nombre, monedaLocal: f.moneda, ingresosLocal: 0, ingresos: 0, costo: 0, margen: 0, margenPct: 0, unidades: 0, transacciones: 0 },
      ]),
    );
    const porCategoria = new Map<Categoria, ResumenCategoria>();
    const porMes = new Map<string, { periodo: string; ingresos: number; unidades: number }>();
    const porProducto = new Map<string, ResumenProducto>();

    for (const v of ventas) {
      const producto = this.productos.obtener(v.sku);
      const ingreso = v.total.monto * this.config.tasaHaciaConsolidacion(v.precioUnitario.moneda);
      const costo = producto.costoImportacion.monto * tasaUsd * v.cantidad;

      const f = porFilial.get(v.filialCodigo)!;
      f.ingresosLocal += v.total.monto;
      f.ingresos += ingreso;
      f.costo += costo;
      f.unidades += v.cantidad;
      f.transacciones++;

      const c = porCategoria.get(producto.categoria) ?? {
        categoria: producto.categoria,
        etiqueta: ETIQUETA_CATEGORIA[producto.categoria],
        ingresos: 0,
        costo: 0,
        margen: 0,
        unidades: 0,
      };
      c.ingresos += ingreso;
      c.costo += costo;
      c.unidades += v.cantidad;
      porCategoria.set(producto.categoria, c);

      const mes = porMes.get(v.periodo) ?? { periodo: v.periodo, ingresos: 0, unidades: 0 };
      mes.ingresos += ingreso;
      mes.unidades += v.cantidad;
      porMes.set(v.periodo, mes);

      const p = porProducto.get(v.sku) ?? { sku: v.sku, nombre: producto.nombre, categoria: producto.categoria, unidades: 0, ingresos: 0, margen: 0, margenPct: 0 };
      p.unidades += v.cantidad;
      p.ingresos += ingreso;
      p.margen += ingreso - costo;
      porProducto.set(v.sku, p);
    }

    const resumenFiliales = [...porFilial.values()].map((f) => {
      const margen = f.ingresos - f.costo;
      return { ...f, ingresosLocal: r2(f.ingresosLocal), ingresos: r2(f.ingresos), costo: r2(f.costo), margen: r2(margen), margenPct: f.ingresos ? margen / f.ingresos : 0 };
    });
    const ingresos = resumenFiliales.reduce((s, f) => s + f.ingresos, 0);
    const costo = resumenFiliales.reduce((s, f) => s + f.costo, 0);
    const unidades = resumenFiliales.reduce((s, f) => s + f.unidades, 0);
    const transacciones = resumenFiliales.reduce((s, f) => s + f.transacciones, 0);

    // Inventario actual (foto al momento de generar).
    const minimo = this.config.stockMinimo;
    const stocks = this.inventario.listarStocks(filiales.map((f) => f.codigo));
    const inventarioFiliales = filiales.map((f) => {
      const propios = stocks.filter((s) => s.filialCodigo === f.codigo);
      return {
        codigo: f.codigo,
        nombre: f.nombre,
        unidades: propios.reduce((s, x) => s + x.cantidad, 0),
        valorizado: r2(propios.reduce((s, x) => s + x.cantidad * this.productos.obtener(x.sku).costoImportacion.monto * tasaUsd, 0)),
        productosCriticos: propios.filter((x) => x.esCritico(minimo)).length,
      };
    });
    const criticos = stocks
      .filter((s) => s.esCritico(minimo))
      .map((s) => ({ filial: s.filialCodigo, sku: s.sku, nombre: this.productos.obtener(s.sku).nombre, cantidad: s.cantidad }))
      .sort((a, b) => a.cantidad - b.cantidad);

    const alertas: string[] = [];
    resumenFiliales
      .filter((f) => f.transacciones > 0 && f.margenPct < this.config.margenObjetivo)
      .forEach((f) => alertas.push(`${f.nombre}: margen de ${(f.margenPct * 100).toFixed(1)} %, por debajo del objetivo corporativo.`));
    resumenFiliales.filter((f) => f.transacciones === 0).forEach((f) => alertas.push(`${f.nombre}: no registró ventas en el periodo.`));
    if (criticos.length) alertas.push(`${criticos.length} combinación(es) filial/producto con stock crítico.`);

    return {
      periodo: { desde, hasta },
      moneda,
      filiales: filiales.map((f) => ({ codigo: f.codigo, nombre: f.nombre })),
      totales: {
        ingresos: r2(ingresos),
        costo: r2(costo),
        margen: r2(ingresos - costo),
        margenPct: ingresos ? (ingresos - costo) / ingresos : 0,
        unidades,
        transacciones,
        ticketPromedio: transacciones ? r2(ingresos / transacciones) : 0,
      },
      porFilial: resumenFiliales.sort((a, b) => b.ingresos - a.ingresos),
      porCategoria: [...porCategoria.values()]
        .map((c) => ({ ...c, ingresos: r2(c.ingresos), costo: r2(c.costo), margen: r2(c.ingresos - c.costo) }))
        .sort((a, b) => b.ingresos - a.ingresos),
      porMes: [...porMes.values()].map((m) => ({ ...m, ingresos: r2(m.ingresos) })).sort((a, b) => a.periodo.localeCompare(b.periodo)),
      productos: [...porProducto.values()].map((p) => ({ ...p, ingresos: r2(p.ingresos), margen: r2(p.margen), margenPct: p.ingresos ? p.margen / p.ingresos : 0 })),
      inventario: {
        porFilial: inventarioFiliales,
        criticos,
        unidadesTotales: inventarioFiliales.reduce((s, f) => s + f.unidades, 0),
        valorTotal: r2(inventarioFiliales.reduce((s, f) => s + f.valorizado, 0)),
        stockMinimo: minimo,
      },
      margenObjetivo: this.config.margenObjetivo,
      alertas,
    };
  }
}
