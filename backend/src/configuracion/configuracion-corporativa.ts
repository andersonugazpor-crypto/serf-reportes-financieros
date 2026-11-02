import { asegurar } from '../comun/errores';
import { Moneda, MONEDAS } from '../comun/dinero';

export interface PoliticasCorporativas {
  /** Moneda en la que se consolidan todos los reportes. */
  monedaConsolidacion: Moneda;
  /** Stock por debajo del cual un producto se considera crítico. */
  stockMinimo: number;
  /** Margen bruto mínimo esperado (0-1); se marca en los reportes si no se alcanza. */
  margenObjetivo: number;
  /** Texto legal que se añade al pie de los reportes. */
  avisoLegal: string;
}

export interface VistaConfiguracion {
  nombreEmpresa: string;
  sede: string;
  version: string;
  politicas: PoliticasCorporativas;
  /** Cuántas unidades de la moneda de consolidación vale 1 unidad de cada moneda. */
  tasasCambio: Record<Moneda, number>;
  tamanoPoolConexiones: number;
  actualizadoEn: string;
}

/**
 * PATRÓN SINGLETON — Configuración centralizada de SERF.
 *
 * Requisito complementario 1: "mantener una configuración centralizada que pueda
 * ser utilizada en cualquier parte del sistema".
 *
 * - El constructor es privado: nadie puede hacer `new ConfiguracionCorporativa()`.
 * - `obtenerInstancia()` es el único punto de acceso global y crea la instancia
 *   de forma perezosa la primera vez.
 * - El estado interno está encapsulado: solo se expone una copia de solo lectura
 *   y los cambios pasan por métodos que validan los datos.
 */
export class ConfiguracionCorporativa {
  private static instancia: ConfiguracionCorporativa | null = null;

  private readonly nombreEmpresa = 'FinanCorp S.A.';
  private readonly sede = 'Madrid, España';
  private readonly version = '1.0.0';
  private readonly secretoFirma: string;
  private politicas: PoliticasCorporativas;
  private tasasCambio: Record<Moneda, number>;
  private tamanoPool: number;
  private actualizadoEn = new Date();

  private constructor() {
    this.secretoFirma = process.env['SERF_SECRETO_FIRMA'] ?? 'financorp-serf-secreto-demo';
    this.tamanoPool = Number(process.env['SERF_POOL'] ?? 5);
    this.politicas = {
      monedaConsolidacion: 'EUR',
      stockMinimo: 15,
      margenObjetivo: 0.25,
      avisoLegal:
        'Documento de uso interno de FinanCorp S.A. Prohibida su distribución sin autorización de la gerencia corporativa.',
    };
    // Tasas de referencia: 1 unidad de la moneda = X EUR.
    this.tasasCambio = { EUR: 1, USD: 0.92, MXN: 0.051, PEN: 0.245, COP: 0.00023, CLP: 0.00098 };
  }

  /** Punto de acceso global a la única instancia. */
  static obtenerInstancia(): ConfiguracionCorporativa {
    if (!ConfiguracionCorporativa.instancia) {
      ConfiguracionCorporativa.instancia = new ConfiguracionCorporativa();
    }
    return ConfiguracionCorporativa.instancia;
  }

  /** Solo para pruebas: permite empezar cada test con valores por defecto. */
  static reiniciarParaPruebas(): void {
    ConfiguracionCorporativa.instancia = null;
  }

  get monedaConsolidacion(): Moneda {
    return this.politicas.monedaConsolidacion;
  }

  get stockMinimo(): number {
    return this.politicas.stockMinimo;
  }

  get margenObjetivo(): number {
    return this.politicas.margenObjetivo;
  }

  get avisoLegal(): string {
    return this.politicas.avisoLegal;
  }

  get tamanoPoolConexiones(): number {
    return this.tamanoPool;
  }

  get empresa(): string {
    return this.nombreEmpresa;
  }

  /** El secreto nunca sale en `vista()`: solo lo usan los componentes de seguridad. */
  get secretoDeFirma(): string {
    return this.secretoFirma;
  }

  /** Tasa para convertir 1 unidad de `moneda` a la moneda de consolidación. */
  tasaHaciaConsolidacion(moneda: Moneda): number {
    const tasa = this.tasasCambio[moneda];
    asegurar(tasa !== undefined, `No hay tasa de cambio para ${moneda}.`);
    return tasa;
  }

  actualizarTasa(moneda: Moneda, tasa: number): void {
    asegurar(MONEDAS.includes(moneda), `Moneda no soportada: ${moneda}`);
    asegurar(Number.isFinite(tasa) && tasa > 0, 'La tasa debe ser un número positivo.');
    asegurar(
      moneda !== this.politicas.monedaConsolidacion || tasa === 1,
      'La moneda de consolidación siempre tiene tasa 1.',
    );
    this.tasasCambio = { ...this.tasasCambio, [moneda]: tasa };
    this.tocar();
  }

  actualizarPoliticas(cambios: Partial<Omit<PoliticasCorporativas, 'monedaConsolidacion'>>): void {
    if (cambios.stockMinimo !== undefined) {
      asegurar(Number.isInteger(cambios.stockMinimo) && cambios.stockMinimo >= 0, 'Stock mínimo inválido.');
    }
    if (cambios.margenObjetivo !== undefined) {
      asegurar(cambios.margenObjetivo >= 0 && cambios.margenObjetivo <= 1, 'El margen objetivo va de 0 a 1.');
    }
    if (cambios.avisoLegal !== undefined) {
      asegurar(cambios.avisoLegal.trim().length >= 10, 'El aviso legal es demasiado corto.');
    }
    this.politicas = { ...this.politicas, ...cambios };
    this.tocar();
  }

  /** Copia inmutable para mostrar: proteger el estado real (encapsulamiento). */
  vista(): Readonly<VistaConfiguracion> {
    return Object.freeze({
      nombreEmpresa: this.nombreEmpresa,
      sede: this.sede,
      version: this.version,
      politicas: { ...this.politicas },
      tasasCambio: { ...this.tasasCambio },
      tamanoPoolConexiones: this.tamanoPool,
      actualizadoEn: this.actualizadoEn.toISOString(),
    });
  }

  private tocar(): void {
    this.actualizadoEn = new Date();
  }
}
