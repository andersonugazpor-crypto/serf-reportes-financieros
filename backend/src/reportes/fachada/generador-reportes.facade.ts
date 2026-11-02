import { Inject, Injectable } from '@nestjs/common';
import { Identificable } from '../../comun/entidad';
import { ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores';
import { REPO_REPORTES } from '../../comun/tokens';
import { Usuario } from '../../auth/auth.service';
import { FilialesService } from '../../filiales/filiales.service';
import { Repositorio } from '../../infraestructura/persistencia/repositorio';
import { DirectorReportes } from '../builder/director-reportes';
import { ReporteBuilder } from '../builder/reporte-builder';
import { ConsolidacionService } from '../consolidacion/consolidacion.service';
import {
  ConfidencialDecorator,
  FirmaDigitalDecorator,
  IndiceDecorator,
  MarcaAguaDecorator,
  PieLegalDecorator,
  VerificadorFirma,
} from '../decorator/decoradores';
import { DocumentoReporte, IReporte, NivelConfidencialidad } from '../decorator/reporte';
import { ArchivoExportado, FabricaExportadores, FormatoExportacion } from '../exportacion/exportadores';
import { RegistroPlantillas } from '../prototype/registro-plantillas';
import { TipoReporte } from '../prototype/plantilla-reporte';

export interface OpcionesReporte {
  marcaAgua?: string;
  confidencialidad?: NivelConfidencialidad;
  indice?: boolean;
  pieLegal?: boolean;
  firmar?: boolean;
}

export interface SolicitudReporte {
  tipo: TipoReporte;
  desde: string;
  hasta: string;
  filiales: string[];
  formato?: FormatoExportacion;
  titulo?: string;
  opciones?: OpcionesReporte;
}

export interface ResultadoReporte {
  id: string;
  documento: DocumentoReporte;
  archivo: ArchivoExportado;
  resumen: { elementos: number; secciones: number; capas: string[] };
}

/** Reporte generado que se guarda para descargarlo o verificarlo después. */
export class RegistroReporte implements Identificable {
  constructor(
    readonly id: string,
    readonly documento: DocumentoReporte,
    readonly usuario: string,
  ) {}
}

const TITULOS: Record<TipoReporte, string> = {
  VENTAS: 'Reporte de ventas',
  INVENTARIO: 'Reporte de inventario',
  RENTABILIDAD: 'Reporte de rentabilidad',
  EJECUTIVO: 'Reporte financiero corporativo',
};

/**
 * PATRÓN FACADE — Interfaz simplificada del subsistema de reportes.
 *
 * Requisito complementario 4: "ofrecer a los usuarios una interfaz simple para generar
 * reportes listos para ser enviados". Con UNA llamada (`generar` o `generarRapido`)
 * el cliente obtiene el reporte terminado, sin conocer que por dentro intervienen:
 *  1. ConsolidacionService (cifras unificadas),
 *  2. RegistroPlantillas (Prototype: clon de la plantilla del país),
 *  3. ReporteBuilder + DirectorReportes (Builder: construcción paso a paso),
 *  4. Decoradores (características extra apiladas),
 *  5. FabricaExportadores (formato de salida).
 */
@Injectable()
export class GeneradorReportesFacade {
  private readonly plantillas = new RegistroPlantillas();
  private readonly director = new DirectorReportes();
  private readonly exportadores = new FabricaExportadores();

  constructor(
    private readonly consolidacion: ConsolidacionService,
    private readonly filiales: FilialesService,
    @Inject(REPO_REPORTES) private readonly historial: Repositorio<RegistroReporte>,
  ) {}

  generar(solicitud: SolicitudReporte, usuario: Usuario): ResultadoReporte {
    if (!TITULOS[solicitud.tipo]) throw new ErrorValidacion(`Tipo de reporte inválido: ${solicitud.tipo}`);
    const datos = this.consolidacion.consolidar(solicitud.desde, solicitud.hasta, solicitud.filiales);
    const ambito = datos.filiales.length === 1 ? datos.filiales[0].codigo : 'CORPORATIVO';

    const plantilla = this.plantillas.obtener(solicitud.tipo, ambito);
    const builder = ReporteBuilder.desdePlantilla(plantilla).generadoPor(usuario.nombre);
    const titulo = solicitud.titulo?.trim() || `${TITULOS[solicitud.tipo]} — ${ambito === 'CORPORATIVO' ? 'Consolidado' : datos.filiales[0].nombre}`;
    const reporte = this.director.construir(solicitud.tipo, builder, datos, titulo);

    const decorado = this.aplicarCapas(reporte, solicitud.opciones ?? {}, usuario);
    const documento = decorado.obtenerDocumento();
    this.historial.guardar(new RegistroReporte(documento.metadatos.id, documento, usuario.usuario));

    let secciones = 0;
    reporte.obtenerCuerpo().recorrerSecciones(() => secciones++);
    return {
      id: documento.metadatos.id,
      documento,
      archivo: this.exportadores.crear(solicitud.formato ?? 'HTML').exportar(documento),
      resumen: { elementos: reporte.contarElementos(), secciones: secciones - 1, capas: documento.capas },
    };
  }

  /**
   * Atajo de un clic para el cierre mensual: último mes completo, todas las filiales
   * activas, en HTML y con todas las capas de seguridad. Listo para enviar.
   */
  generarRapido(tipo: TipoReporte, usuario: Usuario, filiales?: string[], hoy = new Date()): ResultadoReporte {
    const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
    const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 0)).toISOString().slice(0, 10);
    return this.generar(
      {
        tipo,
        desde,
        hasta,
        filiales: filiales ?? this.filiales.listar(true).map((f) => f.codigo),
        formato: 'HTML',
        opciones: { confidencialidad: 'CONFIDENCIAL', indice: true, pieLegal: true, firmar: true },
      },
      usuario,
    );
  }

  exportar(id: string, formato: FormatoExportacion): ArchivoExportado {
    return this.exportadores.crear(formato).exportar(this.obtener(id).documento);
  }

  obtener(id: string): RegistroReporte {
    const registro = this.historial.buscarPorId(id);
    if (!registro) throw new ErrorNoEncontrado('Reporte', id);
    return registro;
  }

  listarHistorial(usuario: Usuario): { id: string; titulo: string; tipo: TipoReporte; filiales: string[]; generadoEn: string; generadoPor: string; firmado: boolean }[] {
    return this.historial
      .listar((r) => usuario.rol !== 'FILIAL' || r.documento.metadatos.filiales.every((f) => f === usuario.filial))
      .map((r) => ({
        id: r.id,
        titulo: r.documento.metadatos.titulo,
        tipo: r.documento.metadatos.tipo,
        filiales: r.documento.metadatos.filiales,
        generadoEn: r.documento.metadatos.generadoEn,
        generadoPor: r.documento.metadatos.generadoPor,
        firmado: r.documento.firma !== null,
      }))
      .sort((a, b) => b.generadoEn.localeCompare(a.generadoEn));
  }

  /** Verifica la integridad de un documento (por ejemplo, un JSON recibido por correo). */
  verificar(documento: DocumentoReporte): { valido: boolean; mensaje: string } {
    if (!documento?.firma) return { valido: false, mensaje: 'El documento no está firmado.' };
    return VerificadorFirma.verificar(documento)
      ? { valido: true, mensaje: `Firma válida. Documento íntegro, firmado por ${documento.firma.firmadoPor}.` }
      : { valido: false, mensaje: 'La firma no coincide: el documento fue modificado después de firmarse.' };
  }

  formatosDisponibles(): FormatoExportacion[] {
    return this.exportadores.formatos();
  }

  plantillasDisponibles() {
    return { bases: this.plantillas.listarBases().map((p) => p.aDto()), variantes: this.plantillas.listarVariantes().map((p) => p.aDto()) };
  }

  /** Las capas se apilan en orden; la firma siempre va al final para cubrir todo lo anterior. */
  private aplicarCapas(reporte: IReporte, opciones: OpcionesReporte, usuario: Usuario): IReporte {
    let capa: IReporte = reporte;
    if (opciones.indice) capa = new IndiceDecorator(capa);
    if (opciones.marcaAgua?.trim()) capa = new MarcaAguaDecorator(capa, opciones.marcaAgua);
    if (opciones.confidencialidad) capa = new ConfidencialDecorator(capa, opciones.confidencialidad);
    if (opciones.pieLegal) capa = new PieLegalDecorator(capa);
    if (opciones.firmar) capa = new FirmaDigitalDecorator(capa, `${usuario.nombre} (${usuario.rol})`);
    return capa;
  }
}
