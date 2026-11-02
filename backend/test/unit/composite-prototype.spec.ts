import { ErrorValidacion } from '../../src/comun/errores';
import { Grafico, Indicador, Parrafo, Seccion, Tabla } from '../../src/reportes/composite/componentes';
import { NodoSeccion } from '../../src/reportes/composite/nodo-reporte';
import { RegistroPlantillas } from '../../src/reportes/prototype/registro-plantillas';

describe('Patrón Composite', () => {
  const crearArbol = () => {
    const raiz = new Seccion('Raíz');
    const nivel2 = new Seccion('Nivel 2');
    const nivel3 = new Seccion('Nivel 3');
    nivel3.agregar(new Parrafo('Hoja profunda'), new Indicador('KPI', 10, 'numero'));
    nivel2.agregar(new Tabla('Tabla', [{ titulo: 'A', formato: 'texto' }], [['x'], ['y']]), nivel3);
    raiz.agregar(new Parrafo('Intro'), nivel2, new Grafico('G', 'barras', [{ etiqueta: 'a', valor: 1 }]));
    return { raiz, nivel2, nivel3 };
  };

  it('trata hojas y secciones de forma uniforme al contar elementos', () => {
    const { raiz, nivel2 } = crearArbol();
    expect(raiz.contarElementos()).toBe(5); // párrafo, tabla, párrafo, indicador, gráfico
    expect(nivel2.contarElementos()).toBe(3);
  });

  it('permite anidamiento sin límite', () => {
    let actual = new Seccion('Nivel 1');
    const raiz = actual;
    for (let i = 2; i <= 25; i++) {
      const hija = new Seccion(`Nivel ${i}`);
      actual.agregar(hija);
      actual = hija;
    }
    actual.agregar(new Parrafo('Fondo'));
    expect(raiz.profundidad()).toBe(25);
    expect(raiz.contarElementos()).toBe(1);
  });

  it('serializa el árbol con el nivel de cada sección', () => {
    const { raiz } = crearArbol();
    const nodo = raiz.aNodo();
    const n2 = nodo.hijos[1] as NodoSeccion;
    const n3 = n2.hijos[1] as NodoSeccion;
    expect([nodo.nivel, n2.nivel, n3.nivel]).toEqual([1, 2, 3]);
  });

  it('impide ciclos (una sección no puede contenerse a sí misma)', () => {
    const { raiz, nivel3 } = crearArbol();
    expect(() => nivel3.agregar(raiz)).toThrow(ErrorValidacion);
    expect(() => raiz.agregar(raiz)).toThrow(ErrorValidacion);
  });

  it('reemplaza marcadores en todo el árbol con una sola llamada', () => {
    const raiz = new Seccion('Reporte {{pais}}').agregar(
      new Seccion('Sub').agregar(new Parrafo('Periodo {{periodo}}')),
    );
    raiz.reemplazarMarcadores({ pais: 'Perú', periodo: '2026-10' });
    const json = JSON.stringify(raiz.aNodo());
    expect(json).toContain('Reporte Perú');
    expect(json).toContain('Periodo 2026-10');
  });

  it('obtenerHijos devuelve una copia que no altera la sección', () => {
    const { raiz } = crearArbol();
    (raiz.obtenerHijos() as unknown[]).length = 0;
    expect(raiz.obtenerHijos()).toHaveLength(3);
  });

  it('valida que las filas de una tabla tengan todas sus columnas', () => {
    expect(
      () =>
        new Tabla(
          'T',
          [
            { titulo: 'A', formato: 'texto' },
            { titulo: 'B', formato: 'numero' },
          ],
          [['solo una']],
        ),
    ).toThrow(ErrorValidacion);
  });
});

describe('Patrón Prototype', () => {
  const registro = new RegistroPlantillas();

  it('obtiene plantillas clonadas, nunca la misma instancia', () => {
    const a = registro.obtener('VENTAS', 'PE');
    const b = registro.obtener('VENTAS', 'PE');
    expect(a).not.toBe(b);
    expect(a.esBase).toBe(false);
  });

  it('la clonación es profunda: modificar el clon no afecta al original', () => {
    const base = registro.listarBases().find((p) => p.tipo === 'VENTAS')!;
    const clon = base.clonar();
    clon.personalizarPara({
      ambito: 'MX',
      nombre: 'X',
      locale: 'es-MX',
      normativa: 'NIF',
      textoLegalLocal: 'Texto MX',
      colorPrimario: '#ff0000',
    });
    clon.obtenerEstructura().agregar(new Parrafo('agregado'));

    expect(base.ambito).toBe('BASE');
    expect(base.colorPrimario).toBe('#1e3a8a');
    expect(base.obtenerTextosLegales()).not.toContain('Texto MX');
    expect(base.obtenerEstructura().contarElementos()).toBe(clon.obtenerEstructura().contarElementos() - 1);
  });

  it('las estructuras de dos clones son árboles independientes', () => {
    const a = registro.obtener('INVENTARIO').obtenerEstructura();
    const b = registro.obtener('INVENTARIO').obtenerEstructura();
    a.buscarSeccion('notas')!.agregar(new Parrafo('solo en A'));
    expect(JSON.stringify(b.aNodo())).not.toContain('solo en A');
  });

  it('adapta la copia a cada país (normativa, formato y texto legal)', () => {
    const pe = registro.obtener('RENTABILIDAD', 'PE');
    const de = registro.obtener('RENTABILIDAD', 'DE');
    expect(pe.id).toBe('rentabilidad-pe');
    expect(pe.locale).toBe('es-PE');
    expect(pe.normativa).toContain('SUNAT');
    expect(de.locale).toBe('de-DE');
    expect(de.obtenerTextosLegales().join(' ')).toContain('Vertraulich');
  });

  it('ofrece variantes para todos los tipos y países a partir de 4 bases', () => {
    expect(registro.listarBases()).toHaveLength(4);
    expect(registro.listarVariantes()).toHaveLength(4 * 6);
  });
});
