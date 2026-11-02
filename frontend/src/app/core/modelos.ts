/** Tipos de la API de SERF (reflejan los DTO del backend). */

export type Rol = 'ADMIN' | 'ANALISTA' | 'FILIAL';
export type Moneda = 'EUR' | 'USD' | 'MXN' | 'PEN' | 'COP' | 'CLP';
export type Categoria = 'LAPTOP' | 'SMARTPHONE' | 'ACCESORIO' | 'REDES';
export type FormatoDatos = 'JSON_ES' | 'CSV_MX' | 'XML_PE' | 'CSV_DE' | 'ESTANDAR';
export type TipoReporte = 'VENTAS' | 'INVENTARIO' | 'RENTABILIDAD' | 'EJECUTIVO';
export type FormatoExportacion = 'HTML' | 'CSV' | 'JSON';
export type NivelConfidencialidad = 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO';

export const MONEDAS: Moneda[] = ['EUR', 'USD', 'MXN', 'PEN', 'COP', 'CLP'];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  LAPTOP: 'Laptops',
  SMARTPHONE: 'Smartphones',
  ACCESORIO: 'Accesorios',
  REDES: 'Redes',
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Gerencia corporativa',
  ANALISTA: 'Analista financiero',
  FILIAL: 'Operador de filial',
};

export interface Usuario {
  usuario: string;
  nombre: string;
  rol: Rol;
  filial: string | null;
}

export interface Sesion {
  token: string;
  usuario: Usuario;
  expira: string;
}

export interface Filial {
  id: string;
  codigo: string;
  nombre: string;
  pais: string;
  ciudad: string;
  region: 'EUROPA' | 'LATAM';
  moneda: Moneda;
  formatoDatos: FormatoDatos;
  activa: boolean;
}

export interface FormatoAdaptador {
  formato: FormatoDatos;
  descripcion: string;
  ejemplo: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  categoria: Categoria;
  marca: string;
  proveedor: string;
  paisOrigen: string;
  costoImportacionUsd: number;
  precioListaEur: number;
  activo: boolean;
  creadoEn: string;
}

export interface FilaInventario {
  filialCodigo: string;
  filialNombre: string;
  sku: string;
  producto: string;
  categoria: Categoria;
  cantidad: number;
  critico: boolean;
  valorCostoEur: number;
  actualizadoEn: string;
}

export interface Venta {
  id: string;
  fecha: string;
  filialCodigo: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  moneda: Moneda;
  total: number;
  origen: 'MANUAL' | 'IMPORTACION';
  referenciaExterna: string | null;
}

export interface VistaPreviaImportacion {
  ventas: { referencia: string; fecha: string; sku: string; cantidad: number; precioUnitario: number; moneda: Moneda }[];
  inventario: { sku: string; cantidad: number }[];
  advertencias: string[];
  skusDesconocidos: string[];
}

export interface ResultadoImportacion {
  filial: string;
  formato: string;
  ventasImportadas: number;
  ventasDuplicadas: number;
  stocksActualizados: number;
  advertencias: string[];
}

export interface DatosConsolidados {
  periodo: { desde: string; hasta: string };
  moneda: Moneda;
  filiales: { codigo: string; nombre: string }[];
  totales: {
    ingresos: number;
    costo: number;
    margen: number;
    margenPct: number;
    unidades: number;
    transacciones: number;
    ticketPromedio: number;
  };
  porFilial: {
    codigo: string;
    nombre: string;
    monedaLocal: Moneda;
    ingresosLocal: number;
    ingresos: number;
    costo: number;
    margen: number;
    margenPct: number;
    unidades: number;
    transacciones: number;
  }[];
  porCategoria: { categoria: Categoria; etiqueta: string; ingresos: number; margen: number; unidades: number }[];
  porMes: { periodo: string; ingresos: number; unidades: number }[];
  productos: { sku: string; nombre: string; unidades: number; ingresos: number; margen: number; margenPct: number }[];
  inventario: {
    porFilial: { codigo: string; nombre: string; unidades: number; valorizado: number; productosCriticos: number }[];
    criticos: { filial: string; sku: string; nombre: string; cantidad: number }[];
    unidadesTotales: number;
    valorTotal: number;
    stockMinimo: number;
  };
  margenObjetivo: number;
  alertas: string[];
}

