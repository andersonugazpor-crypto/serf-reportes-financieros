import { Moneda } from '../../comun/dinero';
import { ErrorNoEncontrado } from '../../comun/errores';
import { Parrafo, Seccion } from '../composite/componentes';
import { PlantillaReporte, TipoReporte } from './plantilla-reporte';

/** Datos de localización de cada país para personalizar las plantillas clonadas. */
export interface PerfilPais {
  ambito: string;
  nombrePais: string;
  locale: string;
  normativa: string;
  monedaLocal: Moneda;
  textoLegal: string;
}

export const PERFILES_PAIS: Readonly<Record<string, PerfilPais>> = {
  CORPORATIVO: {
    ambito: 'CORPORATIVO',
    nombrePais: 'Corporativo',
    locale: 'es-ES',
    normativa: 'NIIF (Normas Internacionales de Información Financiera)',
    monedaLocal: 'EUR',
    textoLegal: 'Reporte consolidado del grupo FinanCorp S.A. y filiales.',
  },
  ES: {
    ambito: 'ES',
    nombrePais: 'España',
    locale: 'es-ES',
    normativa: 'Plan General de Contabilidad (PGC) de España',
    monedaLocal: 'EUR',
    textoLegal: 'Información sujeta al Reglamento General de Protección de Datos (RGPD).',
  },
  MX: {
    ambito: 'MX',
    nombrePais: 'México',
    locale: 'es-MX',
    normativa: 'Normas de Información Financiera (NIF) de México',
    monedaLocal: 'MXN',
    textoLegal: 'Cifras fiscales sujetas a revisión del SAT.',
  },
  PE: {
    ambito: 'PE',
    nombrePais: 'Perú',
    locale: 'es-PE',
    normativa: 'Plan Contable General Empresarial (PCGE) — SUNAT',
    monedaLocal: 'PEN',
    textoLegal: 'Montos expresados según tipo de cambio de referencia SBS.',
  },
  DE: {
    ambito: 'DE',
    nombrePais: 'Alemania',
    locale: 'de-DE',
    normativa: 'Handelsgesetzbuch (HGB)',
    monedaLocal: 'EUR',
    textoLegal: 'Vertraulich — nur für den internen Gebrauch.',
  },
  CO: {
    ambito: 'CO',
    nombrePais: 'Colombia',
    locale: 'es-CO',
    normativa: 'NIIF adoptadas en Colombia (Decreto 2420 de 2015)',
    monedaLocal: 'COP',
    textoLegal: 'Información reportable a la Superintendencia de Sociedades.',
  },
};

/** Crea la estructura común de secciones que comparten todas las plantillas base. */
function estructuraBase(titulo: string, seccionesAnalisis: { clave: string; titulo: string }[]): Seccion {
  const raiz = new Seccion(titulo, 'raiz');
  raiz.agregar(
    new Seccion('Resumen ejecutivo', 'resumen').agregar(
      new Parrafo('Reporte de {{ambito}} correspondiente al periodo {{periodo}}. Cifras expresadas en {{moneda}}.'),
    ),
  );
  const analisis = new Seccion('Análisis detallado', 'analisis');
  seccionesAnalisis.forEach((s) => analisis.agregar(new Seccion(s.titulo, s.clave)));
  raiz.agregar(analisis);
  raiz.agregar(new Seccion('Notas y alertas', 'notas'));
  return raiz;
}

/**
 * PATRÓN PROTOTYPE — Registro (gestor) de prototipos.
 *
 * Guarda una plantilla base por tipo de reporte. Cuando se necesita una plantilla
 * para un país, se CLONA la base y se personaliza la copia; nunca se instancia
 * una plantilla concreta desde el código cliente.
 */
export class RegistroPlantillas {
  private readonly bases = new Map<TipoReporte, PlantillaReporte>();

  constructor() {
    const estilo = { colorPrimario: '#1e3a8a', logoTexto: 'FinanCorp' };
    const comun = { ambito: 'BASE', locale: 'es-ES', monedaPresentacion: 'EUR' as Moneda, estilo, normativa: 'NIIF' };
    const legal = ['Documento generado automáticamente por SERF.'];

    this.registrar(
      new PlantillaReporte({
        ...comun,
        id: 'ventas-base',
        nombre: 'Reporte de ventas',
        tipo: 'VENTAS',
        textosLegales: legal,
        estructura: estructuraBase('Reporte de ventas — {{ambito}}', [
          { clave: 'ventas-filial', titulo: 'Ventas por filial' },
          { clave: 'ventas-categoria', titulo: 'Ventas por categoría' },
          { clave: 'ventas-tendencia', titulo: 'Tendencia mensual' },
        ]),
      }),
    );
    this.registrar(
      new PlantillaReporte({
        ...comun,
        id: 'inventario-base',
        nombre: 'Reporte de inventario',
        tipo: 'INVENTARIO',
        textosLegales: legal,
        estructura: estructuraBase('Reporte de inventario — {{ambito}}', [
          { clave: 'inventario-filial', titulo: 'Existencias por filial' },
          { clave: 'inventario-criticos', titulo: 'Productos con stock crítico' },
        ]),
      }),
    );
    this.registrar(
      new PlantillaReporte({
        ...comun,
        id: 'rentabilidad-base',
        nombre: 'Reporte de rentabilidad',
        tipo: 'RENTABILIDAD',
        textosLegales: legal,
        estructura: estructuraBase('Reporte de rentabilidad — {{ambito}}', [
          { clave: 'margen-filial', titulo: 'Margen bruto por filial' },
          { clave: 'margen-producto', titulo: 'Productos más rentables' },
        ]),
      }),
    );
    this.registrar(
      new PlantillaReporte({
        ...comun,
        id: 'ejecutivo-base',
        nombre: 'Reporte financiero ejecutivo',
        tipo: 'EJECUTIVO',
        textosLegales: legal,
        estructura: estructuraBase('Reporte financiero corporativo — {{ambito}}', [
          { clave: 'ventas', titulo: 'Ventas' },
          { clave: 'rentabilidad', titulo: 'Rentabilidad' },
          { clave: 'inventario', titulo: 'Inventario' },
        ]),
      }),
    );
  }

  registrar(base: PlantillaReporte): void {
    this.bases.set(base.tipo, base);
  }

  /** Devuelve un CLON de la plantilla base, personalizado para el ámbito pedido. */
  obtener(tipo: TipoReporte, ambito: string = 'CORPORATIVO'): PlantillaReporte {
    const base = this.bases.get(tipo);
    if (!base) throw new ErrorNoEncontrado('Plantilla', tipo);
    const perfil = PERFILES_PAIS[ambito] ?? PERFILES_PAIS['CORPORATIVO'];
    return base.clonar().personalizarPara({
      ambito: perfil.ambito,
      nombre: `${base.nombre} — ${perfil.nombrePais}`,
      locale: perfil.locale,
      normativa: perfil.normativa,
      textoLegalLocal: perfil.textoLegal,
    });
  }

  /** Plantillas base sin personalizar (solo lectura: se devuelven clones). */
  listarBases(): PlantillaReporte[] {
    return [...this.bases.values()].map((b) => b.clonar());
  }

  /** Todas las variantes por país que se pueden obtener por clonación. */
  listarVariantes(): PlantillaReporte[] {
    return [...this.bases.keys()].flatMap((tipo) => Object.keys(PERFILES_PAIS).map((ambito) => this.obtener(tipo, ambito)));
  }
}
