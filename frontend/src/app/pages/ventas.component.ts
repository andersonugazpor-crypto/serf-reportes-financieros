import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { Filial, Producto, Venta } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA, haceDiasISO, hoyISO } from '../core/utilidades';
import { CifraPipe } from '../shared/cifra.pipe';
import { CargandoComponent, EncabezadoComponent, VacioComponent } from '../shared/ui.components';

/** Seguimiento de la venta de los productos importados (requisito 2). */
@Component({
  selector: 'serf-ventas',
  imports: [ReactiveFormsModule, CifraPipe, EncabezadoComponent, CargandoComponent, VacioComponent],
  template: `
    <serf-encabezado titulo="Ventas" descripcion="Seguimiento de la venta de productos importados en cada filial.">
      @if (puedeRegistrar) {
        <button class="btn btn-primary" (click)="formAbierto.set(!formAbierto())"><i class="bi bi-plus-lg me-1"></i>Registrar venta</button>
      }
    </serf-encabezado>

    @if (formAbierto()) {
      <form class="card border-0 shadow-sm mb-4" [formGroup]="form" (ngSubmit)="registrar()">
        <div class="card-body row g-3 align-items-end">
          <div class="col-md-2">
            <label class="form-label" for="v-filial">Filial</label>
            <select id="v-filial" class="form-select" formControlName="filialCodigo">
              @for (f of filiales(); track f.codigo) { <option [value]="f.codigo">{{ bandera[f.codigo] }} {{ f.codigo }}</option> }
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label" for="v-sku">Producto</label>
            <select id="v-sku" class="form-select" formControlName="sku" (change)="sugerirPrecio()">
              <option value="" disabled>Selecciona…</option>
              @for (p of productos(); track p.sku) { <option [value]="p.sku">{{ p.sku }} — {{ p.nombre }}</option> }
            </select>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label" for="v-cant">Cantidad</label>
            <input id="v-cant" type="number" min="1" class="form-control" formControlName="cantidad">
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label" for="v-precio">Precio unit. ({{ monedaFilial() }})</label>
            <input id="v-precio" type="number" min="0.01" step="0.01" class="form-control" formControlName="precioUnitario">
          </div>
          <div class="col-md-2 d-grid"><button class="btn btn-success" type="submit" [disabled]="form.invalid || guardando()">Registrar</button></div>
          <div class="col-12 small text-body-secondary">El precio se ingresa en la moneda local de la filial; SERF lo convierte a EUR al consolidar. La venta descuenta el stock.</div>
        </div>
      </form>
    }

    <div class="card border-0 shadow-sm">
      <div class="card-body row g-2 border-bottom">
        @if (!esFilial) {
          <div class="col-md-3">
            <select class="form-select form-select-sm" aria-label="Filial" (change)="filtroFilial.set($any($event.target).value || null); cargar()">
              <option value="">Todas las filiales</option>
              @for (f of filiales(); track f.codigo) { <option [value]="f.codigo">{{ f.nombre }}</option> }
            </select>
          </div>
        }
        <div class="col-6 col-md-3"><input type="date" class="form-control form-control-sm" aria-label="Desde" [value]="desde()" (change)="desde.set($any($event.target).value); cargar()"></div>
        <div class="col-6 col-md-3"><input type="date" class="form-control form-control-sm" aria-label="Hasta" [value]="hasta()" (change)="hasta.set($any($event.target).value); cargar()"></div>
        <div class="col-md-3 text-md-end small text-body-secondary align-self-center">{{ total() }} venta(s) · mostrando {{ ventas().length }}</div>
      </div>
      @if (cargando()) {
        <serf-cargando />
      } @else if (ventas().length) {
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead class="table-light"><tr><th>Fecha</th><th>Filial</th><th>Producto</th><th class="text-end">Cant.</th><th class="text-end">Total (local)</th><th class="d-none d-lg-table-cell">Origen</th></tr></thead>
            <tbody>
              @for (v of ventas(); track v.id) {
                <tr>
                  <td class="text-nowrap small">{{ v.fecha }}</td>
                  <td class="text-nowrap">{{ bandera[v.filialCodigo] }} {{ v.filialCodigo }}</td>
                  <td><code>{{ v.sku }}</code> <span class="small d-none d-md-inline">{{ nombre(v.sku) }}</span></td>
                  <td class="text-end">{{ v.cantidad }}</td>
                  <td class="text-end fw-semibold">{{ v.total | cifra: 'moneda' : v.moneda }}</td>
                  <td class="d-none d-lg-table-cell small">
                    <span class="badge" [class]="v.origen === 'MANUAL' ? 'text-bg-info' : 'text-bg-light border'">{{ v.origen === 'MANUAL' ? 'Manual' : 'Importada' }}</span>
                    <span class="text-body-secondary ms-1">{{ v.referenciaExterna }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <serf-vacio icono="bi-receipt" titulo="No hay ventas en el periodo" />
      }
    </div>
  `,
})
export class VentasComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly sesion = inject(SesionService);
  protected readonly bandera = BANDERA;
  protected readonly esFilial = this.sesion.tieneRol('FILIAL');
  protected readonly puedeRegistrar = this.sesion.tieneRol('ADMIN', 'FILIAL');

  protected readonly ventas = signal<Venta[]>([]);
  protected readonly total = signal(0);
  protected readonly filiales = signal<Filial[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly formAbierto = signal(false);
  protected readonly filtroFilial = signal<string | null>(null);
  protected readonly desde = signal(haceDiasISO(30));
  protected readonly hasta = signal(hoyISO());
  private readonly filialForm = signal('');
  private tasas: Record<string, number> = {};

  protected readonly form = inject(NonNullableFormBuilder).group({
    filialCodigo: ['', Validators.required],
    sku: ['', Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    precioUnitario: [0, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly monedaFilial = computed(() => this.filiales().find((f) => f.codigo === this.filialForm())?.moneda ?? '');

  ngOnInit(): void {
    this.api.filiales(true).subscribe((f) => {
      const u = this.sesion.usuario();
      const propias = u?.rol === 'FILIAL' ? f.filter((x) => x.codigo === u.filial) : f;
      this.filiales.set(propias);
      this.form.controls.filialCodigo.setValue(propias[0]?.codigo ?? '');
    });
    this.form.controls.filialCodigo.valueChanges.subscribe((v) => {
      this.filialForm.set(v);
      this.sugerirPrecio();
    });
    this.api.productos().subscribe((p) => this.productos.set(p.filter((x) => x.activo)));
    this.api.configuracion().subscribe((c) => (this.tasas = c.tasasCambio));
    this.cargar();
  }

  protected nombre(sku: string): string {
    return this.productos().find((p) => p.sku === sku)?.nombre ?? '';
  }

  /** Precio sugerido = precio de lista convertido a la moneda local. */
  protected sugerirPrecio(): void {
    const p = this.productos().find((x) => x.sku === this.form.controls.sku.value);
    const tasa = this.tasas[this.monedaFilial()];
    if (p && tasa) this.form.controls.precioUnitario.setValue(Math.round((p.precioListaEur / tasa) * 100) / 100);
  }

  protected registrar(): void {
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.api.registrarVenta({ ...v, cantidad: Number(v.cantidad), precioUnitario: Number(v.precioUnitario) }).subscribe({
      next: (venta) => {
        this.guardando.set(false);
        this.notificaciones.exito(`Venta registrada: ${venta.cantidad} × ${venta.sku}.`);
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.api.ventas({ filial: this.filtroFilial(), desde: this.desde(), hasta: this.hasta() }).subscribe({
      next: (r) => {
        this.ventas.set(r.ventas);
        this.total.set(r.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }
}
