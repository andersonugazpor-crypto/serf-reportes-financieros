import { Identificable } from '../../comun/entidad';
import { PoolConexiones } from './pool-conexiones';

/**
 * Abstracción de persistencia (DIP): los servicios dependen de esta interfaz,
 * no de una base de datos concreta. Interfaz pequeña y cohesionada (ISP).
 */
export interface Repositorio<T extends Identificable> {
  guardar(entidad: T): T;
  buscarPorId(id: string): T | undefined;
  listar(filtro?: (entidad: T) => boolean): T[];
  eliminar(id: string): boolean;
  contar(): number;
}

/**
 * Implementación genérica que persiste en la base en memoria
 * pidiendo una conexión al pool Singleton para cada operación.
 */
export class RepositorioEnMemoria<T extends Identificable> implements Repositorio<T> {
  constructor(
    private readonly nombreTabla: string,
    private readonly pool: PoolConexiones = PoolConexiones.obtenerInstancia(),
  ) {}

  guardar(entidad: T): T {
    return this.pool.ejecutar((c) => {
      c.tabla<T>(this.nombreTabla).set(entidad.id, entidad);
      return entidad;
    });
  }

  buscarPorId(id: string): T | undefined {
    return this.pool.ejecutar((c) => c.tabla<T>(this.nombreTabla).get(id));
  }

  listar(filtro: (entidad: T) => boolean = () => true): T[] {
    return this.pool.ejecutar((c) => [...c.tabla<T>(this.nombreTabla).values()].filter(filtro));
  }

  eliminar(id: string): boolean {
    return this.pool.ejecutar((c) => c.tabla<T>(this.nombreTabla).delete(id));
  }

  contar(): number {
    return this.pool.ejecutar((c) => c.tabla<T>(this.nombreTabla).size);
  }
}
