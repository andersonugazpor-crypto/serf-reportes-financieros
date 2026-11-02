import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ETIQUETA_ROL, Rol } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { BANDERA } from '../core/utilidades';

interface Enlace {
  ruta: string;
  texto: string;
  icono: string;
  roles?: Rol[];
  grupo: string;
}

/** Estructura principal: barra lateral (escritorio) y menú desplegable (móvil). */
@Component({
  selector: 'serf-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);
  protected readonly menuAbierto = signal(false);
  protected readonly bandera = BANDERA;

  private readonly enlaces: Enlace[] = [
    { ruta: '/panel', texto: 'Panel', icono: 'bi-speedometer2', grupo: 'General' },
    { ruta: '/reportes', texto: 'Reportes', icono: 'bi-file-earmark-bar-graph', grupo: 'General' },
    { ruta: '/productos', texto: 'Productos', icono: 'bi-box-seam', grupo: 'Operación' },
    { ruta: '/inventario', texto: 'Inventario', icono: 'bi-boxes', grupo: 'Operación' },
    { ruta: '/ventas', texto: 'Ventas', icono: 'bi-receipt', grupo: 'Operación' },
    { ruta: '/integracion', texto: 'Integrar datos', icono: 'bi-cloud-arrow-up', roles: ['ADMIN', 'FILIAL'], grupo: 'Operación' },
    { ruta: '/plantillas', texto: 'Plantillas', icono: 'bi-files', roles: ['ADMIN', 'ANALISTA'], grupo: 'Administración' },
    { ruta: '/configuracion', texto: 'Configuración', icono: 'bi-sliders', roles: ['ADMIN', 'ANALISTA'], grupo: 'Administración' },
  ];

  protected readonly grupos = computed(() => {
    const visibles = this.enlaces.filter((e) => !e.roles || this.sesion.tieneRol(...e.roles));
    return [...new Set(visibles.map((e) => e.grupo))].map((g) => ({ nombre: g, enlaces: visibles.filter((e) => e.grupo === g) }));
  });

  protected readonly rol = computed(() => {
    const u = this.sesion.usuario();
    return u ? ETIQUETA_ROL[u.rol] : '';
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.sesion.cerrar(), error: () => this.sesion.cerrar() });
  }
}
