import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { Plantilla, TipoReporte } from '../core/modelos';
import { BANDERA } from '../core/utilidades';
import { CargandoComponent, EncabezadoComponent } from '../shared/ui.components';

/** Muestra cómo se obtienen las plantillas de cada país clonando 4 plantillas base (Prototype). */
@Component({
  selector: 'serf-plantillas',
  imports: [EncabezadoComponent, CargandoComponent],
  template: `
    <serf-encabezado titulo="Plantillas de reporte" descripcion="Cuatro plantillas base que se clonan y adaptan a cada país, sin crearlas desde cero." />

    @if (!bases().length) {
      <serf-cargando />
    } @else {
      <div class="d-flex flex-wrap gap-2 mb-4" role="tablist">
        @for (b of bases(); track b.tipo) {
          <button class="btn" [class]="tipo() === b.tipo ? 'btn-primary' : 'btn-outline-primary'" (click)="tipo.set(b.tipo)">{{ b.nombre }}</button>
        }
      </div>

      <div class="row g-4">
        <div class="col-lg-4">
          @if (base(); as b) {
            <div class="card border-0 shadow-sm h-100 border-start border-4 border-primary">
              <div class="card-body">
                <span class="badge text-bg-primary mb-2">PLANTILLA BASE (prototipo)</span>
                <h2 class="h5">{{ b.nombre }}</h2>
                <p class="small text-body-secondary">Estructura jerárquica que heredan todas las copias:</p>
                <ul class="list-unstyled small estructura">
                  @for (s of b.secciones; track $index) { <li><i class="bi bi-folder2 me-1 text-primary"></i>{{ s }}</li> }
                </ul>
              </div>
            </div>
          }
        </div>
        <div class="col-lg-8">
          <div class="row g-3">
            @for (v of variantes(); track v.id) {
              <div class="col-md-6">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body">
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <span class="fs-4">{{ bandera[v.ambito] }}</span>
                      <div class="flex-grow-1"><div class="fw-semibold">{{ v.nombre }}</div><code class="small">{{ v.id }}</code></div>
                      <span class="badge text-bg-light border">clon</span>
                    </div>
                    <dl class="small mb-0">
                      <dt class="fw-normal text-body-secondary">Normativa</dt><dd>{{ v.normativa }}</dd>
                      <dt class="fw-normal text-body-secondary">Formato regional</dt><dd>{{ v.locale }} · ej. {{ ejemplo(v.locale) }}</dd>
                      <dt class="fw-normal text-body-secondary">Textos legales</dt>
                      <dd class="mb-0">@for (t of v.textosLegales; track $index) { <div>• {{ t }}</div> }</dd>
                    </dl>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `.estructura li { padding: .2rem 0; white-space: pre; }`,
})
export class PlantillasComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly bandera = BANDERA;
  protected readonly bases = signal<Plantilla[]>([]);
  protected readonly todas = signal<Plantilla[]>([]);
  protected readonly tipo = signal<TipoReporte>('EJECUTIVO');

  protected readonly base = computed(() => this.bases().find((b) => b.tipo === this.tipo()));
  protected readonly variantes = computed(() => this.todas().filter((v) => v.tipo === this.tipo()));

  ngOnInit(): void {
    this.api.plantillas().subscribe((p) => {
      this.bases.set(p.bases);
      this.todas.set(p.variantes);
    });
  }

  protected ejemplo(locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234567.89);
  }
}
