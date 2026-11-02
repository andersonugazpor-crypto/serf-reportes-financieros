import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { Filial, FormatoAdaptador, ResultadoImportacion, VistaPreviaImportacion } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA } from '../core/utilidades';
import { CifraPipe } from '../shared/cifra.pipe';
import { EncabezadoComponent } from '../shared/ui.components';

/**
 * Integración de datos (requisito 1). Cada filial sube el archivo de SU sistema;
 * en el backend el adaptador correspondiente lo convierte al formato estándar.
 */
@Component({
  selector: 'serf-integracion',
  imports: [FormsModule, CifraPipe, EncabezadoComponent],
  template: `
    <serf-encabezado titulo="Integrar datos de filiales" descripcion="Sube el archivo que exporta el sistema local de la filial: SERF lo convierte al formato corporativo." />

    <div class="row g-4">
      <div class="col-lg-5">
        <div class="card border-0 shadow-sm">
          <div class="card-body p-4">
            <h2 class="h6 fw-semibold"><span class="badge rounded-pill text-bg-primary me-2">1</span>Filial de origen</h2>
            <div class="d-grid gap-2 mb-4">
              @for (f of filiales(); track f.codigo) {
                <button type="button" class="btn text-start d-flex gap-2 align-items-center" [class]="filial()?.codigo === f.codigo ? 'btn-primary' : 'btn-outline-secondary'" (click)="elegir(f)">
                  <span class="fs-5">{{ bandera[f.codigo] }}</span>
                  <span class="flex-grow-1">{{ f.nombre }}<small class="d-block opacity-75">Formato {{ f.formatoDatos }} · {{ f.moneda }}</small></span>
                </button>
              }
            </div>
            @if (formato(); as fmt) {
              <h2 class="h6 fw-semibold"><span class="badge rounded-pill text-bg-primary me-2">2</span>Formato esperado</h2>
              <p class="small text-body-secondary mb-2">{{ fmt.descripcion }}</p>
              <pre class="ejemplo small mb-2">{{ fmt.ejemplo }}</pre>
              <button type="button" class="btn btn-sm btn-light" (click)="cargarEjemplo()"><i class="bi bi-clipboard-plus me-1"></i>Usar este ejemplo</button>
            }
          </div>
        </div>
      </div>

      <div class="col-lg-7 d-grid gap-4 align-content-start">
        <div class="card border-0 shadow-sm">
          <div class="card-body p-4">
            <h2 class="h6 fw-semibold"><span class="badge rounded-pill text-bg-primary me-2">3</span>Archivo de la filial</h2>
            <input type="file" class="form-control mb-2" accept=".json,.csv,.xml,.txt" (change)="leerArchivo($event)" [disabled]="!filial()">
            <textarea class="form-control font-monospace small" rows="9" placeholder="…o pega aquí el contenido del archivo" [(ngModel)]="contenido" [disabled]="!filial()" aria-label="Contenido del archivo"></textarea>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-outline-primary" [disabled]="!puedeEnviar()" (click)="previsualizar()"><i class="bi bi-eye me-1"></i>Previsualizar</button>
              <button class="btn btn-success" [disabled]="!puedeEnviar() || !vista()" (click)="importar()"><i class="bi bi-cloud-arrow-up me-1"></i>Importar</button>
            </div>
            @if (!vista() && contenido) {
              <p class="small text-body-secondary mt-2 mb-0">Primero previsualiza para revisar cómo se interpretó el archivo.</p>
            }
          </div>
        </div>

        @if (vista(); as v) {
          <div class="card border-0 shadow-sm">
            <div class="card-body p-4">
              <h2 class="h6 fw-semibold">Vista previa en formato estándar</h2>
              <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="badge text-bg-primary">{{ v.ventas.length }} venta(s)</span>
                <span class="badge text-bg-info">{{ v.inventario.length }} existencia(s)</span>
                @if (v.advertencias.length) { <span class="badge text-bg-warning">{{ v.advertencias.length }} advertencia(s)</span> }
                @if (v.skusDesconocidos.length) { <span class="badge text-bg-danger">SKU no registrados: {{ v.skusDesconocidos.join(', ') }}</span> }
              </div>
              @if (v.ventas.length) {
                <div class="table-responsive">
                  <table class="table table-sm mb-3">
                    <thead class="table-light"><tr><th>Referencia</th><th>Fecha</th><th>SKU</th><th class="text-end">Cant.</th><th class="text-end">Precio</th></tr></thead>
                    <tbody>
                      @for (x of v.ventas.slice(0, 20); track x.referencia) {
                        <tr [class.table-danger]="v.skusDesconocidos.includes(x.sku)">
                          <td class="small">{{ x.referencia }}</td><td class="small">{{ x.fecha }}</td><td><code>{{ x.sku }}</code></td>
                          <td class="text-end">{{ x.cantidad }}</td><td class="text-end">{{ x.precioUnitario | cifra: 'moneda' : x.moneda }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @for (a of v.advertencias; track $index) { <div class="small text-warning-emphasis"><i class="bi bi-exclamation-triangle me-1"></i>{{ a }}</div> }
            </div>
          </div>
        }

        @if (resultado(); as r) {
          <div class="alert alert-success mb-0">
            <h2 class="h6 alert-heading"><i class="bi bi-check-circle-fill me-1"></i>Importación completada ({{ r.filial }} · {{ r.formato }})</h2>
            <ul class="mb-0 small">
              <li>{{ r.ventasImportadas }} venta(s) nuevas integradas</li>
              <li>{{ r.ventasDuplicadas }} venta(s) duplicadas omitidas (ya estaban registradas)</li>
              <li>{{ r.stocksActualizados }} existencia(s) actualizadas</li>
              @for (a of r.advertencias; track $index) { <li class="text-warning-emphasis">{{ a }}</li> }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  styles: `.ejemplo { background: #0f172a; color: #e2e8f0; padding: .75rem; border-radius: .5rem; max-height: 220px; overflow: auto; white-space: pre; }`,
})
export class IntegracionComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly sesion = inject(SesionService);
  protected readonly bandera = BANDERA;

  protected readonly filiales = signal<Filial[]>([]);
  protected readonly formatos = signal<FormatoAdaptador[]>([]);
  protected readonly filial = signal<Filial | null>(null);
  protected readonly vista = signal<VistaPreviaImportacion | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);
  protected readonly enviando = signal(false);
  protected contenido = '';

  protected readonly formato = computed(() => this.formatos().find((f) => f.formato === this.filial()?.formatoDatos) ?? null);
  protected readonly puedeEnviar = () => !!this.filial() && this.contenido.trim().length > 5 && !this.enviando();

  ngOnInit(): void {
    this.api.formatos().subscribe((f) => this.formatos.set(f));
    this.api.filiales(true).subscribe((f) => {
      const u = this.sesion.usuario();
      const propias = u?.rol === 'FILIAL' ? f.filter((x) => x.codigo === u.filial) : f;
      this.filiales.set(propias);
      if (propias.length === 1) this.elegir(propias[0]);
    });
  }

  protected elegir(f: Filial): void {
    this.filial.set(f);
    this.contenido = '';
    this.vista.set(null);
    this.resultado.set(null);
  }

  protected cargarEjemplo(): void {
    this.contenido = this.formato()?.ejemplo ?? '';
    this.vista.set(null);
  }

  protected async leerArchivo(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    if (archivo.size > 2_000_000) return this.notificaciones.advertencia('El archivo supera 2 MB.');
    this.contenido = await archivo.text();
    this.vista.set(null);
  }

  protected previsualizar(): void {
    const f = this.filial();
    if (!f) return;
    this.enviando.set(true);
    this.resultado.set(null);
    this.api.previsualizarImportacion(f.codigo, this.contenido).subscribe({
      next: (v) => {
        this.enviando.set(false);
        this.vista.set(v);
      },
      error: (e) => {
        this.enviando.set(false);
        this.vista.set(null);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }

  protected importar(): void {
    const f = this.filial();
    if (!f) return;
    this.enviando.set(true);
    this.api.importar(f.codigo, this.contenido).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.resultado.set(r);
        this.vista.set(null);
        this.notificaciones.exito(`Se integraron ${r.ventasImportadas} venta(s) de ${f.nombre}.`);
      },
      error: (e) => {
        this.enviando.set(false);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }
}
