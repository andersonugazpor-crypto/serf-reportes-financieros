import { ConfiguracionCorporativa } from '../../src/configuracion/configuracion-corporativa';
import { ErrorValidacion } from '../../src/comun/errores';
import { DirectorReportes } from '../../src/reportes/builder/director-reportes';
import { ReporteBuilder } from '../../src/reportes/builder/reporte-builder';
import { DatosConsolidados } from '../../src/reportes/consolidacion/datos-consolidados';
import {
  ConfidencialDecorator,
  FirmaDigitalDecorator,
  IndiceDecorator,
  MarcaAguaDecorator,
  PieLegalDecorator,
  VerificadorFirma,
} from '../../src/reportes/decorator/decoradores';
import { NodoSeccion } from '../../src/reportes/composite/nodo-reporte';
import { FabricaExportadores } from '../../src/reportes/exportacion/exportadores';
import { RegistroPlantillas } from '../../src/reportes/prototype/registro-plantillas';

const registro = new RegistroPlantillas();

const reporteSimple = () =>
  ReporteBuilder.desdePlantilla(registro.obtener('VENTAS', 'ES'))
    .conTitulo('Ventas de prueba')
    .paraPeriodo('2026-10-01', '2026-10-31')
    .deFiliales(['ES'])
    .generadoPor('Pruebas')
    .seccion('ventas-filial', (s) =>
      s
        .tabla(
          'Tabla',
          [
            { titulo: 'Filial', formato: 'texto' },
            { titulo: 'Ingresos', formato: 'moneda' },
          ],
          [['España', 1000]],
        )
        .subseccion('Detalle', (d) =>
          d.parrafo('Nivel 4').subseccion('Más detalle', (m) => m.indicador('KPI', 5, 'numero')),
        ),
    )
    .construir();

export const datosDePrueba = (): DatosConsolidados => ({
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' },
  moneda: 'EUR',
  filiales: [
    { codigo: 'ES', nombre: 'España' },
    { codigo: 'MX', nombre: 'México' },
  ],
  totales: {
    ingresos: 1500,
    costo: 1000,
    margen: 500,
    margenPct: 0.333,
    unidades: 12,
    transacciones: 6,
    ticketPromedio: 250,
  },
  porFilial: [
    {
      codigo: 'ES',
      nombre: 'España',
      monedaLocal: 'EUR',
      ingresosLocal: 1000,
      ingresos: 1000,
      costo: 600,
      margen: 400,
      margenPct: 0.4,
      unidades: 8,
      transacciones: 4,
    },
    {
      codigo: 'MX',
      nombre: 'México',
      monedaLocal: 'MXN',
      ingresosLocal: 9804,
      ingresos: 500,
      costo: 400,
      margen: 100,
      margenPct: 0.2,
      unidades: 4,
      transacciones: 2,
    },
  ],
  porCategoria: [{ categoria: 'LAPTOP', etiqueta: 'Laptops', ingresos: 1500, costo: 1000, margen: 500, unidades: 12 }],
  porMes: [{ periodo: '2026-10', ingresos: 1500, unidades: 12 }],
  productos: [
    {
      sku: 'LT-001',
      nombre: 'Laptop',
      categoria: 'LAPTOP',
      unidades: 12,
      ingresos: 1500,
      margen: 500,
      margenPct: 0.333,
    },
  ],
  inventario: {
    porFilial: [{ codigo: 'ES', nombre: 'España', unidades: 40, valorizado: 2000, productosCriticos: 1 }],
    criticos: [{ filial: 'ES', sku: 'LT-001', nombre: 'Laptop', cantidad: 3 }],
    unidadesTotales: 40,
    valorTotal: 2000,
    stockMinimo: 15,
  },
  margenObjetivo: 0.25,
  alertas: ['México: margen bajo.'],
});

describe('Patrón Builder', () => {
  it('construye paso a paso con API fluida y subsecciones anidadas', () => {
    const reporte = reporteSimple();
    const doc = reporte.obtenerDocumento();
    expect(doc.metadatos.titulo).toBe('Ventas de prueba');
    expect(doc.metadatos.locale).toBe('es-ES');
    expect(JSON.stringify(doc.cuerpo)).toContain('Más detalle');
  });

  it('valida que estén los pasos obligatorios antes de crear el producto', () => {
    const b = ReporteBuilder.desdePlantilla(registro.obtener('VENTAS'));
    expect(() => b.construir()).toThrow('Falta el título');
    b.conTitulo('Título');
    expect(() => b.construir()).toThrow('Falta el periodo');
    expect(() => b.paraPeriodo('2026-12-01', '2026-01-01')).toThrow(ErrorValidacion);
  });

  it('un builder solo construye un reporte', () => {
    const b = ReporteBuilder.desdePlantilla(registro.obtener('VENTAS'))
      .conTitulo('Reporte X')
      .paraPeriodo('2026-01-01', '2026-01-31')
      .deFiliales(['ES'])
      .seccion('resumen', (s) => s.parrafo('a'));
    b.construir();
    expect(() => b.construir()).toThrow('ya construyó');
  });

  it('reemplaza los marcadores de la plantilla y rellena secciones vacías', () => {
    const json = JSON.stringify(reporteSimple().obtenerDocumento().cuerpo);
    expect(json).not.toContain('{{');
    expect(json).toContain('2026-10-01 al 2026-10-31');
    expect(json).toContain('Sin datos para este apartado');
  });

  it('no altera la plantilla de la que parte', () => {
    const plantilla = registro.obtener('VENTAS', 'ES');
    const antes = plantilla.obtenerEstructura().contarElementos();
    ReporteBuilder.desdePlantilla(plantilla)
      .conTitulo('Reporte X')
      .paraPeriodo('2026-01-01', '2026-01-02')
      .deFiliales(['ES'])
      .seccion('resumen', (s) => s.parrafo('extra'))
      .construir();
    expect(plantilla.obtenerEstructura().contarElementos()).toBe(antes);
  });

  it('el Director aplica la misma receta estandarizada a cada tipo', () => {
    const director = new DirectorReportes();
    const ejecutivo = director.construir(
      'EJECUTIVO',
      ReporteBuilder.desdePlantilla(registro.obtener('EJECUTIVO')),
      datosDePrueba(),
      'Ejecutivo',
    );
    const analisis = ejecutivo
      .obtenerDocumento()
      .cuerpo.hijos.find((h) => h.tipo === 'seccion' && h.clave === 'analisis') as NodoSeccion;
    expect(analisis.hijos.map((h) => (h as NodoSeccion).titulo)).toEqual(['Ventas', 'Rentabilidad', 'Inventario']);
    const ventas = director.construir(
      'VENTAS',
      ReporteBuilder.desdePlantilla(registro.obtener('VENTAS')),
      datosDePrueba(),
      'Ventas',
    );
    expect(JSON.stringify(ventas.obtenerDocumento().cuerpo)).toContain('Ventas por filial');
    expect(JSON.stringify(ventas.obtenerDocumento().cuerpo)).toContain('México: margen bajo.');
  });
});

