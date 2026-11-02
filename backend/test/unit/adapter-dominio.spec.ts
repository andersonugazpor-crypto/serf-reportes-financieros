import { Dinero } from '../../src/comun/dinero';
import { ErrorConflicto, ErrorValidacion } from '../../src/comun/errores';
import {
  AdaptadorAlemania,
  AdaptadorEspana,
  AdaptadorEstandar,
  AdaptadorMexico,
  AdaptadorPeru,
} from '../../src/filiales/adaptadores/adaptadores';
import { AdaptadorDatosFilial, parsearFecha } from '../../src/filiales/adaptadores/lote-normalizado';
import { RegistroAdaptadores } from '../../src/filiales/adaptadores/registro-adaptadores';
import { Filial } from '../../src/filiales/filial';
import { Stock } from '../../src/inventario/stock';
import { Producto } from '../../src/productos/producto';
import { Venta } from '../../src/ventas/venta';

describe('Patrón Adapter', () => {
  const casos: [AdaptadorDatosFilial, 'EUR' | 'MXN' | 'PEN' | 'COP'][] = [
    [new AdaptadorEspana(), 'EUR'],
    [new AdaptadorMexico(), 'MXN'],
    [new AdaptadorPeru(), 'PEN'],
    [new AdaptadorAlemania(), 'EUR'],
    [new AdaptadorEstandar(), 'COP'],
  ];

  it.each(casos)('%p convierte su archivo de ejemplo al formato estándar', (adaptador, moneda) => {
    const lote = adaptador.adaptar(adaptador.ejemplo(), moneda);
    expect(lote.ventas.length).toBeGreaterThan(0);
    expect(lote.inventario.length).toBeGreaterThan(0);
    expect(lote.advertencias).toEqual([]);
    for (const v of lote.ventas) {
      expect(v.fecha).toBeInstanceOf(Date);
      expect(v.sku).toMatch(/^[A-Z]{2}-\d{3}$/);
      expect(v.precioUnitario).toBeGreaterThan(0);
    }
  });

  it('México: lee comillas y fechas DD/MM/AAAA', () => {
    const lote = new AdaptadorMexico().adaptar(new AdaptadorMexico().ejemplo(), 'MXN');
    expect(lote.ventas[0]).toMatchObject({
      referencia: 'MX-F-5501',
      sku: 'LT-002',
      cantidad: 1,
      precioUnitario: 21999,
      moneda: 'MXN',
    });
    expect(lote.ventas[0].fecha.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('Alemania: interpreta separador de miles "." y coma decimal', () => {
    const lote = new AdaptadorAlemania().adaptar(new AdaptadorAlemania().ejemplo(), 'EUR');
    expect(lote.ventas[0].precioUnitario).toBe(1249);
    expect(lote.ventas[1].precioUnitario).toBe(189.9);
  });

  it('registra advertencias por filas inválidas sin detener la importación', () => {
    const csv =
      'tipo,folio,fecha,sku,cantidad,precio_mxn\nVENTA,F1,31/02/2026,LT-001,1,100\nVENTA,F2,01/10/2026,LT-001,1,100\nOTRO,,,,,';
    const lote = new AdaptadorMexico().adaptar(csv, 'MXN');
    expect(lote.ventas).toHaveLength(1);
    expect(lote.advertencias).toHaveLength(2);
  });

  it('rechaza archivos vacíos o con formato incorrecto', () => {
    expect(() => new AdaptadorEspana().adaptar('   ', 'EUR')).toThrow(ErrorValidacion);
    expect(() => new AdaptadorEspana().adaptar('no es json', 'EUR')).toThrow('formato esperado (JSON_ES)');
    expect(() => new AdaptadorPeru().adaptar('<reporte></reporte>', 'PEN')).toThrow(ErrorValidacion);
  });

  it('el registro permite agregar formatos nuevos sin modificar el código existente', () => {
    const registro = new RegistroAdaptadores([]);
    expect(() => registro.obtener('ESTANDAR')).toThrow(ErrorValidacion);
    registro.registrar(new AdaptadorEstandar());
    expect(registro.obtener('ESTANDAR')).toBeInstanceOf(AdaptadorEstandar);
    expect(new RegistroAdaptadores().listar()).toHaveLength(5);
  });

  it('parsearFecha valida fechas reales', () => {
    expect(parsearFecha('2026-10-05')?.getUTCDate()).toBe(5);
    expect(parsearFecha('05.10.2026')?.getUTCMonth()).toBe(9);
    expect(parsearFecha('30/02/2026')).toBeNull();
    expect(parsearFecha('ayer')).toBeNull();
  });
});

describe('Entidades del dominio (encapsulamiento y validación)', () => {
  it('Dinero no permite mezclar monedas sin convertir', () => {
    const eur = Dinero.de(10, 'EUR');
    expect(() => eur.sumar(Dinero.de(5, 'USD'))).toThrow(ErrorValidacion);
    expect(Dinero.de(100, 'USD').convertir('EUR', 0.92).monto).toBe(92);
    expect(Dinero.de(0.1, 'EUR').sumar(Dinero.de(0.2, 'EUR')).monto).toBe(0.3);
  });

  it('Producto valida SKU y precios, y expone solo lo necesario', () => {
    expect(
      () =>
        new Producto({
          sku: 'malo',
          nombre: 'Algo',
          categoria: 'LAPTOP',
          marca: 'X',
          proveedor: 'Y',
          costoImportacionUsd: 1,
          precioListaEur: 2,
        }),
    ).toThrow('SKU inválido');
    const p = new Producto({
      sku: 'lt-010',
      nombre: 'Laptop',
      categoria: 'LAPTOP',
      marca: '',
      proveedor: '',
      costoImportacionUsd: 500,
      precioListaEur: 900,
    });
    expect(p.sku).toBe('LT-010');
    expect(p.marca).toBe('Genérico');
    expect(p.paisOrigen).toBe('China');
    expect(() => p.actualizarPrecios(-1, 10)).toThrow(ErrorValidacion);
    expect(p.aDto()).not.toHaveProperty('_costoImportacion');
  });

  it('Stock nunca queda negativo', () => {
    const s = new Stock('PE', 'LT-001', 5);
    expect(() => s.retirar(6)).toThrow(ErrorConflicto);
    s.retirar(5);
    expect(s.cantidad).toBe(0);
    expect(s.esCritico(15)).toBe(true);
    expect(() => s.fijar(-1)).toThrow(ErrorValidacion);
  });

  it('Venta calcula su total y rechaza datos inválidos', () => {
    const v = new Venta({
      fecha: new Date('2026-10-01T12:00:00Z'),
      filialCodigo: 'PE',
      sku: 'LT-001',
      cantidad: 3,
      precioUnitario: Dinero.de(1000, 'PEN'),
      origen: 'MANUAL',
    });
    expect(v.total.monto).toBe(3000);
    expect(v.periodo).toBe('2026-10');
    expect(
      () =>
        new Venta({
          fecha: new Date(Date.now() + 5 * 86_400_000),
          filialCodigo: 'PE',
          sku: 'X',
          cantidad: 1,
          precioUnitario: Dinero.de(1, 'PEN'),
          origen: 'MANUAL',
        }),
    ).toThrow('futura');
  });

  it('Filial normaliza su código y valida la moneda', () => {
    const f = new Filial({
      codigo: 'cl',
      nombre: 'FinanCorp Chile',
      pais: 'Chile',
      ciudad: 'Santiago',
      region: 'LATAM',
      moneda: 'CLP',
      formatoDatos: 'ESTANDAR',
    });
    expect(f.id).toBe('CL');
    expect(
      () =>
        new Filial({
          codigo: 'CHL',
          nombre: 'Chile',
          pais: 'Chile',
          ciudad: 'S',
          region: 'LATAM',
          moneda: 'CLP',
          formatoDatos: 'ESTANDAR',
        }),
    ).toThrow(ErrorValidacion);
  });
});
