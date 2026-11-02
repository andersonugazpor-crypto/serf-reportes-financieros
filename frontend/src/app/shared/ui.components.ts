import { Component, inject, input, output } from '@angular/core';
import { NotificacionService } from '../core/notificacion.service';

/** Encabezado de página con título, descripción y acciones proyectadas. */
@Component({
  selector: 'serf-encabezado',
  template: `
    <header class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <h1 class="h3 fw-bold mb-1">{{ titulo() }}</h1>
        @if (descripcion()) {
          <p class="text-body-secondary mb-0">{{ descripcion() }}</p>
        }
      </div>
      <div class="d-flex flex-wrap gap-2"><ng-content /></div>
    </header>
  `,
})
export class EncabezadoComponent {
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
}

/** Tarjeta de indicador para el panel. */
@Component({
  selector: 'serf-kpi',
  template: `
    <div class="card h-100 border-0 shadow-sm" [class.border-danger]="alerta()">
      <div class="card-body d-flex gap-3 align-items-center">
        <span class="icono rounded-3 d-inline-flex align-items-center justify-content-center" [class]="'bg-' + color() + '-subtle text-' + color() + '-emphasis'">
          <i class="bi fs-4" [class]="icono()"></i>
        </span>
        <div class="min-w-0">
          <div class="small text-body-secondary">{{ etiqueta() }}</div>
          <div class="fs-4 fw-bold lh-sm text-truncate">{{ valor() }}</div>
          @if (detalle()) {
            <div class="small" [class.text-danger]="alerta()" [class.text-body-secondary]="!alerta()">{{ detalle() }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `.icono { width: 3rem; height: 3rem; flex-shrink: 0; } .min-w-0 { min-width: 0; }`,
})
export class KpiComponent {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly icono = input('bi-graph-up');
  readonly color = input('primary');
  readonly detalle = input('');
  readonly alerta = input(false);
}

/** Mensaje para listas vacías o estados de carga. */
@Component({
  selector: 'serf-vacio',
  template: `
    <div class="text-center text-body-secondary py-5">
      <i class="bi display-6 d-block mb-2 opacity-50" [class]="icono()"></i>
      <p class="fw-semibold mb-1 text-body">{{ titulo() }}</p>
      @if (mensaje()) {
        <p class="small mb-0">{{ mensaje() }}</p>
      }
    </div>
  `,
})
export class VacioComponent {
  readonly icono = input('bi-inbox');
  readonly titulo = input.required<string>();
  readonly mensaje = input('');
}

/** Indicador de carga accesible. */
@Component({
  selector: 'serf-cargando',
  template: `<div class="d-flex justify-content-center align-items-center gap-2 py-5 text-body-secondary" role="status">
    <span class="spinner-border spinner-border-sm"></span>{{ texto() }}
  </div>`,
})
export class CargandoComponent {
  readonly texto = input('Cargando…');
}

/** Diálogo de confirmación modal. */
@Component({
  selector: 'serf-confirmar',
  template: `
    @if (abierto()) {
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" (click)="cancelado.emit()">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <div class="modal-content border-0 shadow">
            <div class="modal-body p-4">
              <h2 class="h5">{{ titulo() }}</h2>
              <p class="text-body-secondary mb-0">{{ mensaje() }}</p>
            </div>
            <div class="modal-footer border-0 pt-0">
              <button type="button" class="btn btn-light" (click)="cancelado.emit()">Cancelar</button>
              <button type="button" class="btn" [class]="'btn-' + variante()" (click)="confirmado.emit()">{{ textoConfirmar() }}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }
  `,
})
export class ConfirmarComponent {
  readonly abierto = input(false);
  readonly titulo = input('¿Confirmar?');
  readonly mensaje = input('');
  readonly textoConfirmar = input('Confirmar');
  readonly variante = input('danger');
  readonly confirmado = output<void>();
  readonly cancelado = output<void>();
}

/** Contenedor global de notificaciones (toasts de Bootstrap). */
@Component({
  selector: 'serf-notificaciones',
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" aria-live="polite">
      @for (n of servicio.lista(); track n.id) {
        <div class="toast show border-0 shadow" role="status" [class]="clases[n.tipo]">
          <div class="d-flex">
            <div class="toast-body"><i class="bi me-2" [class]="iconos[n.tipo]"></i>{{ n.mensaje }}</div>
            <button type="button" class="btn-close me-2 m-auto" [class.btn-close-white]="n.tipo !== 'advertencia'" aria-label="Cerrar" (click)="servicio.cerrar(n.id)"></button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `.toast-container { z-index: 1100; }`,
})
export class NotificacionesComponent {
  protected readonly servicio = inject(NotificacionService);
  protected readonly clases = { exito: 'text-bg-success', error: 'text-bg-danger', info: 'text-bg-primary', advertencia: 'text-bg-warning' };
  protected readonly iconos = { exito: 'bi-check-circle-fill', error: 'bi-x-octagon-fill', info: 'bi-info-circle-fill', advertencia: 'bi-exclamation-triangle-fill' };
}
