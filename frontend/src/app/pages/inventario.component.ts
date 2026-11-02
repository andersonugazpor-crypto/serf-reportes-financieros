import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { ETIQUETA_CATEGORIA, Filial, FilaInventario, Producto } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA } from '../core/utilidades';
import { CifraPipe } from '../shared/cifra.pipe';
import { CargandoComponent, EncabezadoComponent, KpiComponent, VacioComponent } from '../shared/ui.components';

@Component({
  selector: 'serf-inventario',
  imports: [ReactiveFormsModule, CifraPipe, EncabezadoComponent, CargandoComponent, VacioComponent, KpiComponent],
  template: `
    <serf-encabezado titulo="Inventario por filial" descripcion="Existencias actuales y productos que necesitan una nueva importación.">
      @if (puedeIngresar) {
        <button class="btn btn-primary" (click)="ingresoAbierto.set(!ingresoAbierto())"><i class="bi bi-box-arrow-in-down me-1"></i>Registrar ingreso</button>
      }
    </serf-encabezado>

    @if (ingresoAbierto()) {
      <form class="card border-0 shadow-sm mb-4" [formGroup]="form" (ngSubmit)="ingresar()">
        <div class="card-body row g-3 align-items-end">
          <div class="col-md-3">
            <label class="form-label" for="i-filial">Filial</label>
            <select id="i-filial" class="form-select" formControlName="filialCodigo">
              @for (f of filiales(); track f.codigo) { <option [value]="f.codigo">{{ bandera[f.codigo] }} {{ f.nombre }}</option> }
            </select>
          </div>
          <div class="col-md-5">
            <label class="form-label" for="i-sku">Producto recibido</label>
            <select id="i-sku" class="form-select" formControlName="sku">
              <option value="" disabled>Selecciona…</option>
              @for (p of productos(); track p.sku) { <option [value]="p.sku">{{ p.sku }} — {{ p.nombre }}</option> }
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="i-unidades">Unidades</label>
            <input id="i-unidades" type="number" min="1" class="form-control" formControlName="unidades">
          </div>
          <div class="col-md-2 d-grid"><button class="btn btn-success" type="submit" [disabled]="form.invalid">Registrar</button></div>
        </div>
      </form>
    }

    <div class="row g-3 mb-4">
      <div class="col-sm-4"><serf-kpi etiqueta="Unidades en stock" [valor]="(totales().unidades | cifra)" icono="bi-boxes" /></div>
      <div class="col-sm-4"><serf-kpi etiqueta="Valor a costo" [valor]="(totales().valor | cifra: 'moneda' : 'EUR')" icono="bi-currency-euro" color="success" /></div>
      <div class="col-sm-4"><serf-kpi etiqueta="Stock crítico" [valor]="totales().criticos + ''" icono="bi-exclamation-triangle" color="danger" [alerta]="totales().criticos > 0" detalle="Productos bajo el mínimo corporativo" /></div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body d-flex flex-wrap gap-2 border-bottom">
        @if (!esFilial) {
          <button class="btn btn-sm rounded-pill" [class]="!filtroFilial() ? 'btn-dark' : 'btn-outline-secondary'" (click)="filtroFilial.set(null)">Todas</button>
          @for (f of filiales(); track f.codigo) {
            <button class="btn btn-sm rounded-pill" [class]="filtroFilial() === f.codigo ? 'btn-dark' : 'btn-outline-secondary'" (click)="filtroFilial.set(f.codigo)">{{ bandera[f.codigo] }} {{ f.codigo }}</button>
          }
        }
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input" type="checkbox" id="solo-criticos" [checked]="soloCriticos()" (change)="soloCriticos.set(!soloCriticos())">
          <label class="form-check-label small" for="solo-criticos">Solo stock crítico</label>
        </div>
      </div>
      @if (cargando()) {
        <serf-cargando />
      } @else if (visibles().length) {
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light"><tr><th>Filial</th><th>Producto</th><th class="text-end">Unidades</th><th class="text-end d-none d-md-table-cell">Valor a costo</th></tr></thead>
            <tbody>
              @for (f of visibles(); track f.filialCodigo + f.sku) {
                <tr [class.table-danger]="f.critico">
                  <td class="text-nowrap">{{ bandera[f.filialCodigo] }} {{ f.filialCodigo }}</td>
                  <td><div class="fw-semibold">{{ f.producto }}</div><div class="small text-body-secondary"><code>{{ f.sku }}</code> · {{ etiquetas[f.categoria] }}</div></td>
                  <td class="text-end">
                    @if (f.critico) { <i class="bi bi-exclamation-triangle-fill text-danger me-1" title="Stock crítico"></i> }
                    <span class="fw-semibold">{{ f.cantidad }}</span>
                  </td>
                  <td class="text-end d-none d-md-table-cell">{{ f.valorCostoEur | cifra: 'moneda' : 'EUR' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <serf-vacio icono="bi-check2-circle" titulo="No hay registros con ese filtro" />
      }
    </div>
  `,
})
export class InventarioComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly sesion = inject(SesionService);
  protected readonly bandera = BANDERA;
  protected readonly etiquetas = ETIQUETA_CATEGORIA;
  protected readonly esFilial = this.sesion.tieneRol('FILIAL');
  protected readonly puedeIngresar = this.sesion.tieneRol('ADMIN', 'FILIAL');

  protected readonly filas = signal<FilaInventario[]>([]);
  protected readonly filiales = signal<Filial[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly cargando = signal(true);
  protected readonly filtroFilial = signal<string | null>(null);
  protected readonly soloCriticos = signal(false);
  protected readonly ingresoAbierto = signal(false);

  protected readonly visibles = computed(() =>
    this.filas().filter((f) => (!this.filtroFilial() || f.filialCodigo === this.filtroFilial()) && (!this.soloCriticos() || f.critico)),
  );
  protected readonly totales = computed(() => {
    const v = this.visibles();
    return { unidades: v.reduce((s, f) => s + f.cantidad, 0), valor: v.reduce((s, f) => s + f.valorCostoEur, 0), criticos: v.filter((f) => f.critico).length };
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    filialCodigo: ['', Validators.required],
    sku: ['', Validators.required],
    unidades: [10, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.api.filiales(true).subscribe((f) => {
      const u = this.sesion.usuario();
      const propias = u?.rol === 'FILIAL' ? f.filter((x) => x.codigo === u.filial) : f;
      this.filiales.set(propias);
      this.form.controls.filialCodigo.setValue(propias[0]?.codigo ?? '');
    });
    this.api.productos().subscribe((p) => this.productos.set(p.filter((x) => x.activo)));
    this.cargar();
  }

  protected ingresar(): void {
    const v = this.form.getRawValue();
    this.api.ingresarStock(v.filialCodigo, v.sku, Number(v.unidades)).subscribe({
      next: () => {
        this.notificaciones.exito(`Ingreso registrado: ${v.unidades} u. de ${v.sku} en ${v.filialCodigo}.`);
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  private cargar(): void {
    this.api.inventario().subscribe({
      next: (f) => {
        this.filas.set(f);
        this.cargando.set(false);
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }
}
