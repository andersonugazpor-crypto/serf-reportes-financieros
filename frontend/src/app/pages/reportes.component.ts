import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { DocumentoReporte, Filial, FormatoExportacion, ItemHistorial, NivelConfidencialidad, TipoReporte } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { BANDERA, descargarTexto, mesAnterior } from '../core/utilidades';
import { NodoReporteComponent } from '../shared/nodo-reporte.component';
import { EncabezadoComponent, VacioComponent } from '../shared/ui.components';

type Pestana = 'generar' | 'historial' | 'verificar';

interface InfoTipo {
  tipo: TipoReporte;
  titulo: string;
  descripcion: string;
  icono: string;
}

/**
 * Generador de reportes en 3 pasos + vista del resultado.
 * La página solo llama a la API; toda la construcción (Prototype, Builder,
 * Composite, Decorator, Facade) ocurre en el backend.
 */
@Component({
  selector: 'serf-reportes',
  imports: [ReactiveFormsModule, DatePipe, NgTemplateOutlet, NodoReporteComponent, EncabezadoComponent, VacioComponent],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  protected readonly sesion = inject(SesionService);
  protected readonly bandera = BANDERA;

  /** Query param ?id= para abrir un reporte recién generado. */
  readonly id = input<string>();

  protected readonly pestana = signal<Pestana>('generar');
  protected readonly paso = signal(1);
  protected readonly filiales = signal<Filial[]>([]);
  protected readonly generando = signal(false);
  protected readonly documento = signal<DocumentoReporte | null>(null);
  protected readonly resumen = signal<{ elementos: number; secciones: number } | null>(null);
  protected readonly historial = signal<ItemHistorial[]>([]);
  protected readonly verVista = signal<'documento' | 'estructura'>('documento');
  protected readonly verificacion = signal<{ valido: boolean; mensaje: string } | null>(null);

  protected readonly tipos: InfoTipo[] = [
    { tipo: 'EJECUTIVO', titulo: 'Financiero ejecutivo', descripcion: 'Ventas, rentabilidad e inventario en un solo documento.', icono: 'bi-briefcase' },
    { tipo: 'VENTAS', titulo: 'Ventas', descripcion: 'Ingresos por filial, categoría y tendencia mensual.', icono: 'bi-cart-check' },
    { tipo: 'RENTABILIDAD', titulo: 'Rentabilidad', descripcion: 'Margen bruto frente al costo de importación.', icono: 'bi-graph-up-arrow' },
    { tipo: 'INVENTARIO', titulo: 'Inventario', descripcion: 'Existencias valorizadas y stock crítico.', icono: 'bi-boxes' },
  ];

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    tipo: this.fb.control<TipoReporte>('EJECUTIVO'),
    desde: [mesAnterior().desde, Validators.required],
    hasta: [mesAnterior().hasta, Validators.required],
    filiales: this.fb.control<string[]>([], Validators.required),
    titulo: ['', Validators.maxLength(120)],
    formato: this.fb.control<FormatoExportacion>('HTML'),
    indice: [true],
    pieLegal: [true],
    firmar: [true],
    confidencialidad: this.fb.control<NivelConfidencialidad | ''>('CONFIDENCIAL'),
    marcaAgua: ['', Validators.maxLength(30)],
  });

  protected readonly capasElegidas = computed(() => this.documento()?.capas ?? []);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.abrir(id);
    });
  }

  ngOnInit(): void {
    this.api.filiales(true).subscribe((f) => {
      const u = this.sesion.usuario();
      const disponibles = u?.rol === 'FILIAL' ? f.filter((x) => x.codigo === u.filial) : f;
      this.filiales.set(disponibles);
      this.form.controls.filiales.setValue(disponibles.map((x) => x.codigo));
    });
  }

  protected cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'historial') this.api.historial().subscribe((h) => this.historial.set(h));
  }

  protected alternarFilial(codigo: string): void {
    const c = this.form.controls.filiales;
    c.setValue(c.value.includes(codigo) ? c.value.filter((x) => x !== codigo) : [...c.value, codigo]);
    c.markAsTouched();
  }

  protected periodoRapido(tipo: 'mes' | 'trimestre' | 'semestre'): void {
    const hoy = new Date();
    const meses = { mes: 1, trimestre: 3, semestre: 6 }[tipo];
    const desde = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - meses, 1)).toISOString().slice(0, 10);
    const hasta = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), 0)).toISOString().slice(0, 10);
    this.form.patchValue({ desde, hasta });
  }

  protected siguiente(): void {
    if (this.paso() === 2) {
      const { desde, hasta, filiales } = this.form.getRawValue();
      if (!filiales.length) return this.notificaciones.advertencia('Selecciona al menos una filial.');
      if (!desde || !hasta || desde > hasta) return this.notificaciones.advertencia('Revisa el periodo: "desde" debe ser anterior a "hasta".');
    }
    this.paso.update((p) => Math.min(3, p + 1));
  }

  protected generar(): void {
    const v = this.form.getRawValue();
    this.generando.set(true);
    this.api
      .generarReporte({
        tipo: v.tipo,
        desde: v.desde,
        hasta: v.hasta,
        filiales: v.filiales,
        formato: v.formato,
        titulo: v.titulo || undefined,
        opciones: {
          indice: v.indice,
          pieLegal: v.pieLegal,
          firmar: v.firmar,
          confidencialidad: v.confidencialidad || undefined,
          marcaAgua: v.marcaAgua || undefined,
        },
      })
      .subscribe({
        next: (r) => {
          this.generando.set(false);
          this.documento.set(r.documento);
          this.resumen.set(r.resumen);
          this.paso.set(4);
          this.notificaciones.exito(`Reporte generado: ${r.resumen.secciones} secciones, ${r.resumen.elementos} elementos.`);
        },
        error: (e) => {
          this.generando.set(false);
          this.notificaciones.error(mensajeError(e));
        },
      });
  }

  protected abrir(id: string): void {
    this.api.documento(id).subscribe({
      next: (d) => {
        this.documento.set(d);
        this.resumen.set(null);
        this.pestana.set('generar');
        this.paso.set(4);
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  protected descargar(formato: FormatoExportacion): void {
    const doc = this.documento();
    if (!doc) return;
    this.api.descargar(doc.metadatos.id, formato).subscribe({
      next: (blob) => {
        const extension = formato.toLowerCase();
        descargarTexto(`SERF-${doc.metadatos.tipo}-${doc.metadatos.ambito}-${doc.metadatos.periodo.hasta}.${extension}`.toLowerCase(), blob);
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  /** Abre el HTML estandarizado en una pestaña nueva, listo para imprimir o guardar como PDF. */
  protected abrirParaImprimir(): void {
    const doc = this.documento();
    if (!doc) return;
    const ventana = window.open('', '_blank');
    this.api.descargar(doc.metadatos.id, 'HTML').subscribe(async (blob) => {
      if (!ventana) return this.notificaciones.advertencia('El navegador bloqueó la ventana emergente.');
      ventana.document.write(await blob.text());
      ventana.document.close();
    });
  }

  protected nuevo(): void {
    this.documento.set(null);
    this.paso.set(1);
  }

  protected async verificarArchivo(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    try {
      const documento = JSON.parse(await archivo.text());
      this.api.verificar(documento).subscribe((r) => this.verificacion.set(r));
    } catch {
      this.verificacion.set({ valido: false, mensaje: 'El archivo no es un JSON de reporte válido.' });
    }
  }

  protected verificarActual(): void {
    const doc = this.documento();
    if (doc) this.api.verificar(doc).subscribe((r) => this.notificaciones[r.valido ? 'exito' : 'error'](r.mensaje));
  }

  protected iconoNodo(tipo: string): string {
    return (
      { seccion: 'bi-folder2-open', parrafo: 'bi-text-paragraph', tabla: 'bi-table', grafico: 'bi-bar-chart', indicador: 'bi-speedometer' }[tipo] ??
      'bi-dot'
    );
  }

  protected tituloTipo(tipo: TipoReporte): string {
    return this.tipos.find((t) => t.tipo === tipo)?.titulo ?? tipo;
  }
}
