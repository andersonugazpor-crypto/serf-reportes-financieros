import { Moneda } from '../../comun/dinero';
import { FormatoDatos } from '../filial';

/** Venta en el formato estándar corporativo, independiente del país de origen. */
export interface VentaNormalizada {
  referencia: string;
  fecha: Date;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  moneda: Moneda;
}

/** Existencias en el formato estándar corporativo. */
export interface StockNormalizado {
  sku: string;
  cantidad: number;
}

/** Resultado de adaptar un archivo de cualquier filial. */
export interface LoteNormalizado {
  ventas: VentaNormalizada[];
  inventario: StockNormalizado[];
  /** Líneas que no se pudieron interpretar (no detienen la importación). */
  advertencias: string[];
}

/**
 * PATRÓN ADAPTER — Interfaz objetivo (Target).
 *
 * Cada filial maneja sus datos en un formato y sistema distinto. SERF solo
 * conoce esta interfaz; un adaptador por formato traduce los datos del sistema
 * local a un `LoteNormalizado`. Agregar una filial con un formato nuevo es
 * crear un adaptador y registrarlo: no se modifica la importación (OCP).
 */
export interface AdaptadorDatosFilial {
  readonly formato: FormatoDatos;
  readonly descripcion: string;
  /** Ejemplo del archivo que produce el sistema local, para documentar y probar. */
  ejemplo(): string;
  adaptar(contenido: string, moneda: Moneda): LoteNormalizado;
}

/** Convierte 'YYYY-MM-DD', 'DD/MM/YYYY' o 'DD.MM.YYYY' en Date (UTC, mediodía). */
export function parsearFecha(texto: string): Date | null {
  const t = texto.trim();
  let anio: number, mes: number, dia: number;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(t))) {
    [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    return null;
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia ? fecha : null;
}
