import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NodoSeccion } from './core/modelos';
import { SesionService } from './core/sesion.service';
import { CifraPipe } from './shared/cifra.pipe';
import { GraficoComponent } from './shared/grafico.component';
import { NodoReporteComponent } from './shared/nodo-reporte.component';

describe('CifraPipe', () => {
  const pipe = new CifraPipe();

  it('formatea moneda según la configuración regional', () => {
    expect(pipe.transform(15000, 'moneda', 'EUR')).toMatch(/15\.000\s€/);
    expect(pipe.transform(12.5, 'moneda', 'USD', false, 'en-US')).toBe('$12.50');
  });

  it('formatea porcentajes en fracción o ya calculados', () => {
    expect(pipe.transform(0.4321, 'porcentaje')).toBe('43,2 %');
    expect(pipe.transform(43.21, 'porcentaje', '', true)).toBe('43,2 %');
  });

  it('muestra un guion si no hay valor', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});

describe('Componentes compartidos', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('GraficoComponent dibuja una barra por punto con ancho proporcional', async () => {
    const f = TestBed.createComponent(GraficoComponent);
    f.componentRef.setInput('tipo', 'barras');
    f.componentRef.setInput('serie', [
      { etiqueta: 'España', valor: 100 },
      { etiqueta: 'Perú', valor: 50 },
    ]);
    await f.whenStable();
    const rellenos = f.nativeElement.querySelectorAll('.relleno') as NodeListOf<HTMLElement>;
    expect(rellenos.length).toBe(2);
    expect(rellenos[1].style.width).toBe('50%');
  });

  it('NodoReporteComponent dibuja recursivamente secciones anidadas (Composite)', async () => {
    const arbol: NodoSeccion = {
      tipo: 'seccion', id: 'r', clave: 'raiz', titulo: 'Raíz', nivel: 1,
      hijos: [
        {
          tipo: 'seccion', id: 'a', clave: null, titulo: 'Nivel A', nivel: 2,
          hijos: [
            { tipo: 'seccion', id: 'b', clave: null, titulo: 'Nivel B', nivel: 3, hijos: [{ tipo: 'parrafo', id: 'p', texto: 'Hoja profunda', estilo: 'alerta' }] },
            { tipo: 'indicador', id: 'k', etiqueta: 'Ingresos', valor: 1000, formato: 'moneda', moneda: 'EUR', alerta: false, detalle: null },
          ],
        },
      ],
    };
    const f = TestBed.createComponent(NodoReporteComponent);
    f.componentRef.setInput('nodo', arbol);
    await f.whenStable();
    const html = f.nativeElement as HTMLElement;
    expect(html.querySelectorAll('section').length).toBe(3);
    expect(html.textContent).toContain('Hoja profunda');
    expect(html.querySelector('.estilo-alerta')).toBeTruthy();
    expect(html.querySelector('.kpi strong')?.textContent).toContain('€');
  });
});

describe('SesionService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('inicia y cierra sesión, y verifica roles', () => {
    const s = TestBed.inject(SesionService);
    expect(s.autenticado()).toBe(false);
    s.iniciar({ token: 't', expira: new Date(Date.now() + 60_000).toISOString(), usuario: { usuario: 'pe', nombre: 'Rosa', rol: 'FILIAL', filial: 'PE' } });
    expect(s.autenticado()).toBe(true);
    expect(s.tieneRol('FILIAL')).toBe(true);
    expect(s.tieneRol('ADMIN')).toBe(false);
    s.cerrar(false);
    expect(s.token()).toBeNull();
  });
});
