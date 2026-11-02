import { asegurar } from './errores';

/** Monedas soportadas por las filiales (ISO 4217). */
export type Moneda = 'EUR' | 'USD' | 'MXN' | 'PEN' | 'COP' | 'CLP';

export const MONEDAS: readonly Moneda[] = ['EUR', 'USD', 'MXN', 'PEN', 'COP', 'CLP'];

/**
 * Objeto de valor inmutable para importes monetarios.
 * Trabaja en céntimos enteros para evitar errores de coma flotante y
 * no permite operar entre monedas distintas sin convertir antes.
 */
export class Dinero {
  private constructor(
    private readonly centimos: number,
    readonly moneda: Moneda,
  ) {}

  static de(monto: number, moneda: Moneda): Dinero {
    asegurar(Number.isFinite(monto), `Monto inválido: ${monto}`);
    return new Dinero(Math.round(monto * 100), moneda);
  }

  static cero(moneda: Moneda): Dinero {
    return new Dinero(0, moneda);
  }

  get monto(): number {
    return this.centimos / 100;
  }

  sumar(otro: Dinero): Dinero {
    this.mismaMoneda(otro);
    return new Dinero(this.centimos + otro.centimos, this.moneda);
  }

  restar(otro: Dinero): Dinero {
    this.mismaMoneda(otro);
    return new Dinero(this.centimos - otro.centimos, this.moneda);
  }

  multiplicar(factor: number): Dinero {
    return new Dinero(Math.round(this.centimos * factor), this.moneda);
  }

  /** Convierte usando una tasa "1 unidad de esta moneda = tasa unidades de destino". */
  convertir(destino: Moneda, tasa: number): Dinero {
    asegurar(tasa > 0, 'La tasa de cambio debe ser positiva.');
    return new Dinero(Math.round(this.centimos * tasa), destino);
  }

  equals(otro: Dinero): boolean {
    return this.moneda === otro.moneda && this.centimos === otro.centimos;
  }

  toString(): string {
    return `${this.monto.toFixed(2)} ${this.moneda}`;
  }

  private mismaMoneda(otro: Dinero): void {
    asegurar(this.moneda === otro.moneda, `No se puede operar ${this.moneda} con ${otro.moneda} sin convertir.`);
  }
}
