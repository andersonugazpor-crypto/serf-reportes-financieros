import { randomUUID } from 'node:crypto';

/** Contrato mínimo de cualquier objeto persistible (ISP: solo lo indispensable). */
export interface Identificable {
  readonly id: string;
}

/**
 * Clase base abstracta de las entidades del dominio.
 * Centraliza la identidad y la fecha de creación (herencia para reutilizar),
 * y obliga a cada subclase a definir su representación pública con `aDto()`.
 */
export abstract class Entidad<TDto> implements Identificable {
  readonly id: string;
  readonly creadoEn: Date;

  protected constructor(id?: string, creadoEn?: Date) {
    this.id = id ?? randomUUID();
    this.creadoEn = creadoEn ?? new Date();
  }

  /** Representación serializable: lo único que sale hacia la API. */
  abstract aDto(): TDto;

  equals(otra: Entidad<unknown>): boolean {
    return this.id === otra.id;
  }
}
