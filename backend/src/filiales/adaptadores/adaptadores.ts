import { Moneda } from '../../comun/dinero';
import { ErrorValidacion } from '../../comun/errores';
import {
  ErpEspana,
  PosMexico,
  SistemaContablePeru,
  WarenwirtschaftDeutschland,
} from '../sistemas-externos/sistemas-locales';
import { AdaptadorDatosFilial, LoteNormalizado, parsearFecha, VentaNormalizada } from './lote-normalizado';

/**
 * Base abstracta con las validaciones comunes a todos los adaptadores
 * (plantilla de reutilización: cada subclase solo implementa la traducción).
 */
abstract class AdaptadorBase implements AdaptadorDatosFilial {
  abstract readonly formato: AdaptadorDatosFilial['formato'];
  abstract readonly descripcion: string;
  abstract ejemplo(): string;
  protected abstract traducir(contenido: string, moneda: Moneda, lote: LoteNormalizado): void;

  adaptar(contenido: string, moneda: Moneda): LoteNormalizado {
    if (!contenido?.trim()) throw new ErrorValidacion('El archivo está vacío.');
    const lote: LoteNormalizado = { ventas: [], inventario: [], advertencias: [] };
    try {
      this.traducir(contenido, moneda, lote);
    } catch (e) {
      if (e instanceof ErrorValidacion) throw e;
      throw new ErrorValidacion(`El archivo no tiene el formato ${this.formato}: ${(e as Error).message}`);
    }
    return lote;
  }

  protected agregarVenta(
    lote: LoteNormalizado,
    origen: string,
    datos: { referencia: string; fecha: string; sku: string; cantidad: number; precio: number; moneda: Moneda },
  ): void {
    const fecha = parsearFecha(datos.fecha);
    const sku = datos.sku?.trim().toUpperCase();
    if (!fecha || !sku || !Number.isInteger(datos.cantidad) || datos.cantidad <= 0 || !(datos.precio > 0)) {
      lote.advertencias.push(`${origen}: venta ignorada por datos incompletos o inválidos.`);
      return;
    }
    const venta: VentaNormalizada = {
      referencia: datos.referencia?.trim() || `${sku}-${datos.fecha}`,
      fecha,
      sku,
      cantidad: datos.cantidad,
      precioUnitario: datos.precio,
      moneda: datos.moneda,
    };
    lote.ventas.push(venta);
  }

  protected agregarStock(lote: LoteNormalizado, origen: string, sku: string, cantidad: number): void {
    if (!sku?.trim() || !Number.isInteger(cantidad) || cantidad < 0) {
      lote.advertencias.push(`${origen}: existencia ignorada por datos inválidos.`);
      return;
    }
    lote.inventario.push({ sku: sku.trim().toUpperCase(), cantidad });
  }
}

/** Adapta el JSON del ERP de España. */
export class AdaptadorEspana extends AdaptadorBase {
  readonly formato = 'JSON_ES' as const;
  readonly descripcion = 'JSON del ERP de España (campos articulo, uds, importe_unitario_eur)';
  private readonly erp = new ErpEspana();

  ejemplo(): string {
    return JSON.stringify(
      {
        periodo: '2026-10',
        ventas: [
          { id: 'ES-V-9001', fecha: '2026-10-05', articulo: 'LT-001', uds: 2, importe_unitario_eur: 899.9 },
          { id: 'ES-V-9002', fecha: '2026-10-06', articulo: 'SP-101', uds: 3, importe_unitario_eur: 429 },
        ],
        existencias: [
          { articulo: 'LT-001', unidades: 38 },
          { articulo: 'SP-101', unidades: 54 },
        ],
      },
      null,
      2,
    );
  }

  protected traducir(contenido: string, _moneda: Moneda, lote: LoteNormalizado): void {
    const datos = this.erp.leerExportacion(contenido);
    datos.ventas.forEach((v, i) =>
      this.agregarVenta(lote, `Venta ${i + 1}`, {
        referencia: v.id,
        fecha: v.fecha,
        sku: v.articulo,
        cantidad: Number(v.uds),
        precio: Number(v.importe_unitario_eur),
        moneda: 'EUR',
      }),
    );
    datos.existencias.forEach((e, i) => this.agregarStock(lote, `Existencia ${i + 1}`, e.articulo, Number(e.unidades)));
  }
}

/** Adapta el CSV del punto de venta de México. */
export class AdaptadorMexico extends AdaptadorBase {
  readonly formato = 'CSV_MX' as const;
  readonly descripcion = 'CSV del POS de México (tipo,folio,fecha DD/MM/AAAA,sku,cantidad,precio_mxn)';
  private readonly pos = new PosMexico();

  ejemplo(): string {
    return [
      'tipo,folio,fecha,sku,cantidad,precio_mxn',
      'VENTA,MX-F-5501,05/10/2026,LT-002,1,"21999.00"',
      'VENTA,MX-F-5502,07/10/2026,AC-201,4,349.50',
      'STOCK,,,LT-002,22,',
      'STOCK,,,AC-201,140,',
    ].join('\n');
  }

