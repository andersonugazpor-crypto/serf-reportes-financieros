import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { Configuracion, Filial, FormatoDatos, Moneda, MONEDAS } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA } from '../core/utilidades';
import { CargandoComponent, ConfirmarComponent, EncabezadoComponent } from '../shared/ui.components';

/** Configuración centralizada (Singleton) y alta de filiales nuevas (escalabilidad). */
@Component({
  selector: 'serf-configuracion',
  imports: [FormsModule, ReactiveFormsModule, DatePipe, EncabezadoComponent, CargandoComponent, ConfirmarComponent],
  template: `
    <serf-encabezado titulo="Configuración corporativa" descripcion="Valores únicos para todo el sistema: tasas de cambio, políticas y filiales.">
      @if (esAdmin) {
        <button class="btn btn-outline-danger" (click)="confirmarReinicio.set(true)"><i class="bi bi-arrow-counterclockwise me-1"></i>Restablecer datos demo</button>
      }
    </serf-encabezado>

    @if (!config()) {
      <serf-cargando />
    } @else {
      @let c = config()!;
      <div class="alert alert-info small d-flex gap-2">
        <i class="bi bi-info-circle-fill"></i>
        <span>Esta configuración es una <strong>instancia única</strong> en el servidor (Singleton): un cambio aquí se aplica de inmediato a la consolidación y a todos los reportes. Última actualización: {{ c.actualizadoEn | date: 'dd/MM/yyyy HH:mm:ss' }}.</span>
      </div>

      <div class="row g-4">
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h2 class="h6 fw-semibold">Tasas de cambio hacia {{ c.politicas.monedaConsolidacion }}</h2>
              <p class="small text-body-secondary">Cuántos {{ c.politicas.monedaConsolidacion }} vale 1 unidad de cada moneda.</p>
              <table class="table table-sm align-middle mb-0">
                <tbody>
                  @for (m of monedas; track m) {
                    <tr>
                      <th class="fw-semibold">{{ m }}</th>
                      <td>
                        @if (esAdmin && m !== c.politicas.monedaConsolidacion) {
                          <div class="input-group input-group-sm">
                            <input type="number" step="0.00001" min="0" class="form-control" [attr.aria-label]="'Tasa ' + m" [(ngModel)]="tasas[m]">
                            <button class="btn btn-outline-primary" (click)="guardarTasa(m)" [disabled]="tasas[m] === c.tasasCambio[m]">Guardar</button>
                          </div>
                        } @else {
                          {{ c.tasasCambio[m] }}
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-lg-6 d-grid gap-4 align-content-start">
          <form class="card border-0 shadow-sm" [formGroup]="politicas" (ngSubmit)="guardarPoliticas()">
            <div class="card-body">
              <h2 class="h6 fw-semibold">Políticas corporativas</h2>
              <div class="row g-3">
                <div class="col-6"><label class="form-label small" for="stock">Stock mínimo (u.)</label><input id="stock" type="number" min="0" class="form-control" formControlName="stockMinimo"></div>
                <div class="col-6"><label class="form-label small" for="margen">Margen objetivo (%)</label><input id="margen" type="number" min="0" max="100" class="form-control" formControlName="margenObjetivo"></div>
                <div class="col-12"><label class="form-label small" for="aviso">Aviso legal de los reportes</label><textarea id="aviso" rows="3" class="form-control" formControlName="avisoLegal"></textarea></div>
              </div>
              @if (esAdmin) {
                <button class="btn btn-primary mt-3" type="submit" [disabled]="politicas.invalid || politicas.pristine">Guardar políticas</button>
              }
            </div>
          </form>

          @if (c.pool; as p) {
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h2 class="h6 fw-semibold">Pool de conexiones (Singleton)</h2>
                <div class="d-flex gap-2 mb-2">
                  @for (i of conexiones(p.total); track i) {
                    <span class="conexion" [class.ocupada]="i < p.ocupadas" [title]="'Conexión #' + (i + 1)"><i class="bi bi-database"></i></span>
                  }
                </div>
                <p class="small text-body-secondary mb-0">{{ p.total }} conexiones reutilizables · {{ p.libres }} libres · {{ p.prestamosRealizados }} préstamos atendidos desde el arranque.</p>
              </div>
            </div>
          }
        </div>

        <div class="col-12">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6 fw-semibold">Filiales</h2>
              <div class="table-responsive">
                <table class="table align-middle">
                  <thead class="table-light"><tr><th>Filial</th><th>Moneda</th><th>Formato de datos</th><th>Estado</th></tr></thead>
                  <tbody>
                    @for (f of filiales(); track f.codigo) {
                      <tr>
                        <td>{{ bandera[f.codigo] ?? '🏳️' }} {{ f.nombre }} <span class="small text-body-secondary">· {{ f.ciudad }}</span></td>
                        <td>{{ f.moneda }}</td>
                        <td><code>{{ f.formatoDatos }}</code></td>
                        <td>
                          @if (esAdmin) {
                            <div class="form-check form-switch mb-0">
                              <input class="form-check-input" type="checkbox" [id]="'act-' + f.codigo" [checked]="f.activa" (change)="cambiarEstado(f)">
                              <label class="form-check-label small" [for]="'act-' + f.codigo">{{ f.activa ? 'Activa' : 'Inactiva' }}</label>
                            </div>
                          } @else {
                            <span class="badge" [class]="f.activa ? 'text-bg-success' : 'text-bg-secondary'">{{ f.activa ? 'Activa' : 'Inactiva' }}</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (esAdmin) {
                <h3 class="h6 fw-semibold mt-3">Agregar una filial nueva</h3>
                <p class="small text-body-secondary">Una filial nueva solo necesita sus datos y un formato que tenga adaptador. Para países sin sistema propio, usa el formato <code>ESTANDAR</code>.</p>
                <form class="row g-2 align-items-end" [formGroup]="nueva" (ngSubmit)="crearFilial()">
                  <div class="col-4 col-md-1"><label class="form-label small" for="n-cod">Código</label><input id="n-cod" class="form-control text-uppercase" maxlength="2" formControlName="codigo" placeholder="CL"></div>
                  <div class="col-8 col-md-3"><label class="form-label small" for="n-nom">Nombre</label><input id="n-nom" class="form-control" formControlName="nombre" placeholder="FinanCorp Chile"></div>
                  <div class="col-6 col-md-2"><label class="form-label small" for="n-pais">País</label><input id="n-pais" class="form-control" formControlName="pais"></div>
                  <div class="col-6 col-md-2"><label class="form-label small" for="n-ciu">Ciudad</label><input id="n-ciu" class="form-control" formControlName="ciudad"></div>
                  <div class="col-4 col-md-1"><label class="form-label small" for="n-mon">Moneda</label>
                    <select id="n-mon" class="form-select" formControlName="moneda">@for (m of monedas; track m) { <option>{{ m }}</option> }</select></div>
                  <div class="col-4 col-md-1"><label class="form-label small" for="n-reg">Región</label>
                    <select id="n-reg" class="form-select" formControlName="region"><option>LATAM</option><option>EUROPA</option></select></div>
                  <div class="col-4 col-md-1"><label class="form-label small" for="n-fmt">Formato</label>
                    <select id="n-fmt" class="form-select" formControlName="formatoDatos">@for (f of formatos; track f) { <option>{{ f }}</option> }</select></div>
                  <div class="col-12 col-md-1 d-grid"><button class="btn btn-success" type="submit" [disabled]="nueva.invalid">Agregar</button></div>
                </form>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <serf-confirmar [abierto]="confirmarReinicio()" titulo="¿Restablecer los datos de demostración?" textoConfirmar="Restablecer" variante="warning"
                    mensaje="Se borrarán los cambios hechos (productos, ventas, filiales) y se cargarán de nuevo los datos de ejemplo."
                    (confirmado)="restablecer()" (cancelado)="confirmarReinicio.set(false)" />
  `,
  styles: `.conexion { width: 2.2rem; height: 2.2rem; border-radius: .5rem; display: inline-flex; align-items: center; justify-content: center;
    background: #dcfce7; color: #166534; } .conexion.ocupada { background: #fee2e2; color: #991b1b; }`,
})
export class ConfiguracionComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  protected readonly esAdmin = inject(SesionService).tieneRol('ADMIN');
  protected readonly bandera = BANDERA;
  protected readonly monedas = MONEDAS;
  protected readonly formatos: FormatoDatos[] = ['ESTANDAR', 'JSON_ES', 'CSV_MX', 'XML_PE', 'CSV_DE'];

  protected readonly config = signal<Configuracion | null>(null);
  protected readonly filiales = signal<Filial[]>([]);
  protected readonly confirmarReinicio = signal(false);
  protected tasas: Record<string, number> = {};

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly politicas = this.fb.group({
    stockMinimo: [15, [Validators.required, Validators.min(0)]],
    margenObjetivo: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
    avisoLegal: ['', [Validators.required, Validators.minLength(10)]],
  });
  protected readonly nueva = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    pais: ['', [Validators.required, Validators.minLength(3)]],
    ciudad: ['', [Validators.required, Validators.minLength(2)]],
    moneda: this.fb.control<Moneda>('CLP'),
    region: this.fb.control<'LATAM' | 'EUROPA'>('LATAM'),
    formatoDatos: this.fb.control<FormatoDatos>('ESTANDAR'),
  });

  ngOnInit(): void {
    this.cargar();
    if (!this.esAdmin) this.politicas.disable();
  }

  protected conexiones(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected guardarTasa(moneda: Moneda): void {
    this.api.actualizarTasa(moneda, Number(this.tasas[moneda])).subscribe({
      next: () => {
        this.notificaciones.exito(`Tasa de ${moneda} actualizada para todo el sistema.`);
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  protected guardarPoliticas(): void {
    const v = this.politicas.getRawValue();
    this.api.actualizarPoliticas({ stockMinimo: Number(v.stockMinimo), margenObjetivo: Number(v.margenObjetivo) / 100, avisoLegal: v.avisoLegal }).subscribe({
      next: () => {
        this.notificaciones.exito('Políticas actualizadas.');
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  protected cambiarEstado(f: Filial): void {
    this.api.estadoFilial(f.codigo, !f.activa).subscribe({
      next: () => this.cargar(),
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  protected crearFilial(): void {
    const v = this.nueva.getRawValue();
    this.api.crearFilial({ ...v, codigo: v.codigo.toUpperCase() }).subscribe({
      next: (f) => {
        this.notificaciones.exito(`Filial ${f.nombre} agregada. Ya puede integrar datos con el formato ${f.formatoDatos}.`);
        this.nueva.reset();
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  protected restablecer(): void {
    this.confirmarReinicio.set(false);
    this.api.restablecerDemo().subscribe({
      next: () => {
        this.notificaciones.info('Datos de demostración restablecidos.');
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  private cargar(): void {
    this.api.configuracion().subscribe((c) => {
      this.config.set(c);
      this.tasas = { ...c.tasasCambio };
      this.politicas.reset({ stockMinimo: c.politicas.stockMinimo, margenObjetivo: Math.round(c.politicas.margenObjetivo * 100), avisoLegal: c.politicas.avisoLegal });
    });
    this.api.filiales().subscribe((f) => this.filiales.set(f));
  }
}
