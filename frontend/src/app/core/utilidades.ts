/** Utilidades de fechas y descargas usadas por varias páginas. */

export function hoyISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Primer y último día del mes anterior. */
export function mesAnterior(): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const hasta = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), 0));
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

export function descargarTexto(nombre: string, contenido: string | Blob, tipo = 'text/plain'): void {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BANDERA: Record<string, string | undefined> = {
  ES: '🇪🇸',
  DE: '🇩🇪',
  MX: '🇲🇽',
  PE: '🇵🇪',
  CO: '🇨🇴',
  CL: '🇨🇱',
  AR: '🇦🇷',
  FR: '🇫🇷',
  IT: '🇮🇹',
  PT: '🇵🇹',
  CORPORATIVO: '🌐',
  BASE: '📄',
};
