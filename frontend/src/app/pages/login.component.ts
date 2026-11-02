import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/interceptores';
import { SesionService } from '../core/sesion.service';

@Component({
  selector: 'serf-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="fondo d-flex align-items-center justify-content-center p-3">
      <div class="tarjeta row g-0 shadow-lg rounded-4 overflow-hidden bg-body w-100">
        <section class="col-lg-6 portada text-white p-5 d-none d-lg-flex flex-column justify-content-between">
          <div class="d-flex align-items-center gap-2 fs-5 fw-bold"><i class="bi bi-bar-chart-line-fill"></i> FinanCorp S.A.</div>
          <div>
            <h1 class="display-6 fw-bold">Sistema Empresarial de Gestión de Reportes Financieros</h1>
            <ul class="list-unstyled mt-4 d-grid gap-2 opacity-90">
              <li><i class="bi bi-diagram-3 me-2"></i>Datos de todas las filiales integrados</li>
              <li><i class="bi bi-box-seam me-2"></i>Productos importados y su venta</li>
              <li><i class="bi bi-shield-lock me-2"></i>Reportes estandarizados y firmados</li>
            </ul>
          </div>
          <div class="small opacity-75">Sede central: Madrid · Filiales en Europa y Latinoamérica</div>
        </section>
        <section class="col-lg-6 p-4 p-md-5">
          <div class="d-lg-none text-primary fw-bold fs-4 mb-3"><i class="bi bi-bar-chart-line-fill"></i> SERF</div>
          <h2 class="h3 fw-bold">Iniciar sesión</h2>
          <p class="text-body-secondary">Accede con tu usuario corporativo.</p>

          @if (error()) {
            <div class="alert alert-danger py-2" role="alert"><i class="bi bi-exclamation-triangle me-1"></i>{{ error() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="ingresar()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="usuario">Usuario</label>
              <input id="usuario" class="form-control form-control-lg" formControlName="usuario" autocomplete="username"
                     [class.is-invalid]="form.controls.usuario.touched && form.controls.usuario.invalid">
              <div class="invalid-feedback">Ingresa tu usuario.</div>
            </div>
            <div class="mb-4">
              <label class="form-label" for="clave">Contraseña</label>
              <div class="input-group input-group-lg">
                <input id="clave" class="form-control" formControlName="clave" autocomplete="current-password" [type]="ver() ? 'text' : 'password'"
                       [class.is-invalid]="form.controls.clave.touched && form.controls.clave.invalid">
                <button type="button" class="btn btn-outline-secondary" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <i class="bi" [class]="ver() ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg w-100" type="submit" [disabled]="cargando()">
              @if (cargando()) { <span class="spinner-border spinner-border-sm me-2"></span> }
              Ingresar
            </button>
          </form>

          <div class="mt-4 pt-3 border-top">
            <p class="small text-body-secondary mb-2">Cuentas de demostración (clic para usar):</p>
            <div class="d-grid gap-2">
              @for (c of cuentas; track c.usuario) {
                <button type="button" class="btn btn-light btn-sm d-flex justify-content-between text-start" (click)="usar(c.usuario, c.clave)">
                  <span><strong>{{ c.usuario }}</strong> · {{ c.clave }}</span><span class="badge text-bg-secondary">{{ c.rol }}</span>
                </button>
              }
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .fondo { min-height: 100vh; background: radial-gradient(circle at 20% 20%, rgba(30,58,138,.15), transparent 50%), #f1f5f9; }
    .tarjeta { max-width: 1000px; }
    .portada { background: linear-gradient(160deg, #172554, #1e3a8a 60%, #1d4ed8); min-height: 560px; }
  `,
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  readonly volver = input<string>();
  protected readonly ver = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cuentas = [
    { usuario: 'gerente', clave: 'Gerente2026!', rol: 'Gerencia' },
    { usuario: 'analista', clave: 'Analista2026!', rol: 'Analista' },
    { usuario: 'operador.pe', clave: 'Peru2026!', rol: 'Filial Perú' },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: ['', Validators.required],
    clave: ['', Validators.required],
  });

  protected usar(usuario: string, clave: string): void {
    this.form.setValue({ usuario, clave });
    this.ingresar();
  }

  protected ingresar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    const { usuario, clave } = this.form.getRawValue();
    this.api.login(usuario, clave).subscribe({
      next: (s) => {
        this.sesion.iniciar(s);
        void this.router.navigateByUrl(this.volver()?.startsWith('/') ? this.volver()! : '/panel');
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(mensajeError(e, 'No se pudo iniciar sesión.'));
      },
    });
  }
}
