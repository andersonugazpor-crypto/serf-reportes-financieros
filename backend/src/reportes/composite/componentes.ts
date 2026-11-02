import { randomUUID } from 'node:crypto';
import { Moneda } from '../../comun/dinero';
import { asegurar, ErrorValidacion } from '../../comun/errores';
import {
  Celda,
  ColumnaTabla,
  EstiloParrafo,
  FormatoIndicador,
  NodoGrafico,
  NodoIndicador,
  NodoParrafo,
  NodoReporte,
  NodoSeccion,
  NodoTabla,
  PuntoSerie,
  TipoGrafico,
} from './nodo-reporte';

/**
 * PATRÓN COMPOSITE — Componente.
 *
 * Requisito complementario 5: "reportes con estructura jerárquica (secciones y subsecciones)".
 * Hojas (párrafos, tablas, gráficos, indicadores) y compuestos (secciones) comparten
 * esta interfaz, por lo que el resto del sistema los trata de forma uniforme:
 * se pueden contar, clonar, serializar o reemplazar marcadores sin preguntar su tipo.
 */
export abstract class ComponenteReporte {
  readonly id: string = randomUUID();

  abstract readonly tipo: NodoReporte['tipo'];

  /** Convierte el componente (y sus hijos) en un nodo serializable. */
  abstract aNodo(nivel?: number): NodoReporte;

  /** PROTOTYPE aplicado al árbol: copia profunda e independiente del original. */
  abstract clonar(): ComponenteReporte;

  /** Sustituye marcadores {{clave}} por valores (filial, periodo, moneda…). */
  abstract reemplazarMarcadores(valores: Readonly<Record<string, string>>): void;

  /** Cantidad de elementos de contenido (las hojas cuentan 1). */
  contarElementos(): number {
    return 1;
  }

  esCompuesto(): this is Seccion {
    return false;
  }

  protected static sustituir(texto: string, valores: Readonly<Record<string, string>>): string {
    return texto.replace(/\{\{(\w+)\}\}/g, (marca, clave: string) => valores[clave] ?? marca);
  }
}

/** PATRÓN COMPOSITE — Compuesto: una sección contiene componentes, incluidas otras secciones. */
export class Seccion extends ComponenteReporte {
  readonly tipo = 'seccion' as const;
  private readonly hijos: ComponenteReporte[] = [];

  constructor(
    private _titulo: string,
    /** Identificador estable para ubicar la sección dentro de una plantilla (p. ej. "resumen"). */
    readonly clave: string | null = null,
  ) {
    super();
    asegurar(_titulo.trim().length > 0, 'La sección necesita un título.');
  }

  get titulo(): string {
    return this._titulo;
  }

  agregar(...componentes: ComponenteReporte[]): this {
    for (const componente of componentes) {
      if (componente === this || (componente.esCompuesto() && componente.contiene(this))) {
        throw new ErrorValidacion('Una sección no puede contenerse a sí misma.');
      }
      this.hijos.push(componente);
    }
    return this;
  }

  quitar(id: string): boolean {
    const indice = this.hijos.findIndex((h) => h.id === id);
    if (indice < 0) return false;
    this.hijos.splice(indice, 1);
    return true;
  }

  /** Copia de la lista: desde fuera no se puede alterar el arreglo interno. */
  obtenerHijos(): readonly ComponenteReporte[] {
    return [...this.hijos];
  }

  override esCompuesto(): this is Seccion {
    return true;
  }

  override contarElementos(): number {
    return this.hijos.reduce((total, hijo) => total + hijo.contarElementos(), 0);
  }

  /** Profundidad del árbol bajo esta sección (sin límite de anidamiento). */
  profundidad(): number {
    const sub = this.hijos.filter((h): h is Seccion => h.esCompuesto()).map((s) => s.profundidad());
    return 1 + (sub.length ? Math.max(...sub) : 0);
  }

  contiene(componente: ComponenteReporte): boolean {
    return this.hijos.some((h) => h === componente || (h.esCompuesto() && h.contiene(componente)));
  }

  /** Busca recursivamente una sección por su clave. */
  buscarSeccion(clave: string): Seccion | undefined {
    if (this.clave === clave) return this;
    for (const hijo of this.hijos) {
      if (hijo.esCompuesto()) {
        const encontrada = hijo.buscarSeccion(clave);
        if (encontrada) return encontrada;
      }
    }
    return undefined;
  }

  /** Recorre todas las secciones (pre-orden) con su nivel. */
  recorrerSecciones(visita: (seccion: Seccion, nivel: number) => void, nivel = 1): void {
    visita(this, nivel);
    this.hijos.filter((h): h is Seccion => h.esCompuesto()).forEach((s) => s.recorrerSecciones(visita, nivel + 1));
  }

  override reemplazarMarcadores(valores: Readonly<Record<string, string>>): void {
    this._titulo = ComponenteReporte.sustituir(this._titulo, valores);
    this.hijos.forEach((h) => h.reemplazarMarcadores(valores));
  }

