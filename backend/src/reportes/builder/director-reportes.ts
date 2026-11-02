import { DatosConsolidados } from '../consolidacion/datos-consolidados';
import { Reporte } from '../decorator/reporte';
import { TipoReporte } from '../prototype/plantilla-reporte';
import { ReporteBuilder, SeccionBuilder } from './reporte-builder';

const pct = (n: number) => Math.round(n * 1000) / 10;

/**
 * PATRÓN BUILDER — Director.
 *
 * Conoce la "receta" (orden de pasos) de cada tipo de reporte estandarizado y
 * se la aplica a un ReporteBuilder. Así, distintos reportes reutilizan el mismo
 * proceso de construcción y todos los reportes de un tipo salen con el mismo formato.
 */
export class DirectorReportes {
  private readonly recetas: Record<TipoReporte, (b: ReporteBuilder, d: DatosConsolidados) => void> = {
    VENTAS: (b, d) => this.recetaVentas(b, d, ''),
    INVENTARIO: (b, d) => this.recetaInventario(b, d, ''),
    RENTABILIDAD: (b, d) => this.recetaRentabilidad(b, d, ''),
    EJECUTIVO: (b, d) => {
      this.recetaVentas(b, d, 'ventas');
      this.recetaRentabilidad(b, d, 'rentabilidad');
      this.recetaInventario(b, d, 'inventario');
    },
  };

  construir(tipo: TipoReporte, builder: ReporteBuilder, datos: DatosConsolidados, titulo: string): Reporte {
    builder
      .conTitulo(titulo)
      .paraPeriodo(datos.periodo.desde, datos.periodo.hasta)
      .deFiliales(datos.filiales.map((f) => f.codigo))
      .enMoneda(datos.moneda);
    this.resumen(builder, datos, tipo);
    this.recetas[tipo](builder, datos);
    this.notas(builder, datos);
    return builder.construir();
  }

  private resumen(b: ReporteBuilder, d: DatosConsolidados, tipo: TipoReporte): void {
    const m = d.moneda;
    b.seccion('resumen', (s) => {
      s.parrafo(`Filiales incluidas: ${d.filiales.map((f) => f.nombre).join(', ')}.`);
      if (tipo !== 'INVENTARIO') {
        s.indicador('Ingresos', d.totales.ingresos, 'moneda', { moneda: m })
          .indicador('Margen bruto', d.totales.margen, 'moneda', { moneda: m })
          .indicador('Margen %', pct(d.totales.margenPct), 'porcentaje', {
            alerta: d.totales.margenPct < d.margenObjetivo,
            detalle: `Objetivo corporativo: ${pct(d.margenObjetivo)} %`,
          })
          .indicador('Unidades vendidas', d.totales.unidades, 'numero');
      }
      if (tipo === 'INVENTARIO' || tipo === 'EJECUTIVO') {
        s.indicador('Valor del inventario', d.inventario.valorTotal, 'moneda', { moneda: m })
          .indicador('Unidades en stock', d.inventario.unidadesTotales, 'numero')
          .indicador('Productos críticos', d.inventario.criticos.length, 'numero', {
            alerta: d.inventario.criticos.length > 0,
            detalle: `Stock mínimo: ${d.inventario.stockMinimo} u.`,
          });
      }
    });
  }

  /** `prefijo` vacío = usar las secciones propias de la plantilla de ventas. */
  private recetaVentas(b: ReporteBuilder, d: DatosConsolidados, prefijo: string): void {
    const destino = (clave: string, f: (s: SeccionBuilder) => void) =>
      prefijo ? b.seccion(prefijo, (s) => s.subseccion(TITULOS[clave], f)) : b.seccion(clave, f);

    destino('ventas-filial', (s) =>
      s
        .tabla(
          'Ventas por filial',
          [
            { titulo: 'Filial', formato: 'texto' },
            { titulo: 'Moneda local', formato: 'texto' },
            { titulo: 'Ingresos (moneda local)', formato: 'numero' },
            { titulo: `Ingresos (${d.moneda})`, formato: 'moneda' },
            { titulo: 'Unidades', formato: 'numero' },
            { titulo: 'Transacciones', formato: 'numero' },
          ],
          d.porFilial.map((f) => [f.nombre, f.monedaLocal, f.ingresosLocal, f.ingresos, f.unidades, f.transacciones]),
          ['Total', '', '', d.totales.ingresos, d.totales.unidades, d.totales.transacciones],
        )
        .grafico('Participación por filial', 'torta', d.porFilial.map((f) => ({ etiqueta: f.nombre, valor: f.ingresos })), d.moneda),
    );
    destino('ventas-categoria', (s) =>
      s
        .grafico('Ingresos por categoría', 'barras', d.porCategoria.map((c) => ({ etiqueta: c.etiqueta, valor: c.ingresos })), d.moneda)
        .tabla(
          'Detalle por categoría',
          [
            { titulo: 'Categoría', formato: 'texto' },
            { titulo: 'Unidades', formato: 'numero' },
            { titulo: 'Ingresos', formato: 'moneda' },
          ],
          d.porCategoria.map((c) => [c.etiqueta, c.unidades, c.ingresos]),
        ),
    );
    destino('ventas-tendencia', (s) => {
      s.grafico('Ingresos por mes', 'linea', d.porMes.map((p) => ({ etiqueta: p.periodo, valor: p.ingresos })), d.moneda);
      if (d.productos.length) {
        s.subseccion('Productos más vendidos', (sub) =>
          sub.tabla(
            'Top 5 por unidades',
            [
              { titulo: 'SKU', formato: 'texto' },
              { titulo: 'Producto', formato: 'texto' },
              { titulo: 'Unidades', formato: 'numero' },
              { titulo: 'Ingresos', formato: 'moneda' },
            ],
            [...d.productos].sort((a, z) => z.unidades - a.unidades).slice(0, 5).map((p) => [p.sku, p.nombre, p.unidades, p.ingresos]),
          ),
        );
      }
    });
  }