describe('Patrón Decorator', () => {
  beforeEach(() => ConfiguracionCorporativa.reiniciarParaPruebas());

  it('agrega características sin modificar la estructura del reporte', () => {
    const base = reporteSimple();
    const decorado = new MarcaAguaDecorator(new ConfidencialDecorator(base, 'CONFIDENCIAL'), 'borrador');
    const docBase = base.obtenerDocumento();
    const doc = decorado.obtenerDocumento();
    expect(doc.cuerpo).toEqual(docBase.cuerpo);
    expect(doc.marcasAgua).toEqual(['BORRADOR']);
    expect(doc.confidencialidad).toBe('CONFIDENCIAL');
    expect(docBase.marcasAgua).toEqual([]);
  });

  it('las capas se apilan y quedan registradas en orden', () => {
    const doc = new PieLegalDecorator(new IndiceDecorator(reporteSimple())).obtenerDocumento();
    expect(doc.capas).toEqual(['Reporte base', 'Índice de contenidos', 'Aviso legal corporativo']);
    expect(doc.pies.at(-1)).toBe(ConfiguracionCorporativa.obtenerInstancia().avisoLegal);
  });

  it('el índice numera secciones y subsecciones del árbol Composite', () => {
    const doc = new IndiceDecorator(reporteSimple()).obtenerDocumento();
    const numeros = doc.indice.map((e) => e.numeracion);
    expect(numeros).toContain('2.1.1.1');
    expect(doc.indice.find((e) => e.titulo === 'Más detalle')?.nivel).toBe(4);
  });

  it('la firma digital detecta cualquier modificación posterior', () => {
    const doc = new FirmaDigitalDecorator(
      new ConfidencialDecorator(reporteSimple(), 'RESTRINGIDO'),
      'Tester',
    ).obtenerDocumento();
    expect(doc.firma?.algoritmo).toBe('HMAC-SHA256');
    expect(VerificadorFirma.verificar(doc)).toBe(true);

    const alterado = JSON.parse(JSON.stringify(doc));
    alterado.cuerpo.hijos[0].titulo = 'Manipulado';
    expect(VerificadorFirma.verificar(alterado)).toBe(false);
  });

  it('un documento firmado sigue siendo válido tras viajar como JSON', () => {
    const doc = new FirmaDigitalDecorator(reporteSimple(), 'Tester').obtenerDocumento();
    expect(VerificadorFirma.verificar(JSON.parse(JSON.stringify(doc)))).toBe(true);
  });
});

describe('Fábrica de exportadores', () => {
  const fabrica = new FabricaExportadores();
  const doc = new MarcaAguaDecorator(new FirmaDigitalDecorator(reporteSimple(), 'T'), 'copia').obtenerDocumento();

  it('crea el exportador pedido sin que el cliente conozca la clase concreta', () => {
    expect(fabrica.crear('HTML').formato).toBe('HTML');
    expect(() => fabrica.crear('PDF' as never)).toThrow(ErrorValidacion);
  });

  it('HTML incluye título, marca de agua, tablas y escapa el contenido', () => {
    const archivo = fabrica.crear('HTML').exportar(doc);
    expect(archivo.nombre).toMatch(/\.html$/);
    expect(archivo.contenido).toContain('<h1>Ventas de prueba</h1>');
    expect(archivo.contenido).toContain('COPIA');
    expect(archivo.contenido).toContain('<table>');
  });

  it('CSV exporta las tablas con separador ";" y BOM UTF-8', () => {
    const archivo = fabrica.crear('CSV').exportar(doc);
    expect(archivo.contenido.charCodeAt(0)).toBe(0xfeff);
    expect(archivo.contenido).toContain('Filial;Ingresos');
  });

  it('JSON conserva la firma y se puede verificar', () => {
    const archivo = fabrica.crear('JSON').exportar(doc);
    expect(JSON.parse(archivo.contenido).marcasAgua).toEqual(['COPIA']);
  });
});