  override clonar(): Seccion {
    const copia = new Seccion(this._titulo, this.clave);
    this.hijos.forEach((h) => copia.agregar(h.clonar()));
    return copia;
  }

  override aNodo(nivel = 1): NodoSeccion {
    return {
      tipo: 'seccion',
      id: this.id,
      clave: this.clave,
      titulo: this._titulo,
      nivel,
      hijos: this.hijos.map((h) => h.aNodo(nivel + 1)),
    };
  }
}

/** Hoja: bloque de texto. */
export class Parrafo extends ComponenteReporte {
  readonly tipo = 'parrafo' as const;

  constructor(
    private texto: string,
    private readonly estilo: EstiloParrafo = 'normal',
  ) {
    super();
  }

  override reemplazarMarcadores(valores: Readonly<Record<string, string>>): void {
    this.texto = ComponenteReporte.sustituir(this.texto, valores);
  }

  override clonar(): Parrafo {
    return new Parrafo(this.texto, this.estilo);
  }

  override aNodo(): NodoParrafo {
    return { tipo: 'parrafo', id: this.id, texto: this.texto, estilo: this.estilo };
  }
}

/** Hoja: tabla de datos con fila opcional de totales. */
export class Tabla extends ComponenteReporte {
  readonly tipo = 'tabla' as const;
  private readonly columnas: ColumnaTabla[];
  private readonly filas: Celda[][];
  private readonly totales: Celda[] | null;

  constructor(
    private titulo: string,
    columnas: ColumnaTabla[],
    filas: Celda[][],
    totales: Celda[] | null = null,
  ) {
    super();
    asegurar(columnas.length > 0, 'La tabla necesita al menos una columna.');
    asegurar(
      filas.every((f) => f.length === columnas.length),
      `Todas las filas de la tabla "${titulo}" deben tener ${columnas.length} celdas.`,
    );
    // Copias defensivas: cambios externos en los arreglos no afectan a la tabla.
    this.columnas = columnas.map((c) => ({ ...c }));
    this.filas = filas.map((f) => [...f]);
    this.totales = totales ? [...totales] : null;
  }

  get cantidadFilas(): number {
    return this.filas.length;
  }

  override reemplazarMarcadores(valores: Readonly<Record<string, string>>): void {
    this.titulo = ComponenteReporte.sustituir(this.titulo, valores);
  }

  override clonar(): Tabla {
    return new Tabla(this.titulo, this.columnas, this.filas, this.totales);
  }

  override aNodo(): NodoTabla {
    return {
      tipo: 'tabla',
      id: this.id,
      titulo: this.titulo,
      columnas: this.columnas.map((c) => ({ ...c })),
      filas: this.filas.map((f) => [...f]),
      totales: this.totales ? [...this.totales] : null,
    };
  }
}

/** Hoja: gráfico simple (barras, línea o torta). */
export class Grafico extends ComponenteReporte {
  readonly tipo = 'grafico' as const;
  private readonly serie: PuntoSerie[];

  constructor(
    private titulo: string,
    private readonly tipoGrafico: TipoGrafico,
    serie: PuntoSerie[],
    private readonly unidad = '',
  ) {
    super();
    this.serie = serie.map((p) => ({ ...p }));
  }

  override reemplazarMarcadores(valores: Readonly<Record<string, string>>): void {
    this.titulo = ComponenteReporte.sustituir(this.titulo, valores);
  }

  override clonar(): Grafico {
    return new Grafico(this.titulo, this.tipoGrafico, this.serie, this.unidad);
  }

  override aNodo(): NodoGrafico {
    return {
      tipo: 'grafico',
      id: this.id,
      titulo: this.titulo,
      tipoGrafico: this.tipoGrafico,
      unidad: this.unidad,
      serie: this.serie.map((p) => ({ ...p })),
    };
  }
}

/** Hoja: indicador clave (KPI). */
export class Indicador extends ComponenteReporte {
  readonly tipo = 'indicador' as const;

  constructor(
    private etiqueta: string,
    private readonly valor: number,
    private readonly formato: FormatoIndicador,
    private readonly opciones: { moneda?: Moneda; alerta?: boolean; detalle?: string } = {},
  ) {
    super();
    asegurar(Number.isFinite(valor), `Valor inválido para el indicador "${etiqueta}".`);
  }

  override reemplazarMarcadores(valores: Readonly<Record<string, string>>): void {
    this.etiqueta = ComponenteReporte.sustituir(this.etiqueta, valores);
  }

  override clonar(): Indicador {
    return new Indicador(this.etiqueta, this.valor, this.formato, { ...this.opciones });
  }

  override aNodo(): NodoIndicador {
    return {
      tipo: 'indicador',
      id: this.id,
      etiqueta: this.etiqueta,
      valor: this.valor,
      formato: this.formato,
      moneda: this.opciones.moneda ?? null,
      alerta: this.opciones.alerta ?? false,
      detalle: this.opciones.detalle ?? null,
    };
  }
}
