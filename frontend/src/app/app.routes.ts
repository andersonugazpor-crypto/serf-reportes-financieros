import { Routes } from '@angular/router';
import { guardAutenticado, guardInvitado, guardRol } from './core/interceptores';
import { ShellComponent } from './layout/shell.component';

/** Cada página se carga de forma diferida (lazy loading). */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guardInvitado],
    title: 'Iniciar sesión · SERF',
    loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [guardAutenticado],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'panel' },
      { path: 'panel', title: 'Panel · SERF', loadComponent: () => import('./pages/panel.component').then((m) => m.PanelComponent) },
      { path: 'reportes', title: 'Reportes · SERF', loadComponent: () => import('./pages/reportes.component').then((m) => m.ReportesComponent) },
      { path: 'productos', title: 'Productos · SERF', loadComponent: () => import('./pages/productos.component').then((m) => m.ProductosComponent) },
      { path: 'inventario', title: 'Inventario · SERF', loadComponent: () => import('./pages/inventario.component').then((m) => m.InventarioComponent) },
      { path: 'ventas', title: 'Ventas · SERF', loadComponent: () => import('./pages/ventas.component').then((m) => m.VentasComponent) },
      {
        path: 'integracion',
        title: 'Integrar datos · SERF',
        canActivate: [guardRol('ADMIN', 'FILIAL')],
        loadComponent: () => import('./pages/integracion.component').then((m) => m.IntegracionComponent),
      },
      {
        path: 'plantillas',
        title: 'Plantillas · SERF',
        canActivate: [guardRol('ADMIN', 'ANALISTA')],
        loadComponent: () => import('./pages/plantillas.component').then((m) => m.PlantillasComponent),
      },
      {
        path: 'configuracion',
        title: 'Configuración · SERF',
        canActivate: [guardRol('ADMIN', 'ANALISTA')],
        loadComponent: () => import('./pages/configuracion.component').then((m) => m.ConfiguracionComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'panel' },
];
