/**
 * Errores de dominio. Se lanzan desde las clases de negocio y un filtro
 * global los traduce a respuestas HTTP (los modelos no conocen HTTP: SRP).
 */
export class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Datos que no cumplen una regla de negocio (HTTP 400). */
export class ErrorValidacion extends ErrorDominio {}

/** Recurso inexistente (HTTP 404). */
export class ErrorNoEncontrado extends ErrorDominio {
  constructor(recurso: string, id: string) {
    super(`${recurso} "${id}" no existe.`);
  }
}

/** Operación que contradice el estado actual, p. ej. stock insuficiente (HTTP 409). */
export class ErrorConflicto extends ErrorDominio {}

/** Utilidad de validación usada por las entidades para proteger sus invariantes. */
export function asegurar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorValidacion(mensaje);
}
