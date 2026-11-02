import { Entidad } from '../comun/entidad';
import { asegurar, ErrorConflicto } from '../comun/errores';

export interface StockDto {
  id: string;
  filialCodigo: string;
  sku: string;
  cantidad: number;
  actualizadoEn: string;
}

/**
 * Existencias de un producto en una filial.
 * La cantidad solo cambia mediante ingresar/retirar/fijar, que impiden valores negativos.
 */
export class Stock extends Entidad<StockDto> {
  private _cantidad: number;
  private _actualizadoEn = new Date();

  constructor(
    readonly filialCodigo: string,
    readonly sku: string,
    cantidadInicial = 0,
  ) {
    super(Stock.clave(filialCodigo, sku));
    this._cantidad = 0;
    this.fijar(cantidadInicial);
  }

  static clave(filialCodigo: string, sku: string): string {
    return `${filialCodigo}:${sku}`;
  }

  get cantidad(): number {
    return this._cantidad;
  }

  get actualizadoEn(): Date {
    return this._actualizadoEn;
  }

  ingresar(unidades: number): void {
    asegurar(Number.isInteger(unidades) && unidades > 0, 'Las unidades a ingresar deben ser un entero positivo.');
    this._cantidad += unidades;
    this.tocar();
  }

  retirar(unidades: number): void {
    asegurar(Number.isInteger(unidades) && unidades > 0, 'Las unidades a retirar deben ser un entero positivo.');
    if (unidades > this._cantidad) {
      throw new ErrorConflicto(
        `Stock insuficiente de ${this.sku} en ${this.filialCodigo}: hay ${this._cantidad}, se piden ${unidades}.`,
      );
    }
    this._cantidad -= unidades;
    this.tocar();
  }

  /** Reemplaza la cantidad (al importar un inventario físico de la filial). */
  fijar(cantidad: number): void {
    asegurar(Number.isInteger(cantidad) && cantidad >= 0, 'La cantidad de stock debe ser un entero mayor o igual a 0.');
    this._cantidad = cantidad;
    this.tocar();
  }

  esCritico(minimo: number): boolean {
    return this._cantidad < minimo;
  }

  aDto(): StockDto {
    return {
      id: this.id,
      filialCodigo: this.filialCodigo,
      sku: this.sku,
      cantidad: this._cantidad,
      actualizadoEn: this._actualizadoEn.toISOString(),
    };
  }

  private tocar(): void {
    this._actualizadoEn = new Date();
  }
}
