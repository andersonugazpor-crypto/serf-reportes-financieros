/**
 * Almacenamiento en memoria organizado por "tablas".
 * Es el recurso compartido al que se accede a través del pool de conexiones.
 * Cambiar a una base de datos real implica reemplazar esta clase y el pool,
 * no los servicios (DIP).
 */
export class BaseDatosMemoria {
  private readonly tablas = new Map<string, Map<string, unknown>>();

  tabla<T>(nombre: string): Map<string, T> {
    let tabla = this.tablas.get(nombre);
    if (!tabla) {
      tabla = new Map<string, unknown>();
      this.tablas.set(nombre, tabla);
    }
    return tabla as Map<string, T>;
  }

  vaciar(): void {
    this.tablas.clear();
  }

  nombresTablas(): string[] {
    return [...this.tablas.keys()];
  }
}
