import { ConfiguracionCorporativa } from '../../configuracion/configuracion-corporativa';
import { ErrorConflicto } from '../../comun/errores';
import { BaseDatosMemoria } from './base-datos-memoria';

/** Conexión individual del pool. Solo es utilizable mientras esté prestada. */
export class Conexion {
  private enUso = false;
  private usos = 0;

  constructor(
    readonly numero: number,
    private readonly bd: BaseDatosMemoria,
  ) {}

  get ocupada(): boolean {
    return this.enUso;
  }

  get vecesUsada(): number {
    return this.usos;
  }

  /** @internal Lo invoca únicamente el pool. */
  marcarPrestada(): void {
    this.enUso = true;
    this.usos++;
  }

  /** @internal Lo invoca únicamente el pool. */
  marcarLibre(): void {
    this.enUso = false;
  }

  tabla<T>(nombre: string): Map<string, T> {
    if (!this.enUso) throw new ErrorConflicto(`La conexión #${this.numero} no está prestada.`);
    return this.bd.tabla<T>(nombre);
  }
}

export interface EstadoPool {
  total: number;
  libres: number;
  ocupadas: number;
  prestamosRealizados: number;
}

/**
 * PATRÓN SINGLETON — Pool de conexiones a la base de datos.
 *
 * Garantiza que exista un único pool en toda la aplicación, con un número fijo
 * de conexiones (definido en la configuración centralizada) que se reutilizan
 * en lugar de crearse en cada operación.
 */
export class PoolConexiones {
  private static instancia: PoolConexiones | null = null;

  private readonly conexiones: Conexion[];
  private readonly bd = new BaseDatosMemoria();
  private prestamos = 0;

  private constructor(tamano: number) {
    this.conexiones = Array.from({ length: tamano }, (_, i) => new Conexion(i + 1, this.bd));
  }

  static obtenerInstancia(): PoolConexiones {
    if (!PoolConexiones.instancia) {
      PoolConexiones.instancia = new PoolConexiones(ConfiguracionCorporativa.obtenerInstancia().tamanoPoolConexiones);
    }
    return PoolConexiones.instancia;
  }

  /** Solo para pruebas. */
  static reiniciarParaPruebas(): void {
    PoolConexiones.instancia = null;
  }

  adquirir(): Conexion {
    const libre = this.conexiones.find((c) => !c.ocupada);
    if (!libre) {
      throw new ErrorConflicto('No hay conexiones disponibles en el pool.');
    }
    libre.marcarPrestada();
    this.prestamos++;
    return libre;
  }

  liberar(conexion: Conexion): void {
    conexion.marcarLibre();
  }

  /**
   * Presta una conexión, ejecuta la operación y la devuelve siempre
   * (incluso si la operación falla), evitando fugas de conexiones.
   */
  ejecutar<R>(operacion: (conexion: Conexion) => R): R {
    const conexion = this.adquirir();
    try {
      return operacion(conexion);
    } finally {
      this.liberar(conexion);
    }
  }

  estado(): EstadoPool {
    const ocupadas = this.conexiones.filter((c) => c.ocupada).length;
    return {
      total: this.conexiones.length,
      libres: this.conexiones.length - ocupadas,
      ocupadas,
      prestamosRealizados: this.prestamos,
    };
  }

  /** Borra todos los datos (para recargar los datos de demostración). */
  vaciar(): void {
    this.bd.vaciar();
  }
}
