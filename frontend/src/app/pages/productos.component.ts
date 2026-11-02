import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { Categoria, ETIQUETA_CATEGORIA, Producto } from '../core/modelos';
import { NotificacionService } from '../core/notificacion.service';
import { SesionService } from '../core/sesion.service';
import { CifraPipe } from '../shared/cifra.pipe';
import { CargandoComponent, ConfirmarComponent, EncabezadoComponent, VacioComponent } from '../shared/ui.components';

/** Catálogo de productos importados (requisito 2). */
@Component({
  selector: 'serf-productos',
  imports: [ReactiveFormsModule, CifraPipe, EncabezadoComponent, CargandoComponent, VacioComponent, ConfirmarComponent],
  template: `
    <serf-encabezado titulo="Productos importados" descripcion="Catálogo de productos tecnológicos importados desde China.">
      @if (puedeEditar) {
        <button class="btn btn-primary" (click)="abrirFormulario()"><i class="bi bi-plus-lg me-1"></i>Registrar producto</button>
      }
    </serf-encabezado>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body d-flex flex-column flex-md-row gap-2">
        <div class="input-group" style="max-width: 420px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" placeholder="Buscar por SKU, nombre o marca" aria-label="Buscar" [value]="texto()" (input)="texto.set($any($event.target).value)">
        </div>
        <div class="d-flex flex-wrap gap-2 ms-md-auto">
          <button class="btn btn-sm rounded-pill" [class]="!categoria() ? 'btn-dark' : 'btn-outline-secondary'" (click)="categoria.set(null)">Todas</button>
          @for (c of categorias; track c) {
            <button class="btn btn-sm rounded-pill" [class]="categoria() === c ? 'btn-dark' : 'btn-outline-secondary'" (click)="categoria.set(c)">{{ etiquetas[c] }}</button>
          }
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      @if (cargando()) {
        <serf-cargando />
      } @else if (filtrados().length) {
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Producto</th><th class="d-none d-lg-table-cell">Proveedor</th>
                <th class="text-end">Costo (USD)</th><th class="text-end">Precio lista (EUR)</th><th class="text-end d-none d-md-table-cell">Margen ref.</th>
                @if (puedeEditar) { <th class="text-end">Acciones</th> }
              </tr>
            </thead>
            <tbody>
              @for (p of filtrados(); track p.sku) {
                <tr [class.text-body-secondary]="!p.activo">
                  <td>
                    <div class="fw-semibold">{{ p.nombre }} @if (!p.activo) { <span class="badge text-bg-secondary">Descontinuado</span> }</div>
                    <div class="small text-body-secondary"><code>{{ p.sku }}</code> · {{ etiquetas[p.categoria] }} · {{ p.marca }}</div>
                  </td>
                  <td class="d-none d-lg-table-cell small">{{ p.proveedor }}<div class="text-body-secondary">{{ p.paisOrigen }}</div></td>
                  <td class="text-end">{{ p.costoImportacionUsd | cifra: 'moneda' : 'USD' }}</td>
                  <td class="text-end fw-semibold">{{ p.precioListaEur | cifra: 'moneda' : 'EUR' }}</td>
                  <td class="text-end d-none d-md-table-cell"><span class="badge text-bg-light border">{{ margen(p) | cifra: 'porcentaje' }}</span></td>
                  @if (puedeEditar) {
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-light" (click)="abrirFormulario(p)" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>
                      @if (esAdmin && p.activo) {
                        <button class="btn btn-sm btn-light text-danger" (click)="porDescontinuar.set(p)" title="Descontinuar" aria-label="Descontinuar"><i class="bi bi-archive"></i></button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <serf-vacio icono="bi-search" titulo="No hay productos que coincidan" />
      }
    </div>

    @if (formularioAbierto()) {
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo-form">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form class="modal-content border-0 shadow" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
            <div class="modal-header">
              <h2 class="modal-title h5" id="titulo-form">{{ editando() ? 'Editar ' + editando() : 'Registrar producto importado' }}</h2>
              <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrarFormulario()"></button>
            </div>
            <div class="modal-body row g-3">
              <div class="col-md-4">
                <label class="form-label" for="sku">SKU</label>
                <input id="sku" class="form-control text-uppercase" formControlName="sku" placeholder="LT-004" [class.is-invalid]="invalido('sku')">
                <div class="invalid-feedback">Formato: 2-4 letras, guion y 3-5 dígitos (LT-004).</div>
              </div>
              <div class="col-md-8">
                <label class="form-label" for="nombre">Nombre</label>
                <input id="nombre" class="form-control" formControlName="nombre" [class.is-invalid]="invalido('nombre')">
                <div class="invalid-feedback">Mínimo 3 caracteres.</div>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="categoria">Categoría</label>
                <select id="categoria" class="form-select" formControlName="categoria">
                  @for (c of categorias; track c) { <option [value]="c">{{ etiquetas[c] }}</option> }
                </select>
              </div>
              <div class="col-md-4"><label class="form-label" for="marca">Marca</label><input id="marca" class="form-control" formControlName="marca"></div>
              <div class="col-md-4"><label class="form-label" for="proveedor">Proveedor en China</label><input id="proveedor" class="form-control" formControlName="proveedor"></div>
              <div class="col-md-6">
                <label class="form-label" for="costo">Costo de importación (USD)</label>
                <input id="costo" type="number" step="0.01" min="0" class="form-control" formControlName="costoImportacionUsd" [class.is-invalid]="invalido('costoImportacionUsd')">
                <div class="invalid-feedback">Debe ser mayor que 0.</div>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="precio">Precio de lista (EUR)</label>
                <input id="precio" type="number" step="0.01" min="0" class="form-control" formControlName="precioListaEur" [class.is-invalid]="invalido('precioListaEur')">
                <div class="invalid-feedback">Debe ser mayor que 0.</div>
              </div>
              @if (margenFormulario() !== null) {
                <div class="col-12">
                  <div class="alert py-2 small mb-0" [class]="margenFormulario()! < 0.25 ? 'alert-warning' : 'alert-success'">
                    Margen de referencia: <strong>{{ margenFormulario() | cifra: 'porcentaje' }}</strong> (costo convertido a EUR con la tasa corporativa).
                  </div>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" (click)="cerrarFormulario()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="guardando()">Guardar</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }

    <serf-confirmar [abierto]="porDescontinuar() !== null" titulo="¿Descontinuar producto?" textoConfirmar="Descontinuar"
                    [mensaje]="'Se mantendrá en el historial, pero ya no podrá venderse: ' + (porDescontinuar()?.nombre ?? '')"
                    (confirmado)="descontinuar()" (cancelado)="porDescontinuar.set(null)" />
  `,
})
export class ProductosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly sesion = inject(SesionService);

  protected readonly categorias: Categoria[] = ['LAPTOP', 'SMARTPHONE', 'ACCESORIO', 'REDES'];
  protected readonly etiquetas = ETIQUETA_CATEGORIA;
  protected readonly puedeEditar = this.sesion.tieneRol('ADMIN', 'ANALISTA');
  protected readonly esAdmin = this.sesion.tieneRol('ADMIN');

  protected readonly productos = signal<Producto[]>([]);
  protected readonly cargando = signal(true);
  protected readonly texto = signal('');
  protected readonly categoria = signal<Categoria | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly editando = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly porDescontinuar = signal<Producto | null>(null);
  private tasaUsd = 0.92;
  private readonly valores = signal({ costo: 0, precio: 0 });

  protected readonly filtrados = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.productos().filter(
      (p) =>
        (!this.categoria() || p.categoria === this.categoria()) &&
        (!t || `${p.sku} ${p.nombre} ${p.marca}`.toLowerCase().includes(t)),
    );
  });

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2,4}-\d{3,5}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    categoria: this.fb.control<Categoria>('LAPTOP'),
    marca: [''],
    proveedor: [''],
    costoImportacionUsd: [0, [Validators.required, Validators.min(0.01)]],
    precioListaEur: [0, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly margenFormulario = computed(() => {
    const { costo, precio } = this.valores();
    return costo > 0 && precio > 0 ? (precio - costo * this.tasaUsd) / precio : null;
  });

  ngOnInit(): void {
    this.cargar();
    this.api.configuracion().subscribe((c) => (this.tasaUsd = c.tasasCambio.USD));
    this.form.valueChanges.subscribe((v) => this.valores.set({ costo: Number(v.costoImportacionUsd) || 0, precio: Number(v.precioListaEur) || 0 }));
  }

  protected margen(p: Producto): number {
    return (p.precioListaEur - p.costoImportacionUsd * this.tasaUsd) / p.precioListaEur;
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  protected abrirFormulario(p?: Producto): void {
    this.editando.set(p?.sku ?? null);
    this.form.reset({ sku: p?.sku ?? '', nombre: p?.nombre ?? '', categoria: p?.categoria ?? 'LAPTOP', marca: p?.marca ?? '', proveedor: p?.proveedor ?? '', costoImportacionUsd: p?.costoImportacionUsd ?? 0, precioListaEur: p?.precioListaEur ?? 0 });
    if (p) {
      this.form.controls.sku.disable();
      this.form.controls.categoria.disable();
    } else {
      this.form.controls.sku.enable();
      this.form.controls.categoria.enable();
    }
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();
    const datos = { ...v, sku: v.sku.toUpperCase(), costoImportacionUsd: Number(v.costoImportacionUsd), precioListaEur: Number(v.precioListaEur) };
    const sku = this.editando();
    const peticion = sku ? this.api.actualizarProducto(sku, datos) : this.api.crearProducto(datos);
    peticion.subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.formularioAbierto.set(false);
        this.notificaciones.exito(sku ? `Se actualizó ${p.sku}.` : `Producto ${p.sku} registrado.`);
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(e));
      },
    });
  }

  protected descontinuar(): void {
    const p = this.porDescontinuar();
    if (!p) return;
    this.api.descontinuarProducto(p.sku).subscribe({
      next: () => {
        this.notificaciones.info(`${p.sku} fue descontinuado.`);
        this.porDescontinuar.set(null);
        this.cargar();
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }

  private cargar(): void {
    this.api.productos().subscribe({
      next: (p) => {
        this.productos.set(p);
        this.cargando.set(false);
      },
      error: (e) => this.notificaciones.error(mensajeError(e)),
    });
  }
}
