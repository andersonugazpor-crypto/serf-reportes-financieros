import { Component, computed, input } from '@angular/core';
import { CifraPipe } from './cifra.pipe';

export interface PuntoGrafico {
  etiqueta: string;
  valor: number;
}

const PALETA = ['#1e3a8a', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#0284c7', '#65a30d', '#dc2626'];

/**
 * Gráfico liviano sin librerías (barras, línea o torta).
 * Se reutiliza en el panel y para dibujar los nodos "grafico" de los reportes.
 */
@Component({
  selector: 'serf-grafico',
  imports: [CifraPipe],
  template: `
    @if (titulo()) {
      <h3 class="h6 fw-semibold mb-3">{{ titulo() }}</h3>
    }
    @if (!serie().length) {
      <p class="text-body-secondary small mb-0">Sin datos para graficar.</p>
    } @else {
      @switch (tipo()) {
        @case ('barras') {
          <div class="d-grid gap-2" role="list">
            @for (p of serie(); track p.etiqueta; let i = $index) {
              <div class="barra" role="listitem">
                <span class="text-truncate small" [title]="p.etiqueta">{{ p.etiqueta }}</span>
                <div class="pista"><div class="relleno" [style.width.%]="porcentaje(p.valor)" [style.background]="color(i)"></div></div>
                <span class="small fw-semibold text-end">{{ p.valor | cifra: formatoValor() : moneda() : esPorcentaje() }}</span>
              </div>
            }
          </div>
        }
        @case ('linea') {
          <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" class="w-100 linea" role="img" [attr.aria-label]="titulo() || 'Gráfico de línea'">
            @for (g of guias(); track g) {
              <line [attr.x1]="m" [attr.x2]="ancho - m" [attr.y1]="g" [attr.y2]="g" class="guia" />
            }
            <polygon [attr.points]="area()" class="area" />
            <polyline [attr.points]="linea()" class="trazo" />
            @for (p of puntos(); track p.etiqueta) {
              <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" class="punto">
                <title>{{ p.etiqueta }}: {{ p.valor | cifra: formatoValor() : moneda() }}</title>
              </circle>
              <text [attr.x]="p.x" [attr.y]="alto - 4" text-anchor="middle" class="eje">{{ p.etiqueta }}</text>
            }
          </svg>
        }
        @case ('torta') {
          <div class="d-flex flex-wrap align-items-center gap-4">
            <div class="dona" [style.background]="gradiente()" role="img" [attr.aria-label]="titulo() || 'Gráfico de torta'"></div>
            <ul class="list-unstyled small mb-0 flex-grow-1">
              @for (p of serie(); track p.etiqueta; let i = $index) {
                <li class="d-flex align-items-center gap-2 mb-1">
                  <span class="muestra" [style.background]="color(i)"></span>
                  <span class="flex-grow-1">{{ p.etiqueta }}</span>
                  <span class="fw-semibold">{{ participacion(p.valor) | cifra: 'porcentaje' }}</span>
                </li>
              }
            </ul>
          </div>
        }
      }
    }
  `,
  styles: `
    .barra { display: grid; grid-template-columns: minmax(80px, 30%) 1fr auto; gap: .75rem; align-items: center; }
    .pista { background: var(--bs-tertiary-bg); height: .7rem; border-radius: 1rem; overflow: hidden; }
    .relleno { height: 100%; border-radius: 1rem; transition: width .4s; }
    .linea { max-height: 240px; overflow: visible; }
    .guia { stroke: var(--bs-border-color); stroke-dasharray: 3 4; }
    .area { fill: rgba(30, 58, 138, .08); }
    .trazo { fill: none; stroke: #1e3a8a; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
    .punto { fill: #fff; stroke: #1e3a8a; stroke-width: 2.5; }
    .eje { font-size: 11px; fill: var(--bs-secondary-color); }
    .dona { width: 150px; height: 150px; border-radius: 50%; position: relative; flex-shrink: 0;
      mask: radial-gradient(circle, transparent 46%, #000 47%); -webkit-mask: radial-gradient(circle, transparent 46%, #000 47%); }
    .muestra { width: .75rem; height: .75rem; border-radius: .2rem; flex-shrink: 0; }
  `,
})
export class GraficoComponent {
  readonly titulo = input('');
  readonly tipo = input<'barras' | 'linea' | 'torta'>('barras');
  readonly serie = input<PuntoGrafico[]>([]);
  readonly unidad = input('');
  readonly moneda = input('EUR');

  protected readonly ancho = 600;
  protected readonly alto = 220;
  protected readonly m = 28;

  protected readonly esPorcentaje = computed(() => this.unidad() === '%');
  protected readonly formatoValor = computed(() =>
    this.esPorcentaje() ? 'porcentaje' : this.unidad() && this.unidad().length === 3 ? 'moneda' : 'numero',
  );
  private readonly maximo = computed(() => Math.max(1, ...this.serie().map((p) => Math.abs(p.valor))));
  private readonly total = computed(() => this.serie().reduce((s, p) => s + Math.max(0, p.valor), 0) || 1);

  protected readonly puntos = computed(() => {
    const s = this.serie();
    const paso = s.length > 1 ? (this.ancho - this.m * 2) / (s.length - 1) : 0;
    return s.map((p, i) => ({
      ...p,
      x: s.length > 1 ? this.m + i * paso : this.ancho / 2,
      y: this.alto - this.m - (Math.max(0, p.valor) / this.maximo()) * (this.alto - this.m * 2),
    }));
  });
  protected readonly linea = computed(() => this.puntos().map((p) => `${p.x},${p.y}`).join(' '));
  protected readonly area = computed(() => {
    const p = this.puntos();
    if (!p.length) return '';
    return `${p[0].x},${this.alto - this.m} ${this.linea()} ${p[p.length - 1].x},${this.alto - this.m}`;
  });
  protected readonly guias = computed(() => [0, 0.5, 1].map((f) => this.m + f * (this.alto - this.m * 2)));
  protected readonly gradiente = computed(() => {
    let acumulado = 0;
    const tramos = this.serie().map((p, i) => {
      const inicio = acumulado;
      acumulado += (Math.max(0, p.valor) / this.total()) * 100;
      return `${this.color(i)} ${inicio}% ${acumulado}%`;
    });
    return `conic-gradient(${tramos.join(', ')})`;
  });

  protected porcentaje(valor: number): number {
    return (Math.abs(valor) / this.maximo()) * 100;
  }
  protected participacion(valor: number): number {
    return Math.max(0, valor) / this.total();
  }
  protected color(i: number): string {
    return PALETA[i % PALETA.length];
  }
}
