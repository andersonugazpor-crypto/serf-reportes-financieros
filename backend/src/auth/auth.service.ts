import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Rol = 'ADMIN' | 'ANALISTA' | 'FILIAL';

export interface Usuario {
  usuario: string;
  nombre: string;
  rol: Rol;
  /** Solo para el rol FILIAL: la filial que opera. */
  filial: string | null;
}

interface Cuenta extends Usuario {
  sal: string;
  hash: string;
}

interface Sesion {
  usuario: Usuario;
  expira: number;
}

const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

function hashear(clave: string, sal: string): string {
  return scryptSync(clave, sal, 32).toString('hex');
}

function cuenta(usuario: string, clave: string, nombre: string, rol: Rol, filial: string | null = null): Cuenta {
  const sal = randomBytes(16).toString('hex');
  return { usuario, nombre, rol, filial, sal, hash: hashear(clave, sal) };
}

/** Credenciales de demostración (se documentan en el README). */
export const CUENTAS_DEMO = [
  { usuario: 'gerente', clave: 'Gerente2026!', nombre: 'Lucía Fernández', rol: 'ADMIN' as Rol, filial: null },
  { usuario: 'analista', clave: 'Analista2026!', nombre: 'Martín Salas', rol: 'ANALISTA' as Rol, filial: null },
  { usuario: 'operador.pe', clave: 'Peru2026!', nombre: 'Rosa Quispe', rol: 'FILIAL' as Rol, filial: 'PE' },
  { usuario: 'operador.mx', clave: 'Mexico2026!', nombre: 'Jorge Ramírez', rol: 'FILIAL' as Rol, filial: 'MX' },
];

/**
 * Autenticación con contraseñas cifradas (scrypt + sal) y tokens aleatorios con expiración.
 * Responsabilidad única: validar identidades y sesiones.
 */
@Injectable()
export class AuthService {
  private readonly cuentas = new Map<string, Cuenta>(
    CUENTAS_DEMO.map((c) => [c.usuario, cuenta(c.usuario, c.clave, c.nombre, c.rol, c.filial)]),
  );
  private readonly sesiones = new Map<string, Sesion>();

  iniciarSesion(usuario: string, clave: string): { token: string; usuario: Usuario; expira: string } | null {
    const c = this.cuentas.get(usuario.trim().toLowerCase());
    if (!c) return null;
    const esperado = Buffer.from(c.hash, 'hex');
    const recibido = Buffer.from(hashear(clave, c.sal), 'hex');
    if (!timingSafeEqual(esperado, recibido)) return null;

    const token = randomBytes(32).toString('hex');
    const datos: Usuario = { usuario: c.usuario, nombre: c.nombre, rol: c.rol, filial: c.filial };
    const expira = Date.now() + DURACION_SESION_MS;
    this.sesiones.set(token, { usuario: datos, expira });
    return { token, usuario: datos, expira: new Date(expira).toISOString() };
  }

  validarToken(token: string): Usuario | null {
    const sesion = this.sesiones.get(token);
    if (!sesion) return null;
    if (sesion.expira < Date.now()) {
      this.sesiones.delete(token);
      return null;
    }
    return sesion.usuario;
  }

  cerrarSesion(token: string): void {
    this.sesiones.delete(token);
  }
}
