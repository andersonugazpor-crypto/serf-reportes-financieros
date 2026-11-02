import { ConfiguracionCorporativa } from '../../configuracion/configuracion-corporativa';
import { Moneda } from '../../comun/dinero';
import { asegurar } from '../../comun/errores';
import { Grafico, Indicador, Parrafo, Seccion, Tabla } from '../composite/componentes';
import {
  Celda,
  ColumnaTabla,
  EstiloParrafo,
  FormatoIndicador,
  PuntoSerie,
  TipoGrafico,
} from '../composite/nodo-reporte';
import { Reporte } from '../decorator/reporte';
import { PlantillaReporte } from '../prototype/plantilla-reporte';

/**
 * Constructor fluido de una sección. Permite anidar subsecciones sin límite:
 *   s.parrafo('…').subseccion('Detalle', d => d.tabla(…).subseccion('Más', …))
 */
export class SeccionBuilder {
  constructor(private readonly seccion: Seccion) {}

  parrafo(texto: string, estilo: EstiloParrafo = 'normal'): this {
    this.seccion.agregar(new Parrafo(texto, estilo));
    return this;
  }

  tabla(titulo: string, columnas: ColumnaTabla[], filas: Celda[][], totales: Celda[] | null = null): this {
    this.seccion.agregar(new Tabla(titulo, columnas, filas, totales));
    return this;
  }

  grafico(titulo: string, tipo: TipoGrafico, serie: PuntoSerie[], unidad = ''): this {
    this.seccion.agregar(new Grafico(titulo, tipo, serie, unidad));
    return this;
  }

  indicador(
    etiqueta: string,
    valor: number,
    formato: FormatoIndicador,
    opciones: { moneda?: Moneda; alerta?: boolean; detalle?: string } = {},
  ): this {
    this.seccion.agregar(new Indicador(etiqueta, valor, formato, opciones));
    return this;
  }

  subseccion(titulo: string, configurar: (s: SeccionBuilder) => void): this {
    const sub = new Seccion(titulo);
    configurar(new SeccionBuilder(sub));
    this.seccion.agregar(sub);
    return this;
  }
}

/**
 * PATRÓN BUILDER — Constructor concreto con API fluida.
 *
 * Requisito complementario 3: "construir reportes complejos paso a paso, agregando
 * secciones, gráficos y tablas". Separa CÓMO se construye el reporte (pasos de
 * este builder) de su REPRESENTACIÓN final (`Reporte`), que solo se crea en
 * `construir()` después de validar que esté completo.
 *
 * Parte de un CLON de una plantilla (Prototype), por lo que nunca instancia la
 * estructura base directamente.
 */
export class ReporteBuilder {
  private titulo: string | null = null;
  private desde: string | null = null;
  private hasta: string | null = null;
  private filiales: string[] = [];
  private moneda: Moneda;
  private autor = 'sistema';
  private readonly marcadores: Record<string, string> = {};
  private readonly raiz: Seccion;
  private construido = false;

  private constructor(private readonly plantilla: PlantillaReporte) {
    this.raiz = plantilla.obtenerEstructura();
    this.moneda = plantilla.monedaPresentacion;
  }

  /** Punto de entrada: siempre a partir de una plantilla (clonada). */
  static desdePlantilla(plantilla: PlantillaReporte): ReporteBuilder {
    return new ReporteBuilder(plantilla);
  }

  conTitulo(titulo: string): this {
    asegurar(titulo.trim().length >= 3, 'El título del reporte es obligatorio.');
    this.titulo = titulo.trim();
    return this;
  }

  paraPeriodo(desde: string, hasta: string): this {
    asegurar(/^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta), 'Periodo inválido (AAAA-MM-DD).');
    asegurar(desde <= hasta, 'La fecha "desde" no puede ser posterior a "hasta".');
    this.desde = desde;
    this.hasta = hasta;
    return this;
  }

  deFiliales(codigos: string[]): this {
    asegurar(codigos.length > 0, 'El reporte debe incluir al menos una filial.');
    this.filiales = [...new Set(codigos)];
    return this;
  }

  enMoneda(moneda: Moneda): this {
    this.moneda = moneda;
    return this;
  }

  generadoPor(usuario: string): this {
    this.autor = usuario;
    return this;
  }

  conMarcador(clave: string, valor: string): this {
    this.marcadores[clave] = valor;
    return this;
  }

  /** Agrega contenido a una sección de la plantilla (por clave) o crea una sección nueva. */
  seccion(claveOTitulo: string, configurar: (s: SeccionBuilder) => void): this {
    let destino = this.raiz.buscarSeccion(claveOTitulo);
    if (!destino) {
      destino = new Seccion(claveOTitulo);
      this.raiz.agregar(destino);
    }
    configurar(new SeccionBuilder(destino));
    return this;
  }

  /** Producto final. Valida los pasos obligatorios antes de crear el reporte. */
  construir(): Reporte {
    asegurar(!this.construido, 'Este builder ya construyó un reporte; crea uno nuevo.');
    asegurar(this.titulo, 'Falta el título (conTitulo).');
    asegurar(this.desde && this.hasta, 'Falta el periodo (paraPeriodo).');
    asegurar(this.filiales.length > 0, 'Faltan las filiales (deFiliales).');
    asegurar(this.raiz.contarElementos() > 0, 'El reporte no tiene contenido.');

    this.raiz.recorrerSecciones((s) => {
      if (s.obtenerHijos().length === 0) s.agregar(new Parrafo('Sin datos para este apartado en el periodo.', 'nota'));
    });
    this.raiz.reemplazarMarcadores({
      ambito: this.plantilla.ambito === 'CORPORATIVO' ? 'FinanCorp (consolidado)' : this.plantilla.ambito,
      periodo: `${this.desde} al ${this.hasta}`,
      moneda: this.moneda,
      ...this.marcadores,
    });
    this.construido = true;

    return new Reporte(
      {
        titulo: this.titulo,
        tipo: this.plantilla.tipo,
        plantillaId: this.plantilla.id,
        ambito: this.plantilla.ambito,
        periodo: { desde: this.desde, hasta: this.hasta },
        filiales: this.filiales,
        moneda: this.moneda,
        locale: this.plantilla.locale,
        colorPrimario: this.plantilla.colorPrimario,
        empresa: ConfiguracionCorporativa.obtenerInstancia().empresa,
        generadoPor: this.autor,
        generadoEn: new Date().toISOString(),
      },
      this.raiz,
      this.plantilla.obtenerTextosLegales(),
    );
  }
}
