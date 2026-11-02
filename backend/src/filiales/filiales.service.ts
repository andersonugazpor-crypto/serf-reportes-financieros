import { Inject, Injectable } from '@nestjs/common';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../comun/errores';
import { REGISTRO_ADAPTADORES, REPO_FILIALES } from '../comun/tokens';
import { Repositorio } from '../infraestructura/persistencia/repositorio';
import { RegistroAdaptadores } from './adaptadores/registro-adaptadores';
import { DatosFilial, Filial, FormatoDatos } from './filial';

@Injectable()
export class FilialesService {
  constructor(
    @Inject(REPO_FILIALES) private readonly repo: Repositorio<Filial>,
    @Inject(REGISTRO_ADAPTADORES) private readonly adaptadores: RegistroAdaptadores,
  ) {}

  listar(soloActivas = false): Filial[] {
    return this.repo.listar((f) => !soloActivas || f.activa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  obtener(codigo: string): Filial {
    const filial = this.repo.buscarPorId(codigo.toUpperCase());
    if (!filial) throw new ErrorNoEncontrado('Filial', codigo);
    return filial;
  }

  obtenerActiva(codigo: string): Filial {
    const filial = this.obtener(codigo);
    if (!filial.activa) throw new ErrorConflicto(`La filial ${filial.nombre} está desactivada.`);
    return filial;
  }

  /** Escalabilidad: una filial nueva solo necesita sus datos y un formato con adaptador registrado. */
  registrar(datos: DatosFilial): Filial {
    this.adaptadores.obtener(datos.formatoDatos);
    const filial = new Filial(datos);
    if (this.repo.buscarPorId(filial.codigo)) throw new ErrorConflicto(`Ya existe la filial ${filial.codigo}.`);
    return this.repo.guardar(filial);
  }

  cambiarEstado(codigo: string, activa: boolean): Filial {
    const filial = this.obtener(codigo);
    if (activa) filial.activar();
    else filial.desactivar();
    return this.repo.guardar(filial);
  }

  cambiarFormato(codigo: string, formato: FormatoDatos): Filial {
    this.adaptadores.obtener(formato);
    const filial = this.obtener(codigo);
    filial.cambiarFormato(formato);
    return this.repo.guardar(filial);
  }

  validarCodigos(codigos: string[]): Filial[] {
    if (!codigos.length) throw new ErrorValidacion('Selecciona al menos una filial.');
    return codigos.map((c) => this.obtener(c));
  }
}