  private recetaRentabilidad(b: ReporteBuilder, d: DatosConsolidados, prefijo: string): void {
    const destino = (clave: string, f: (s: SeccionBuilder) => void) =>
      prefijo ? b.seccion(prefijo, (s) => s.subseccion(TITULOS[clave], f)) : b.seccion(clave, f);

    destino('margen-filial', (s) =>
      s
        .tabla(
          'Margen bruto por filial',
          [
            { titulo: 'Filial', formato: 'texto' },
            { titulo: 'Ingresos', formato: 'moneda' },
            { titulo: 'Costo de importación', formato: 'moneda' },
            { titulo: 'Margen bruto', formato: 'moneda' },
            { titulo: 'Margen %', formato: 'porcentaje' },
          ],
          d.porFilial.map((f) => [f.nombre, f.ingresos, f.costo, f.margen, pct(f.margenPct)]),
          ['Total', d.totales.ingresos, d.totales.costo, d.totales.margen, pct(d.totales.margenPct)],
        )
        .grafico('Margen % por filial', 'barras', d.porFilial.map((f) => ({ etiqueta: f.nombre, valor: pct(f.margenPct) })), '%'),
    );
    destino('margen-producto', (s) => {
      const ordenados = [...d.productos].sort((a, z) => z.margen - a.margen);
      s.tabla(
        'Productos por margen bruto',
        [
          { titulo: 'SKU', formato: 'texto' },
          { titulo: 'Producto', formato: 'texto' },
          { titulo: 'Margen bruto', formato: 'moneda' },
          { titulo: 'Margen %', formato: 'porcentaje' },
        ],
        ordenados.slice(0, 8).map((p) => [p.sku, p.nombre, p.margen, pct(p.margenPct)]),
      );
      const bajos = ordenados.filter((p) => p.margenPct < d.margenObjetivo);
      if (bajos.length) {
        s.subseccion('Por debajo del margen objetivo', (sub) =>
          sub.parrafo(`${bajos.length} producto(s) no alcanzan el ${pct(d.margenObjetivo)} %: ${bajos.map((p) => p.sku).join(', ')}.`, 'alerta'),
        );
      }
    });
  }

  private recetaInventario(b: ReporteBuilder, d: DatosConsolidados, prefijo: string): void {
    const destino = (clave: string, f: (s: SeccionBuilder) => void) =>
      prefijo ? b.seccion(prefijo, (s) => s.subseccion(TITULOS[clave], f)) : b.seccion(clave, f);

    destino('inventario-filial', (s) =>
      s
        .tabla(
          'Existencias por filial',
          [
            { titulo: 'Filial', formato: 'texto' },
            { titulo: 'Unidades', formato: 'numero' },
            { titulo: `Valor a costo (${d.moneda})`, formato: 'moneda' },
            { titulo: 'Productos críticos', formato: 'numero' },
          ],
          d.inventario.porFilial.map((f) => [f.nombre, f.unidades, f.valorizado, f.productosCriticos]),
          ['Total', d.inventario.unidadesTotales, d.inventario.valorTotal, d.inventario.criticos.length],
        )
        .grafico('Valor del inventario por filial', 'barras', d.inventario.porFilial.map((f) => ({ etiqueta: f.nombre, valor: f.valorizado })), d.moneda),
    );
    destino('inventario-criticos', (s) => {
      if (!d.inventario.criticos.length) {
        s.parrafo('No hay productos por debajo del stock mínimo.');
        return;
      }
      s.parrafo(`Productos con menos de ${d.inventario.stockMinimo} unidades: requieren nueva importación.`, 'alerta').tabla(
        'Stock crítico',
        [
          { titulo: 'Filial', formato: 'texto' },
          { titulo: 'SKU', formato: 'texto' },
          { titulo: 'Producto', formato: 'texto' },
          { titulo: 'Unidades', formato: 'numero' },
        ],
        d.inventario.criticos.map((c) => [c.filial, c.sku, c.nombre, c.cantidad]),
      );
    });
  }

  private notas(b: ReporteBuilder, d: DatosConsolidados): void {
    b.seccion('notas', (s) => {
      d.alertas.forEach((a) => s.parrafo(a, 'alerta'));
      s.parrafo(
        `Conversión a ${d.moneda} con las tasas de referencia de la configuración corporativa. El costo de importación se registra en USD.`,
        'nota',
      );
    });
  }
}

const TITULOS: Record<string, string> = {
  'ventas-filial': 'Ventas por filial',
  'ventas-categoria': 'Ventas por categoría',
  'ventas-tendencia': 'Tendencia mensual',
  'margen-filial': 'Margen bruto por filial',
  'margen-producto': 'Productos más rentables',
  'inventario-filial': 'Existencias por filial',
  'inventario-criticos': 'Productos con stock crítico',
};
