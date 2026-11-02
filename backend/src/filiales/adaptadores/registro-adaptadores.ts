import { ErrorValidacion } from '../../comun/errores';
import { FormatoDatos } from '../filial';
import { AdaptadorAlemania, AdaptadorEspana, AdaptadorEstandar, AdaptadorMexico, AdaptadorPeru } from './adaptadores';
import { AdaptadorDatosFilial } from './lote-normalizado';

/**
 * Catálogo de adaptadores disponibles.
 * Para soportar un formato nuevo basta con `registrar(nuevoAdaptador)`:
 * el resto del sistema no cambia (OCP).
 */
export class RegistroAdaptadores {
  private readonly adaptadores = new Map<FormatoDatos, AdaptadorDatosFilial>();

  constructor(
    iniciales: AdaptadorDatosFilial[] = [
      new AdaptadorEspana(),
      new AdaptadorMexico(),
      new AdaptadorPeru(),
      new AdaptadorAlemania(),
      new AdaptadorEstandar(),
    ],
  ) {
    iniciales.forEach((a) => this.registrar(a));
  }

  registrar(adaptador: AdaptadorDatosFilial): void {
    this.adaptadores.set(adaptador.formato, adaptador);
  }

  obtener(formato: FormatoDatos): AdaptadorDatosFilial {
    const adaptador = this.adaptadores.get(formato);
    if (!adaptador) throw new ErrorValidacion(`No hay un adaptador registrado para el formato ${formato}.`);
    return adaptador;
  }

  listar(): { formato: FormatoDatos; descripcion: string; ejemplo: string }[] {
    return [...this.adaptadores.values()].map((a) => ({
      formato: a.formato,
      descripcion: a.descripcion,
      ejemplo: a.ejemplo(),
    }));
  }
}