/* ---------- Árbol del reporte (Composite) ---------- */

export type NodoReporte = NodoSeccion | NodoParrafo | NodoTabla | NodoGrafico | NodoIndicador;

export interface NodoSeccion {
  tipo: 'seccion';
  id: string;
  clave: string | null;
  titulo: string;
  nivel: number;
  hijos: NodoReporte[];
}
export interface NodoParrafo {
  tipo: 'parrafo';
  id: string;
  texto: string;
  estilo: 'normal' | 'nota' | 'alerta';
}
export interface ColumnaTabla {
  titulo: string;
  formato: 'texto' | 'numero' | 'moneda' | 'porcentaje';
}
export interface NodoTabla {
  tipo: 'tabla';
  id: string;
  titulo: string;
  columnas: ColumnaTabla[];
  filas: (string | number)[][];
  totales: (string | number)[] | null;
}
export interface NodoGrafico {
  tipo: 'grafico';
  id: string;
  titulo: string;
  tipoGrafico: 'barras' | 'linea' | 'torta';
  unidad: string;
  serie: { etiqueta: string; valor: number }[];
}
export interface NodoIndicador {
  tipo: 'indicador';
  id: string;
  etiqueta: string;
  valor: number;
  formato: 'moneda' | 'numero' | 'porcentaje';
  moneda: Moneda | null;
  alerta: boolean;
  detalle: string | null;
}

export interface DocumentoReporte {
  metadatos: {
    id: string;
    titulo: string;
    tipo: TipoReporte;
    plantillaId: string;
    ambito: string;
    periodo: { desde: string; hasta: string };
    filiales: string[];
    moneda: Moneda;
    locale: string;
    colorPrimario: string;
    empresa: string;
    generadoPor: string;
    generadoEn: string;
  };
  cuerpo: NodoSeccion;
  encabezados: string[];
  pies: string[];
  marcasAgua: string[];
  confidencialidad: NivelConfidencialidad | null;
  indice: { nivel: number; titulo: string; numeracion: string }[];
  firma: { algoritmo: string; valor: string; firmadoPor: string; firmadoEn: string } | null;
  capas: string[];
}

export interface ArchivoExportado {
  nombre: string;
  tipoMime: string;
  contenido: string;
}

export interface ResultadoReporte {
  id: string;
  documento: DocumentoReporte;
  archivo: ArchivoExportado;
  resumen: { elementos: number; secciones: number; capas: string[] };
}

export interface OpcionesReporte {
  marcaAgua?: string;
  confidencialidad?: NivelConfidencialidad;
  indice?: boolean;
  pieLegal?: boolean;
  firmar?: boolean;
}

export interface SolicitudReporte {
  tipo: TipoReporte;
  desde: string;
  hasta: string;
  filiales: string[];
  formato?: FormatoExportacion;
  titulo?: string;
  opciones?: OpcionesReporte;
}

export interface ItemHistorial {
  id: string;
  titulo: string;
  tipo: TipoReporte;
  filiales: string[];
  generadoEn: string;
  generadoPor: string;
  firmado: boolean;
}

export interface Plantilla {
  id: string;
  nombre: string;
  tipo: TipoReporte;
  ambito: string;
  locale: string;
  monedaPresentacion: Moneda;
  estilo: { colorPrimario: string; logoTexto: string };
  normativa: string;
  textosLegales: string[];
  secciones: string[];
  esBase: boolean;
}

export interface Configuracion {
  nombreEmpresa: string;
  sede: string;
  version: string;
  politicas: { monedaConsolidacion: Moneda; stockMinimo: number; margenObjetivo: number; avisoLegal: string };
  tasasCambio: Record<Moneda, number>;
  tamanoPoolConexiones: number;
  actualizadoEn: string;
  pool?: { total: number; libres: number; ocupadas: number; prestamosRealizados: number };
}
