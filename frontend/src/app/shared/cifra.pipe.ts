import { Pipe, PipeTransform } from '@angular/core';

export type FormatoCifra = 'moneda' | 'numero' | 'porcentaje' | 'compacto' | 'texto';

const cache = new Map<string, Intl.NumberFormat>();

function formateador(locale: string, opciones: Intl.NumberFormatOptions): Intl.NumberFormat {
  const clave = `${locale}|${JSON.stringify(opciones)}`;
  let f = cache.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(locale, opciones);
    cache.set(clave, f);
  }
  return f;
}

/**
 * Formatea cifras según el formato y la configuración regional.
 *  1234.5 | cifra:'moneda':'EUR'          → 1.235 €
 *  0.4321 | cifra:'porcentaje'           → 43,2 %   (fracción 0-1)
 *  43.2   | cifra:'porcentaje':'':true    → 43,2 %   (ya en porcentaje)
 */
@Pipe({ name: 'cifra' })
export class CifraPipe implements PipeTransform {
  transform(valor: number | string | null | undefined, formato: FormatoCifra = 'numero', moneda = 'EUR', yaEnPorcentaje = false, locale = 'es-ES'): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'string') return valor;
    switch (formato) {
      case 'moneda':
        return formateador(locale, { style: 'currency', currency: moneda || 'EUR', maximumFractionDigits: Math.abs(valor) >= 1000 ? 0 : 2 }).format(valor);
      case 'porcentaje':
        return `${formateador(locale, { maximumFractionDigits: 1 }).format(yaEnPorcentaje ? valor : valor * 100)} %`;
      case 'compacto':
        return formateador(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(valor);
      case 'texto':
        return String(valor);
      default:
        return formateador(locale, { maximumFractionDigits: 2 }).format(valor);
    }
  }
}
