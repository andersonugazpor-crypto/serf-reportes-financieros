import { Dinero, Moneda } from '../comun/dinero';
import { Entidad } from '../comun/entidad';
import { asegurar } from '../comun/errores';

export type OrigenVenta = 'MANUAL' | 'IMPORTACION';

export interface VentaDto {
  id: string;
  fecha: string;
  filialCodigo: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  moneda: Moneda;
  total: number;
  origen: OrigenVenta;
  referenciaExterna: string | null;
}

export interface DatosVenta {
  fecha: Date;
  filialCodigo: string;
  sku: string;
  cantidad: number;
  precioUnitario: Dinero;
  origen: OrigenVenta;
  referenciaExterna?: string;
}

/** Venta realizada por una filial, en su moneda local. Es inmutable una vez registrada. */
export class Venta extends Entidad<VentaDto> {
  readonly fecha: Date;
  readonly filialCodigo: string;
  readonly sku: string;
  readonly cantidad: number;
  readonly precioUnitario: Dinero;
  readonly origen: OrigenVenta;
  readonly referenciaExterna: string | null;

  constructor(datos: DatosVenta, id?: string) {
    asegurar(datos.fecha instanceof Date && !isNaN(datos.fecha.getTime()), 'Fecha de venta inválida.');
    asegurar(datos.fecha.getTime() <= Date.now() + 86_400_000, 'La fecha de venta no puede ser futura.');
    asegurar(Number.isInteger(datos.cantidad) && datos.cantidad > 0, 'La cantidad debe ser un entero positivo.');
    asegurar(datos.precioUnitario.monto > 0, 'El precio unitario debe ser mayor que 0.');
    super(id);
    this.fecha = datos.fecha;
    this.filialCodigo = datos.filialCodigo;
    this.sku = datos.sku;
    this.cantidad = datos.cantidad;
    this.precioUnitario = datos.precioUnitario;
    this.origen = datos.origen;
    this.referenciaExterna = datos.referenciaExterna?.trim() || null;
  }

  get total(): Dinero {
    return this.precioUnitario.multiplicar(this.cantidad);
  }

  /** 'YYYY-MM' para agrupar por mes. */
  get periodo(): string {
    return this.fecha.toISOString().slice(0, 7);
  }

  aDto(): VentaDto {
    return {
      id: this.id,
      fecha: this.fecha.toISOString().slice(0, 10),
      filialCodigo: this.filialCodigo,
      sku: this.sku,
      cantidad: this.cantidad,
      precioUnitario: this.precioUnitario.monto,
      moneda: this.precioUnitario.moneda,
      total: this.total.monto,
      origen: this.origen,
      referenciaExterna: this.referenciaExterna,
    };
  }
}
