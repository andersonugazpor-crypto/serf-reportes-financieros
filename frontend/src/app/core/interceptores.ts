import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Rol } from './modelos';
import { NotificacionService } from './notificacion.service';
import { SesionService } from './sesion.service';

/** Agrega el token a cada petición y cierra la sesión si la API responde 401. */
export const interceptorAuth: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const notificaciones = inject(NotificacionService);
  const token = sesion.token();
  const peticion = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.endsWith('/auth/login')) {
        notificaciones.advertencia('Tu sesión expiró. Vuelve a iniciar sesión.');
        sesion.cerrar();
      } else if (error.status === 0) {
        notificaciones.error('No se pudo conectar con la API. ¿Está ejecutándose el backend?');
      }
      return throwError(() => error);
    }),
  );
};

/** Extrae el mensaje legible de un error de la API. */
export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { mensaje?: string } | null;
    return cuerpo?.mensaje ?? porDefecto;
  }
  return porDefecto;
}

export const guardAutenticado: CanActivateFn = (_ruta, estado) =>
  inject(SesionService).autenticado()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { volver: estado.url } });

export const guardInvitado: CanActivateFn = () =>
  inject(SesionService).autenticado() ? inject(Router).createUrlTree(['/panel']) : true;

export function guardRol(...roles: Rol[]): CanActivateFn {
  return () => {
    if (inject(SesionService).tieneRol(...roles)) return true;
    inject(NotificacionService).advertencia('No tienes permisos para esa sección.');
    return inject(Router).createUrlTree(['/panel']);
  };
}
