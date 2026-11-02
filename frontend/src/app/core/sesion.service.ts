import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Rol, Sesion, Usuario } from './modelos';

const CLAVE = 'serf.sesion';

/** Mantiene la sesión del usuario. Se guarda en sessionStorage: se cierra al cerrar el navegador. */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly router = inject(Router);
  private readonly _sesion = signal<Sesion | null>(this.leer());

  readonly usuario = computed<Usuario | null>(() => this._sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly token = computed(() => this._sesion()?.token ?? null);

  iniciar(sesion: Sesion): void {
    this._sesion.set(sesion);
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      /* almacenamiento no disponible: la sesión vive en memoria */
    }
  }

  cerrar(redirigir = true): void {
    this._sesion.set(null);
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* sin acción */
    }
    if (redirigir) void this.router.navigate(['/login']);
  }

  tieneRol(...roles: Rol[]): boolean {
    const u = this.usuario();
    return !!u && roles.includes(u.rol);
  }

  private leer(): Sesion | null {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo) as Sesion;
      return new Date(sesion.expira).getTime() > Date.now() ? sesion : null;
    } catch {
      return null;
    }
  }
}
