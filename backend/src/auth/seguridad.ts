import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, Rol, Usuario } from './auth.service';

const CLAVE_PUBLICO = 'serf:publico';
const CLAVE_ROLES = 'serf:roles';

/** Marca un endpoint como accesible sin iniciar sesión. */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Restringe un endpoint a ciertos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

interface PeticionAutenticada extends Request {
  usuario?: Usuario;
}

/** Inyecta el usuario autenticado en el controlador: `@UsuarioActual() u: Usuario`. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): Usuario => ctx.switchToHttp().getRequest<PeticionAutenticada>().usuario!,
);

/** Guard global: exige token válido y, si se indica, un rol permitido. */
@Injectable()
export class GuardSeguridad implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;

    const peticion = ctx.switchToHttp().getRequest<PeticionAutenticada>();
    const [esquema, token] = (peticion.headers.authorization ?? '').split(' ');
    const usuario = esquema === 'Bearer' && token ? this.auth.validarToken(token) : null;
    if (!usuario) throw new UnauthorizedException('Sesión no válida o expirada. Inicia sesión nuevamente.');
    peticion.usuario = usuario;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, objetivos);
    if (roles && !roles.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permisos para esta operación.');
    }
    return true;
  }
}

/**
 * Regla de alcance por filial: un operador solo accede a los datos de su filial.
 * Devuelve las filiales que puede consultar el usuario dentro de las pedidas.
 */
export function filialesPermitidas(usuario: Usuario, solicitadas: string[]): string[] {
  if (usuario.rol !== 'FILIAL') return solicitadas;
  if (solicitadas.some((f) => f !== usuario.filial)) {
    throw new ForbiddenException(`Solo puedes acceder a los datos de la filial ${usuario.filial}.`);
  }
  return [usuario.filial!];
}
