import { Moneda } from '../../comun/dinero';

/**
 * Representación serializable (JSON) del árbol de un reporte.
 * Es lo que viaja a la interfaz web y lo que consumen los exportadores.
 */
export type NodoReporte = NodoSeccion | NodoParrafo | NodoTabla | NodoGrafico | NodoIndicador;

export interface NodoSeccion {
  tipo: 'seccion';
  id: string;
  clave: string | null;
  titulo: string;
  nivel: number;
  hijos: NodoReporte[];
}

export type EstiloParrafo = 'normal' | 'nota' | 'alerta';

export interface NodoParrafo {
  tipo: 'parrafo';
  id: string;
  texto: string;
  estilo: EstiloParrafo;
}

export type FormatoCelda = 'texto' | 'numero' | 'moneda' | 'porcentaje';

export interface ColumnaTabla {
  titulo: string;
  formato: FormatoCelda;
}

export type Celda = string | number;

export interface NodoTabla {
  tipo: 'tabla';
  id: string;
  titulo: string;
  columnas: ColumnaTabla[];
  filas: Celda[][];
  totales: Celda[] | null;
}

export type TipoGrafico = 'barras' | 'linea' | 'torta';

export interface PuntoSerie {
  etiqueta: string;
  valor: number;
}

export interface NodoGrafico {
  tipo: 'grafico';
  id: string;
  titulo: string;
  tipoGrafico: TipoGrafico;
  unidad: string;
  serie: PuntoSerie[];
}

export type FormatoIndicador = 'moneda' | 'numero' | 'porcentaje';

export interface NodoIndicador {
  tipo: 'indicador';
  id: string;
  etiqueta: string;
  valor: number;
  formato: FormatoIndicador;
  moneda: Moneda | null;
  alerta: boolean;
  detalle: string | null;
}
