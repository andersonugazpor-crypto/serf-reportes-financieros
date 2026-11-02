import { randomUUID } from 'node:crypto';
import { Moneda } from '../../comun/dinero';
import { Seccion } from '../composite/componentes';
import { NodoSeccion } from '../composite/nodo-reporte';
import { TipoReporte } from '../prototype/plantilla-reporte';

export interface MetadatosReporte {
  id: string;
  titulo: string;
  tipo: TipoReporte;
  plantillaId: string;
  ambito: string;
  periodo: { desde: string; hasta: string };
  filiales: string[];
  moneda: Moneda;
  locale: string;
  colorPrimario: string;
  empresa: string;
  generadoPor: string;
  generadoEn: string;
}

export interface EntradaIndice {
  nivel: number;
  titulo: string;
  numeracion: string;
}

export interface FirmaReporte {
  algoritmo: 'HMAC-SHA256';
  valor: string;
  firmadoPor: string;
  firmadoEn: string;
}

export type NivelConfidencialidad = 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO';

/** Documento final listo para mostrar o exportar. */
export interface DocumentoReporte {
  metadatos: MetadatosReporte;
  cuerpo: NodoSeccion;
  encabezados: string[];
  pies: string[];
  marcasAgua: string[];
  confidencialidad: NivelConfidencialidad | null;
  indice: EntradaIndice[];
  firma: FirmaReporte | null;
  /** Capas (decoradores) aplicadas, en orden, para trazabilidad. */
  capas: string[];
}

/**
 * PATRÓN DECORATOR — Componente.
 * Interfaz común del reporte base y de todos los decoradores.
 */
export interface IReporte {
  obtenerDocumento(): DocumentoReporte;
}

/**
 * PATRÓN DECORATOR — Componente concreto.
 * Es el reporte que produce el Builder. Su estructura (el árbol Composite)
 * no se modifica cuando se le agregan características extra.
 */
export class Reporte implements IReporte {
  readonly id = randomUUID();

  constructor(
    private readonly metadatos: Omit<MetadatosReporte, 'id'>,
    private readonly cuerpo: Seccion,
    private readonly textosLegales: readonly string[],
  ) {}

  get titulo(): string {
    return this.metadatos.titulo;
  }

  get tipo(): TipoReporte {
    return this.metadatos.tipo;
  }

  /** Copia del árbol: quien lo pida no puede modificar el reporte. */
  obtenerCuerpo(): Seccion {
    return this.cuerpo.clonar();
  }

  contarElementos(): number {
    return this.cuerpo.contarElementos();
  }

  obtenerDocumento(): DocumentoReporte {
    return {
      metadatos: { ...this.metadatos, id: this.id, filiales: [...this.metadatos.filiales] },
      cuerpo: this.cuerpo.aNodo(),
      encabezados: [`${this.metadatos.empresa} — ${this.metadatos.titulo}`],
      pies: [...this.textosLegales],
      marcasAgua: [],
      confidencialidad: null,
      indice: [],
      firma: null,
      capas: ['Reporte base'],
    };
  }
}
