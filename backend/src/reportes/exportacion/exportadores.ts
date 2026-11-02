import { ErrorValidacion } from '../../comun/errores';
import { Celda, ColumnaTabla, NodoGrafico, NodoReporte } from '../composite/nodo-reporte';
import { DocumentoReporte } from '../decorator/reporte';

export type FormatoExportacion = 'HTML' | 'CSV' | 'JSON';

export interface ArchivoExportado {
  nombre: string;
  tipoMime: string;
  contenido: string;
}

/** Contrato de los exportadores (ISP: una sola responsabilidad, exportar). */
export interface Exportador {
  readonly formato: FormatoExportacion;
  exportar(documento: DocumentoReporte): ArchivoExportado;
}

const escaparHtml = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function nombreArchivo(doc: DocumentoReporte, extension: string): string {
  const base = `${doc.metadatos.tipo}-${doc.metadatos.ambito}-${doc.metadatos.periodo.desde}_${doc.metadatos.periodo.hasta}`;
  return `SERF-${base}.${extension}`.toLowerCase();
}

/** HTML autocontenido con estilos de impresión: el formato estandarizado para enviar. */
export class ExportadorHtml implements Exportador {
  readonly formato = 'HTML' as const;

  exportar(doc: DocumentoReporte): ArchivoExportado {
    const m = doc.metadatos;
    const fmtMoneda = new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.moneda, maximumFractionDigits: 0 });
    const fmtNumero = new Intl.NumberFormat(m.locale, { maximumFractionDigits: 2 });
    const celda = (valor: Celda, col: ColumnaTabla | undefined): string => {
      if (typeof valor !== 'number') return escaparHtml(valor);
      if (col?.formato === 'moneda') return fmtMoneda.format(valor);
      if (col?.formato === 'porcentaje') return `${fmtNumero.format(valor)} %`;
      return fmtNumero.format(valor);
    };

    const grafico = (g: NodoGrafico): string => {
      const max = Math.max(1, ...g.serie.map((p) => Math.abs(p.valor)));
      const filas = g.serie
        .map(
          (p) =>
            `<div class="barra"><span>${escaparHtml(p.etiqueta)}</span><div><i style="width:${((Math.abs(p.valor) / max) * 100).toFixed(1)}%"></i></div><b>${fmtNumero.format(p.valor)} ${escaparHtml(g.unidad)}</b></div>`,
        )
        .join('');
      return `<figure><figcaption>${escaparHtml(g.titulo)}</figcaption>${filas}</figure>`;
    };

    const render = (nodo: NodoReporte): string => {
      switch (nodo.tipo) {
        case 'seccion': {
          const h = Math.min(nodo.nivel + 1, 6);
          return `<section><h${h}>${escaparHtml(nodo.titulo)}</h${h}>${nodo.hijos.map(render).join('')}</section>`;
        }
        case 'parrafo':
          return `<p class="${nodo.estilo}">${escaparHtml(nodo.texto)}</p>`;
        case 'indicador': {
          const valor =
            nodo.formato === 'moneda' ? fmtMoneda.format(nodo.valor) : nodo.formato === 'porcentaje' ? `${fmtNumero.format(nodo.valor)} %` : fmtNumero.format(nodo.valor);
          return `<div class="kpi${nodo.alerta ? ' alerta' : ''}"><small>${escaparHtml(nodo.etiqueta)}</small><strong>${valor}</strong>${nodo.detalle ? `<em>${escaparHtml(nodo.detalle)}</em>` : ''}</div>`;
        }
        case 'tabla':
          return `<table><caption>${escaparHtml(nodo.titulo)}</caption><thead><tr>${nodo.columnas.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join('')}</tr></thead><tbody>${nodo.filas
            .map((f) => `<tr>${f.map((v, i) => `<td>${celda(v, nodo.columnas[i])}</td>`).join('')}</tr>`)
            .join('')}</tbody>${nodo.totales ? `<tfoot><tr>${nodo.totales.map((v, i) => `<td>${celda(v, nodo.columnas[i])}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
        case 'grafico':
          return grafico(nodo);
      }
    };

    const indice = doc.indice.length
      ? `<nav><h2>Índice</h2><ol>${doc.indice.map((e) => `<li style="margin-left:${(e.nivel - 1) * 18}px">${e.numeracion}. ${escaparHtml(e.titulo)}</li>`).join('')}</ol></nav>`
      : '';
    const marca = doc.marcasAgua.length ? `<div class="marca-agua">${escaparHtml(doc.marcasAgua.join(' · '))}</div>` : '';
    const firma = doc.firma
      ? `<p class="firma">Firma ${doc.firma.algoritmo}: <code>${doc.firma.valor}</code><br>Firmado por ${escaparHtml(doc.firma.firmadoPor)} el ${doc.firma.firmadoEn}</p>`
      : '';

    const html = `<!doctype html><html lang="${m.locale.slice(0, 2)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(m.titulo)}</title><style>
body{font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:960px;margin:0 auto;padding:32px;position:relative}
header{border-bottom:4px solid ${m.colorPrimario};padding-bottom:12px;margin-bottom:24px}
header .aviso{background:#fef2f2;color:#991b1b;padding:6px 10px;font-weight:600;font-size:13px;border-radius:4px}
h1{color:${m.colorPrimario};margin:8px 0}h2,h3,h4{color:${m.colorPrimario}}
.meta{color:#6b7280;font-size:13px}section{margin:16px 0}
.kpi{display:inline-block;min-width:170px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin:4px 8px 4px 0;vertical-align:top}
.kpi small{display:block;color:#6b7280}.kpi strong{font-size:20px}.kpi em{display:block;font-size:12px;color:#6b7280}
.kpi.alerta{border-color:#dc2626;background:#fef2f2}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}caption{text-align:left;font-weight:600;padding:4px 0}
th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}td:not(:first-child),th:not(:first-child){text-align:right}
thead th{background:#f3f4f6}tfoot td{font-weight:700;border-top:2px solid #9ca3af}
figure{margin:12px 0}figcaption{font-weight:600;margin-bottom:6px}
.barra{display:grid;grid-template-columns:150px 1fr 140px;gap:8px;align-items:center;font-size:13px;margin:3px 0}
.barra div{background:#f3f4f6;height:12px;border-radius:6px}.barra i{display:block;height:12px;border-radius:6px;background:${m.colorPrimario}}.barra b{text-align:right}
p.nota{color:#6b7280;font-size:13px}p.alerta{color:#991b1b;background:#fef2f2;padding:8px;border-radius:4px}
footer{border-top:1px solid #e5e7eb;margin-top:32px;padding-top:12px;font-size:12px;color:#6b7280}
.firma code{word-break:break-all}
.marca-agua{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90px;font-weight:800;color:rgba(220,38,38,.08);transform:rotate(-25deg);pointer-events:none}
@media print{body{padding:0}}
</style></head><body>${marca}<header>${doc.encabezados
      .slice(0, -1)
      .map((e) => `<div class="aviso">${escaparHtml(e)}</div>`)
      .join('')}<h1>${escaparHtml(m.titulo)}</h1><div class="meta">${escaparHtml(m.empresa)} · Periodo ${m.periodo.desde} al ${m.periodo.hasta} · Filiales: ${m.filiales.join(', ')} · Moneda: ${m.moneda} · Generado por ${escaparHtml(m.generadoPor)} el ${m.generadoEn.slice(0, 16).replace('T', ' ')} UTC</div></header>${indice}${doc.cuerpo.hijos
      .map(render)
      .join('')}<footer>${doc.pies.map((p) => `<p>${escaparHtml(p)}</p>`).join('')}<p>Capas aplicadas: ${doc.capas.map(escaparHtml).join(' → ')}</p>${firma}</footer></body></html>`;

    return { nombre: nombreArchivo(doc, 'html'), tipoMime: 'text/html; charset=utf-8', contenido: html };
  }
}

/** CSV con todas las tablas del reporte (para análisis en Excel). */
export class ExportadorCsv implements Exportador {
  readonly formato = 'CSV' as const;

  exportar(doc: DocumentoReporte): ArchivoExportado {
    const lineas: string[] = [`# ${doc.metadatos.titulo}`, `# Periodo;${doc.metadatos.periodo.desde};${doc.metadatos.periodo.hasta}`, `# Moneda;${doc.metadatos.moneda}`];
    const esc = (v: Celda) => {
      const t = String(v);
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const recorrer = (nodo: NodoReporte, ruta: string[]): void => {
      if (nodo.tipo === 'seccion') nodo.hijos.forEach((h) => recorrer(h, [...ruta, nodo.titulo]));
      else if (nodo.tipo === 'tabla') {
        lineas.push('', `# ${[...ruta.slice(1), nodo.titulo].join(' > ')}`, nodo.columnas.map((c) => esc(c.titulo)).join(';'));
        nodo.filas.forEach((f) => lineas.push(f.map(esc).join(';')));
        if (nodo.totales) lineas.push(nodo.totales.map(esc).join(';'));
      }
    };
    recorrer(doc.cuerpo, []);
    if (doc.firma) lineas.push('', `# Firma ${doc.firma.algoritmo};${doc.firma.valor}`);
    // BOM para que Excel reconozca UTF-8 (tildes y ñ).
    return { nombre: nombreArchivo(doc, 'csv'), tipoMime: 'text/csv; charset=utf-8', contenido: '﻿' + lineas.join('\n') };
  }
}

/** JSON completo (incluye la firma, permite verificar la integridad después). */
export class ExportadorJson implements Exportador {
  readonly formato = 'JSON' as const;

  exportar(doc: DocumentoReporte): ArchivoExportado {
    return { nombre: nombreArchivo(doc, 'json'), tipoMime: 'application/json', contenido: JSON.stringify(doc, null, 2) };
  }
}

/**
 * Fábrica de exportadores: el cliente pide un formato y recibe la abstracción
 * `Exportador`, sin conocer ni instanciar las clases concretas.
 * Un formato nuevo (p. ej. PDF) se agrega registrándolo, sin tocar la fachada (OCP).
 */
export class FabricaExportadores {
  private readonly creadores = new Map<FormatoExportacion, () => Exportador>([
    ['HTML', () => new ExportadorHtml()],
    ['CSV', () => new ExportadorCsv()],
    ['JSON', () => new ExportadorJson()],
  ]);

  registrar(formato: FormatoExportacion, creador: () => Exportador): void {
    this.creadores.set(formato, creador);
  }

  crear(formato: FormatoExportacion): Exportador {
    const creador = this.creadores.get(formato);
    if (!creador) throw new ErrorValidacion(`Formato de exportación no soportado: ${formato}`);
    return creador();
  }

  formatos(): FormatoExportacion[] {
    return [...this.creadores.keys()];
  }
}