  protected traducir(contenido: string, moneda: Moneda, lote: LoteNormalizado): void {
    const [cabecera, ...filas] = this.pos.leerFilas(contenido);
    if (!cabecera || cabecera[0]?.toLowerCase() !== 'tipo') {
      throw new ErrorValidacion('Falta la cabecera "tipo,folio,fecha,sku,cantidad,precio_mxn".');
    }
    filas.forEach(([tipo, folio, fecha, sku, cantidad, precio], i) => {
      const origen = `Fila ${i + 2}`;
      if (tipo?.toUpperCase() === 'VENTA') {
        this.agregarVenta(lote, origen, {
          referencia: folio,
          fecha,
          sku,
          cantidad: Number(cantidad),
          precio: Number(precio),
          moneda,
        });
      } else if (tipo?.toUpperCase() === 'STOCK') {
        this.agregarStock(lote, origen, sku, Number(cantidad));
      } else {
        lote.advertencias.push(`${origen}: tipo "${tipo}" desconocido.`);
      }
    });
  }
}

/** Adapta el XML del sistema contable de Perú. */
export class AdaptadorPeru extends AdaptadorBase {
  readonly formato = 'XML_PE' as const;
  readonly descripcion = 'XML del sistema contable de Perú (<venta …/> y <stock …/>)';
  private readonly sistema = new SistemaContablePeru();

  ejemplo(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<reporte filial="PE" periodo="2026-10">',
      '  <venta codigo="PE-B-301" fecha="2026-10-04" producto="SP-102" cantidad="2" precio="1899.00"/>',
      '  <venta codigo="PE-B-302" fecha="2026-10-08" producto="RD-301" cantidad="5" precio="289.90"/>',
      '  <stock producto="SP-102" cantidad="31"/>',
      '  <stock producto="RD-301" cantidad="12"/>',
      '</reporte>',
    ].join('\n');
  }

  protected traducir(contenido: string, moneda: Moneda, lote: LoteNormalizado): void {
    const nodos = this.sistema.extraerNodos(contenido);
    if (!nodos.length) throw new ErrorValidacion('No se encontraron nodos <venta/> ni <stock/>.');
    nodos.forEach(({ etiqueta, atributos: a }, i) => {
      const origen = `Nodo ${i + 1}`;
      if (etiqueta === 'venta') {
        this.agregarVenta(lote, origen, {
          referencia: a['codigo'],
          fecha: a['fecha'],
          sku: a['producto'],
          cantidad: Number(a['cantidad']),
          precio: Number(a['precio']),
          moneda,
        });
      } else {
        this.agregarStock(lote, origen, a['producto'], Number(a['cantidad']));
      }
    });
  }
}

/** Adapta el formato del ERP alemán: ';' como separador, coma decimal, fechas DD.MM.AAAA. */
export class AdaptadorAlemania extends AdaptadorBase {
  readonly formato = 'CSV_DE' as const;
  readonly descripcion = 'Texto del ERP alemán ([VERKAUF] Beleg;Datum;Artikel;Menge;Preis — [BESTAND] Artikel;Menge)';
  private readonly erp = new WarenwirtschaftDeutschland();

  ejemplo(): string {
    return [
      '# Warenwirtschaft Export — Filiale Berlin',
      '[VERKAUF]',
      'DE-R-7001;03.10.2026;LT-003;1;1.249,00',
      'DE-R-7002;09.10.2026;RD-302;2;189,90',
      '[BESTAND]',
      'LT-003;17',
      'RD-302;45',
    ].join('\n');
  }

  protected traducir(contenido: string, moneda: Moneda, lote: LoteNormalizado): void {
    const zahl = (texto: string | undefined): number => Number((texto ?? '').replace(/\./g, '').replace(',', '.'));
    for (const [i, { abschnitt, felder }] of this.erp.lesen(contenido).entries()) {
      const origen = `Línea ${i + 1}`;
      if (abschnitt === 'VERKAUF') {
        const [beleg, datum, artikel, menge, preis] = felder;
        this.agregarVenta(lote, origen, {
          referencia: beleg,
          fecha: datum,
          sku: artikel,
          cantidad: zahl(menge),
          precio: zahl(preis),
          moneda,
        });
      } else if (abschnitt === 'BESTAND') {
        this.agregarStock(lote, origen, felder[0], zahl(felder[1]));
      } else {
        lote.advertencias.push(`${origen}: sección desconocida "${abschnitt}".`);
      }
    }
  }
}

/**
 * Formato estándar corporativo (JSON). Lo usan las filiales nuevas que no tienen
 * un sistema propio; también implementa la interfaz objetivo.
 */
export class AdaptadorEstandar extends AdaptadorBase {
  readonly formato = 'ESTANDAR' as const;
  readonly descripcion = 'JSON estándar de FinanCorp (ventas[] y inventario[])';

  ejemplo(): string {
    return JSON.stringify(
      {
        ventas: [{ referencia: 'CO-0001', fecha: '2026-10-10', sku: 'SP-103', cantidad: 2, precioUnitario: 1450000 }],
        inventario: [{ sku: 'SP-103', cantidad: 25 }],
      },
      null,
      2,
    );
  }

  protected traducir(contenido: string, moneda: Moneda, lote: LoteNormalizado): void {
    const datos = JSON.parse(contenido) as {
      ventas?: { referencia: string; fecha: string; sku: string; cantidad: number; precioUnitario: number }[];
      inventario?: { sku: string; cantidad: number }[];
    };
    (datos.ventas ?? []).forEach((v, i) =>
      this.agregarVenta(lote, `Venta ${i + 1}`, {
        referencia: v.referencia,
        fecha: v.fecha,
        sku: v.sku,
        cantidad: Number(v.cantidad),
        precio: Number(v.precioUnitario),
        moneda,
      }),
    );
    (datos.inventario ?? []).forEach((s, i) => this.agregarStock(lote, `Inventario ${i + 1}`, s.sku, Number(s.cantidad)));
  }
}
