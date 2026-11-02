import { Component, input } from '@angular/core';
import { ColumnaTabla, NodoReporte } from '../core/modelos';
import { CifraPipe } from './cifra.pipe';
import { GraficoComponent } from './grafico.component';

/**
 * Dibuja cualquier nodo del árbol de un reporte.
 * Es RECURSIVO: una sección vuelve a usar este mismo componente para sus hijos,
 * por lo que la vista soporta la jerarquía ilimitada del patrón Composite.
 */
@Component({
  selector: 'serf-nodo-reporte',
  imports: [CifraPipe, GraficoComponent, NodoReporteComponent],
  template: `
    @let n = nodo();
    @switch (n.tipo) {
      @case ('seccion') {
        <section class="seccion" [class.raiz]="n.nivel === 1" [attr.data-nivel]="n.nivel">
          @if (n.nivel > 1) {
            <div class="titulo-seccion" [style.--nivel]="n.nivel">
              <span class="badge rounded-pill text-bg-light border me-2">N{{ n.nivel - 1 }}</span>{{ n.titulo }}
            </div>
          }
          <div class="contenido" [class.anidado]="n.nivel > 2">
            @for (hijo of n.hijos; track hijo.id) {
              <serf-nodo-reporte [nodo]="hijo" [moneda]="moneda()" [locale]="locale()" />
            }
          </div>
        </section>
      }
      @case ('parrafo') {
        <p class="parrafo" [class]="'estilo-' + n.estilo">
          @if (n.estilo === 'alerta') {
            <i class="bi bi-exclamation-triangle-fill me-1"></i>
          } @else if (n.estilo === 'nota') {
            <i class="bi bi-info-circle me-1"></i>
          }
          {{ n.texto }}
        </p>
      }
      @case ('indicador') {
        <div class="kpi" [class.alerta]="n.alerta">
          <small>{{ n.etiqueta }}</small>
          <strong>{{ n.valor | cifra: n.formato : n.moneda ?? moneda() : true : locale() }}</strong>
          @if (n.detalle) {
            <em>{{ n.detalle }}</em>
          }
        </div>
      }
      @case ('tabla') {
        <div class="table-responsive my-3">
          <table class="table table-sm align-middle mb-0">
            <caption class="caption-top fw-semibold text-body">{{ n.titulo }}</caption>
            <thead class="table-light">
              <tr>
                @for (c of n.columnas; track $index) {
                  <th [class.text-end]="c.formato !== 'texto'">{{ c.titulo }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (fila of n.filas; track $index) {
                <tr>
                  @for (celda of fila; track $index; let i = $index) {
                    <td [class.text-end]="n.columnas[i].formato !== 'texto'">{{ formatear(celda, n.columnas[i]) }}</td>
                  }
                </tr>
              }
            </tbody>
            @if (n.totales) {
              <tfoot>
                <tr class="fw-bold">
                  @for (celda of n.totales; track $index; let i = $index) {
                    <td [class.text-end]="n.columnas[i].formato !== 'texto'">{{ formatear(celda, n.columnas[i]) }}</td>
                  }
                </tr>
              </tfoot>
            }
          </table>
        </div>
      }
      @case ('grafico') {
        <div class="grafico my-3 p-3 border rounded-3">
          <serf-grafico [titulo]="n.titulo" [tipo]="n.tipoGrafico" [serie]="n.serie" [unidad]="n.unidad" [moneda]="moneda()" />
        </div>
      }
    }
  `,
  styles: `
    :host { display: contents; }
    .seccion:not(.raiz) { margin: 1rem 0; }
    .titulo-seccion { font-weight: 700; color: #1e3a8a; font-size: calc(1.25rem - var(--nivel) * .1rem); padding-bottom: .35rem;
      border-bottom: 1px solid var(--bs-border-color); margin-bottom: .75rem; }
    .contenido.anidado { border-left: 3px solid rgba(30, 58, 138, .15); padding-left: 1rem; }
    .parrafo { margin-bottom: .6rem; }
    .estilo-nota { color: var(--bs-secondary-color); font-size: .875rem; }
    .estilo-alerta { color: #991b1b; background: #fef2f2; padding: .5rem .75rem; border-radius: .5rem; }
    .kpi { display: inline-flex; flex-direction: column; min-width: 170px; border: 1px solid var(--bs-border-color); border-radius: .75rem;
      padding: .65rem .9rem; margin: 0 .5rem .5rem 0; vertical-align: top; background: var(--bs-body-bg); }
    .kpi small { color: var(--bs-secondary-color); } .kpi strong { font-size: 1.25rem; } .kpi em { font-size: .75rem; color: var(--bs-secondary-color); }
    .kpi.alerta { border-color: #dc2626; background: #fef2f2; }
  `,
})
export class NodoReporteComponent {
  readonly nodo = input.required<NodoReporte>();
  readonly moneda = input('EUR');
  readonly locale = input('es-ES');

  private readonly cifra = new CifraPipe();

  protected formatear(valor: string | number, columna: ColumnaTabla): string {
    if (typeof valor === 'string') return valor;
    switch (columna.formato) {
      case 'moneda':
        return this.cifra.transform(valor, 'moneda', this.moneda(), false, this.locale());
      case 'porcentaje':
        return this.cifra.transform(valor, 'porcentaje', '', true, this.locale());
      default:
        return this.cifra.transform(valor, 'numero', '', false, this.locale());
    }
  }
}
