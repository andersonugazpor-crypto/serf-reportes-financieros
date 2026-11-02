import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { DatosConsolidados, Filial, TipoReporte } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA, haceDiasISO, hoyISO } from '../core/utilidades';
import { CifraPipe } from '../shared/cifra.pipe';
import { GraficoComponent } from '../shared/grafico.component';
import { CargandoComponent, EncabezadoComponent, KpiComponent, VacioComponent } from '../shared/ui.components';

type Rango = '30' | '90' | '180';

@Component({
  selector: 'serf-panel',
  imports: [FormsModule, RouterLink, CifraPipe, GraficoComponent, EncabezadoComponent, KpiComponent, CargandoComponent, VacioComponent],
  templateUrl: './panel.component.html',
})
export class PanelComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionService);
  protected readonly sesion = inject(SesionService);
  protected readonly bandera = BANDERA;

  protected readonly rango = signal<Rango>('90');
  protected readonly filiales = signal<Filial[]>([]);
  protected readonly seleccion = signal<string[]>([]);
  protected readonly datos = signal<DatosConsolidados | null>(null);
  protected readonly cargando = signal(true);
  protected readonly generando = signal<TipoReporte | null>(null);

  private readonly cifra = new CifraPipe();
  protected readonly kpis = computed(() => {
    const d = this.datos();
    if (!d) return [];
    return [
      { etiqueta: 'Ingresos consolidados', valor: this.cifra.transform(d.totales.ingresos, 'moneda', d.moneda), icono: 'bi-cash-coin', color: 'primary', detalle: `${d.totales.transacciones} transacciones` },
      {
        etiqueta: 'Margen bruto',
        valor: this.cifra.transform(d.totales.margenPct, 'porcentaje'),
        icono: 'bi-graph-up-arrow',
        color: d.totales.margenPct < d.margenObjetivo ? 'danger' : 'success',
        detalle: `${this.cifra.transform(d.totales.margen, 'moneda', d.moneda)} · objetivo ${this.cifra.transform(d.margenObjetivo, 'porcentaje')}`,
        alerta: d.totales.margenPct < d.margenObjetivo,
      },
      { etiqueta: 'Unidades vendidas', valor: this.cifra.transform(d.totales.unidades, 'numero'), icono: 'bi-bag-check', color: 'info', detalle: `Ticket promedio ${this.cifra.transform(d.totales.ticketPromedio, 'moneda', d.moneda)}` },
      {
        etiqueta: 'Inventario a costo',
        valor: this.cifra.transform(d.inventario.valorTotal, 'moneda', d.moneda),
        icono: 'bi-boxes',
        color: d.inventario.criticos.length ? 'warning' : 'secondary',
        detalle: `${d.inventario.criticos.length} producto(s) con stock crítico`,
        alerta: d.inventario.criticos.length > 0,
      },
    ];
  });

  /** El mes actual aún no termina: se marca para no confundirlo con una caída de ventas. */
  protected readonly serieMes = computed(() => {
    const actual = hoyISO().slice(0, 7);
    return (this.datos()?.porMes ?? []).map((m) => ({
      etiqueta: m.periodo === actual ? `${m.periodo} (en curso)` : m.periodo,
      valor: m.ingresos,
    }));
  });
  protected readonly serieCategoria = computed(() =>
    (this.datos()?.porCategoria ?? []).map((c) => ({ etiqueta: c.etiqueta, valor: c.ingresos })),
  );

  protected readonly saludo = computed(() => {
    const h = new Date().getHours();
    return `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${this.sesion.usuario()?.nombre.split(' ')[0] ?? ''}`;
  });

  ngOnInit(): void {
    this.api.filiales(true).subscribe((f) => {
      const propias = this.sesion.usuario()?.rol === 'FILIAL' ? f.filter((x) => x.codigo === this.sesion.usuario()?.filial) : f;
      this.filiales.set(propias);
      this.seleccion.set(propias.map((x) => x.codigo));
      this.cargar();
    });
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    this.cargar();
  }

  protected alternarFilial(codigo: string): void {
    const actual = this.seleccion();
    const nueva = actual.includes(codigo) ? actual.filter((c) => c !== codigo) : [...actual, codigo];
    if (!nueva.length) {
      this.notificaciones.advertencia('Debe quedar al menos una filial seleccionada.');
      return;
    }
    this.seleccion.set(nueva);
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.api.panel(haceDiasISO(Number(this.rango())), hoyISO(), this.seleccion()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }

  /** Usa la interfaz simple (Facade): un clic → reporte del último mes listo para enviar. */
  protected reporteRapido(tipo: TipoReporte): void {
    this.generando.set(tipo);
    this.api.reporteRapido(tipo).subscribe({
      next: (r) => {
        this.generando.set(null);
        this.notificaciones.exito('Reporte generado y firmado.');
        void this.router.navigate(['/reportes'], { queryParams: { id: r.id } });
      },
      error: (e) => {
        this.generando.set(null);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }
}
