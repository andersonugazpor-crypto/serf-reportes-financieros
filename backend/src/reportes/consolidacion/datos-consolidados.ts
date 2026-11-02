import { Moneda } from '../../comun/dinero';
import { Categoria } from '../../productos/producto';

export interface ResumenFilial {
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
}

export interface ResumenCategoria {
  categoria: Categoria;
  etiqueta: string;
  ingresos: number;
  costo: number;
  margen: number;
  unidades: number;
}

export interface ResumenProducto {
  sku: string;
  nombre: string;
  categoria: Categoria;
  unidades: number;
  ingresos: number;
  margen: number;
  margenPct: number;
}

export interface ResumenInventarioFilial {
  codigo: string;
  nombre: string;
  unidades: number;
  valorizado: number;
  productosCriticos: number;
}

export interface StockCritico {
  filial: string;
  sku: string;
  nombre: string;
  cantidad: number;
}

/** Información de ventas e inventario de varias filiales, ya convertida a una sola moneda. */
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
  porFilial: ResumenFilial[];
  porCategoria: ResumenCategoria[];
  porMes: { periodo: string; ingresos: number; unidades: number }[];
  productos: ResumenProducto[];
  inventario: {
    porFilial: ResumenInventarioFilial[];
    criticos: StockCritico[];
    unidadesTotales: number;
    valorTotal: number;
    stockMinimo: number;
  };
  margenObjetivo: number;
  alertas: string[];
}
