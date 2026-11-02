/**
 * "Adaptees" del patrón Adapter: simulan los sistemas que ya usa cada filial.
 * Cada uno tiene su propia interfaz, incompatible con la de SERF, y no se
 * modifican: los adaptadores los envuelven.
 */

/** ERP de la sede de España: exporta JSON con nombres de campo propios. */
export interface ExportacionErpEspana {
  periodo?: string;
  ventas: { id: string; fecha: string; articulo: string; uds: number; importe_unitario_eur: number }[];
  existencias: { articulo: string; unidades: number }[];
}

export class ErpEspana {
  leerExportacion(json: string): ExportacionErpEspana {
    const datos = JSON.parse(json) as Partial<ExportacionErpEspana>;
    return { periodo: datos.periodo, ventas: datos.ventas ?? [], existencias: datos.existencias ?? [] };
  }
}

/** Punto de venta de México: genera CSV separado por comas, con comillas opcionales. */
export class PosMexico {
  leerFilas(csv: string): string[][] {
    return csv
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0)
      .map((linea) => {
        const celdas: string[] = [];
        let actual = '';
        let entreComillas = false;
        for (const caracter of linea) {
          if (caracter === '"') entreComillas = !entreComillas;
          else if (caracter === ',' && !entreComillas) {
            celdas.push(actual.trim());
            actual = '';
          } else actual += caracter;
        }
        celdas.push(actual.trim());
        return celdas;
      });
  }
}

/** Sistema contable de Perú: exporta XML con atributos. */
export interface NodoXml {
  etiqueta: string;
  atributos: Record<string, string>;
}

export class SistemaContablePeru {
  extraerNodos(xml: string): NodoXml[] {
    const nodos: NodoXml[] = [];
    const patronNodo = /<(venta|stock)\b([^>]*)\/>/g;
    const patronAtributo = /(\w+)="([^"]*)"/g;
    let nodo: RegExpExecArray | null;
    while ((nodo = patronNodo.exec(xml))) {
      const atributos: Record<string, string> = {};
      let atributo: RegExpExecArray | null;
      while ((atributo = patronAtributo.exec(nodo[2]))) atributos[atributo[1]] = atributo[2];
      nodos.push({ etiqueta: nodo[1], atributos });
    }
    return nodos;
  }
}

/** ERP de Alemania (Warenwirtschaft): secciones [VERKAUF] y [BESTAND], separador ';' y coma decimal. */
export interface FilaWarenwirtschaft {
  abschnitt: string;
  felder: string[];
}

export class WarenwirtschaftDeutschland {
  lesen(text: string): FilaWarenwirtschaft[] {
    let abschnitt = '';
    const filas: FilaWarenwirtschaft[] = [];
    for (const roh of text.split(/\r?\n/)) {
      const zeile = roh.trim();
      if (!zeile || zeile.startsWith('#')) continue;
      const kopf = /^\[(\w+)\]$/.exec(zeile);
      if (kopf) {
        abschnitt = kopf[1].toUpperCase();
        continue;
      }
      filas.push({ abschnitt, felder: zeile.split(';').map((f) => f.trim()) });
    }
    return filas;
  }
}
