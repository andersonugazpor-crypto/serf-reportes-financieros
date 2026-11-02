import { Moneda } from '../../comun/dinero';
import { Parrafo, Seccion } from '../composite/componentes';

export type TipoReporte = 'VENTAS' | 'INVENTARIO' | 'RENTABILIDAD' | 'EJECUTIVO';

export const TIPOS_REPORTE: readonly TipoReporte[] = ['VENTAS', 'INVENTARIO', 'RENTABILIDAD', 'EJECUTIVO'];

/** Interfaz genérica del patrón Prototype. */
export interface Prototipo<T> {
  clonar(): T;
}

export interface EstiloPlantilla {
  colorPrimario: string;
  logoTexto: string;
}

export interface DatosPlantilla {
  id: string;
  nombre: string;
  tipo: TipoReporte;
  ambito: string;
  locale: string;
  monedaPresentacion: Moneda;
  estilo: EstiloPlantilla;
  normativa: string;
  textosLegales: string[];
  estructura: Seccion;
}

export interface PlantillaDto {
  id: string;
  nombre: string;
  tipo: TipoReporte;
  ambito: string;
  locale: string;
  monedaPresentacion: Moneda;
  estilo: EstiloPlantilla;
  normativa: string;
  textosLegales: string[];
  secciones: string[];
  esBase: boolean;
}

/**
 * PATRÓN PROTOTYPE — Plantilla base de reporte.
 *
 * Requisito complementario 2: "reutilizar plantillas base de reportes para adaptarlas
 * a diferentes países". En lugar de construir cada plantilla desde cero (o con un
 * `new` acoplado a cada país), se clona una plantilla base y se personaliza la copia.
 *
 * `clonar()` hace una COPIA PROFUNDA: el estilo, los textos legales y todo el árbol
 * Composite de secciones son objetos nuevos, así que modificar el clon nunca
 * altera la plantilla original.
 */
export class PlantillaReporte implements Prototipo<PlantillaReporte> {
  private _id: string;
  private _nombre: string;
  readonly tipo: TipoReporte;
  private _ambito: string;
  private _locale: string;
  private _monedaPresentacion: Moneda;
  private readonly estilo: EstiloPlantilla;
  private _normativa: string;
  private readonly textosLegales: string[];
  private readonly estructura: Seccion;
  private _esBase: boolean;

  constructor(datos: DatosPlantilla, esBase = true) {
    this._id = datos.id;
    this._nombre = datos.nombre;
    this.tipo = datos.tipo;
    this._ambito = datos.ambito;
    this._locale = datos.locale;
    this._monedaPresentacion = datos.monedaPresentacion;
    this.estilo = { ...datos.estilo };
    this._normativa = datos.normativa;
    this.textosLegales = [...datos.textosLegales];
    this.estructura = datos.estructura;
    this._esBase = esBase;
  }

  get id(): string {
    return this._id;
  }
  get nombre(): string {
    return this._nombre;
  }
  get ambito(): string {
    return this._ambito;
  }
  get locale(): string {
    return this._locale;
  }
  get monedaPresentacion(): Moneda {
    return this._monedaPresentacion;
  }
  get normativa(): string {
    return this._normativa;
  }
  get esBase(): boolean {
    return this._esBase;
  }
  get colorPrimario(): string {
    return this.estilo.colorPrimario;
  }
  get logoTexto(): string {
    return this.estilo.logoTexto;
  }
  obtenerTextosLegales(): readonly string[] {
    return [...this.textosLegales];
  }

  /** Copia profunda: la única forma de obtener nuevas plantillas a partir de una base. */
  clonar(): PlantillaReporte {
    return new PlantillaReporte(
      {
        id: this._id,
        nombre: this._nombre,
        tipo: this.tipo,
        ambito: this._ambito,
        locale: this._locale,
        monedaPresentacion: this._monedaPresentacion,
        estilo: { ...this.estilo },
        normativa: this._normativa,
        textosLegales: [...this.textosLegales],
        estructura: this.estructura.clonar(),
      },
      false,
    );
  }

  /** Adapta la copia a un país: ámbito, formato numérico, normativa y moneda. */
  personalizarPara(opciones: {
    ambito: string;
    nombre: string;
    locale: string;
    normativa: string;
    monedaPresentacion?: Moneda;
    textoLegalLocal?: string;
    colorPrimario?: string;
  }): this {
    this._ambito = opciones.ambito;
    this._id = `${this.tipo.toLowerCase()}-${opciones.ambito.toLowerCase()}`;
    this._nombre = opciones.nombre;
    this._locale = opciones.locale;
    this._normativa = opciones.normativa;
    if (opciones.monedaPresentacion) this._monedaPresentacion = opciones.monedaPresentacion;
    if (opciones.colorPrimario) this.estilo.colorPrimario = opciones.colorPrimario;
    if (opciones.textoLegalLocal) this.textosLegales.push(opciones.textoLegalLocal);
    this.estructura
      .buscarSeccion('notas')
      ?.agregar(new Parrafo(`Elaborado conforme a: ${opciones.normativa}.`, 'nota'));
    return this;
  }

  /**
   * Entrega una copia del árbol de secciones para construir un reporte.
   * El Builder trabaja sobre esa copia; la plantilla nunca se altera.
   */
  obtenerEstructura(): Seccion {
    return this.estructura.clonar();
  }

  aDto(): PlantillaDto {
    const secciones: string[] = [];
    this.estructura.recorrerSecciones((s, nivel) => {
      if (nivel > 1) secciones.push(`${'  '.repeat(nivel - 2)}${s.titulo}`);
    });
    return {
      id: this._id,
      nombre: this._nombre,
      tipo: this.tipo,
      ambito: this._ambito,
      locale: this._locale,
      monedaPresentacion: this._monedaPresentacion,
      estilo: { ...this.estilo },
      normativa: this._normativa,
      textosLegales: [...this.textosLegales],
      secciones,
      esBase: this._esBase,
    };
  }
}
