import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfiguracionCorporativa } from '../../configuracion/configuracion-corporativa';
import { asegurar } from '../../comun/errores';
import { NodoReporte } from '../composite/nodo-reporte';
import { DocumentoReporte, EntradaIndice, IReporte, NivelConfidencialidad } from './reporte';

/**
 * PATRÓN DECORATOR — Decorador abstracto.
 *
 * Requisito complementario 6: "añadir características extra a los reportes sin
 * modificar su estructura original". Cada decorador envuelve un IReporte, delega
 * en él y agrega una sola característica sobre una COPIA del documento.
 * Los decoradores se apilan como capas en cualquier orden y cantidad.
 */
export abstract class DecoradorReporte implements IReporte {
  protected abstract readonly nombreCapa: string;

  constructor(protected readonly envuelto: IReporte) {}

  obtenerDocumento(): DocumentoReporte {
    const documento = this.envuelto.obtenerDocumento();
    const decorado = this.decorar(documento);
    return { ...decorado, capas: [...decorado.capas, this.nombreCapa] };
  }

  protected abstract decorar(documento: DocumentoReporte): DocumentoReporte;
}

/** Agrega una marca de agua (p. ej. "BORRADOR"). */
export class MarcaAguaDecorator extends DecoradorReporte {
  protected readonly nombreCapa: string;

  constructor(
    envuelto: IReporte,
    private readonly texto: string,
  ) {
    super(envuelto);
    asegurar(texto.trim().length > 0, 'La marca de agua necesita un texto.');
    this.nombreCapa = `Marca de agua "${texto}"`;
  }

  protected decorar(doc: DocumentoReporte): DocumentoReporte {
    return { ...doc, marcasAgua: [...doc.marcasAgua, this.texto.trim().toUpperCase()] };
  }
}

/** Clasifica el reporte y agrega la advertencia correspondiente en encabezado y pie. */
export class ConfidencialDecorator extends DecoradorReporte {
  protected readonly nombreCapa: string;

  private static readonly AVISOS: Record<NivelConfidencialidad, string> = {
    INTERNO: 'USO INTERNO — Solo para personal de FinanCorp.',
    CONFIDENCIAL: 'CONFIDENCIAL — Distribución limitada a gerencia y área financiera.',
    RESTRINGIDO: 'RESTRINGIDO — Solo directorio. Prohibida su reproducción.',
  };

  constructor(
    envuelto: IReporte,
    private readonly nivel: NivelConfidencialidad,
  ) {
    super(envuelto);
    this.nombreCapa = `Clasificación ${nivel}`;
  }

  protected decorar(doc: DocumentoReporte): DocumentoReporte {
    const aviso = ConfidencialDecorator.AVISOS[this.nivel];
    return {
      ...doc,
      confidencialidad: this.nivel,
      encabezados: [aviso, ...doc.encabezados],
      pies: [...doc.pies, aviso],
    };
  }
}

/** Agrega el aviso legal corporativo definido en la configuración centralizada (Singleton). */
export class PieLegalDecorator extends DecoradorReporte {
  protected readonly nombreCapa = 'Aviso legal corporativo';

  protected decorar(doc: DocumentoReporte): DocumentoReporte {
    const config = ConfiguracionCorporativa.obtenerInstancia();
    return { ...doc, pies: [...doc.pies, config.avisoLegal] };
  }
}

/** Genera un índice numerado (1, 1.1, 1.1.1…) recorriendo el árbol Composite. */
export class IndiceDecorator extends DecoradorReporte {
  protected readonly nombreCapa = 'Índice de contenidos';

  protected decorar(doc: DocumentoReporte): DocumentoReporte {
    const indice: EntradaIndice[] = [];
    const recorrer = (nodos: NodoReporte[], prefijo: string, nivel: number): void => {
      let n = 0;
      for (const nodo of nodos) {
        if (nodo.tipo !== 'seccion') continue;
        n++;
        const numeracion = prefijo ? `${prefijo}.${n}` : `${n}`;
        indice.push({ nivel, titulo: nodo.titulo, numeracion });
        recorrer(nodo.hijos, numeracion, nivel + 1);
      }
    };
    recorrer(doc.cuerpo.hijos, '', 1);
    return { ...doc, indice };
  }
}

/**
 * Firma el documento con HMAC-SHA256 usando el secreto de la configuración central.
 * Debe ser la última capa, para que la firma cubra todo lo agregado antes.
 * Cualquier cambio posterior en el contenido invalida la firma (integridad).
 */
export class FirmaDigitalDecorator extends DecoradorReporte {
  protected readonly nombreCapa = 'Firma digital HMAC-SHA256';

  constructor(
    envuelto: IReporte,
    private readonly firmante: string,
  ) {
    super(envuelto);
  }

  protected decorar(doc: DocumentoReporte): DocumentoReporte {
    const capas = [...doc.capas, this.nombreCapa];
    const sinFirma: DocumentoReporte = { ...doc, firma: null, capas };
    return {
      ...doc,
      firma: {
        algoritmo: 'HMAC-SHA256',
        valor: VerificadorFirma.calcular(sinFirma),
        firmadoPor: this.firmante,
        firmadoEn: new Date().toISOString(),
      },
    };
  }
}

/** Calcula y verifica firmas de documentos. */
export class VerificadorFirma {
  static calcular(documento: DocumentoReporte): string {
    const secreto = ConfiguracionCorporativa.obtenerInstancia().secretoDeFirma;
    return createHmac('sha256', secreto)
      .update(VerificadorFirma.canonico({ ...documento, firma: null }))
      .digest('hex');
  }

  static verificar(documento: DocumentoReporte): boolean {
    if (!documento.firma) return false;
    const esperado = Buffer.from(VerificadorFirma.calcular(documento), 'hex');
    const recibido = Buffer.from(documento.firma.valor, 'hex');
    return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
  }

  /** JSON con claves ordenadas: el mismo contenido siempre produce la misma firma. */
  private static canonico(valor: unknown): string {
    if (Array.isArray(valor)) return `[${valor.map((v) => VerificadorFirma.canonico(v)).join(',')}]`;
    if (valor && typeof valor === 'object') {
      const entradas = Object.entries(valor as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${VerificadorFirma.canonico(v)}`).join(',')}}`;
    }
    return JSON.stringify(valor);
  }
}
