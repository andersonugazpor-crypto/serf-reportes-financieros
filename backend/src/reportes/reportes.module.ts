import { Body, Controller, Get, HttpCode, Module, Param, Post, Query, Res } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Response } from 'express';
import { Usuario } from '../auth/auth.service';
import { filialesPermitidas, UsuarioActual } from '../auth/seguridad';
import { FilialesModule } from '../filiales/filiales.module';
import { FilialesService } from '../filiales/filiales.service';
import { InventarioModule } from '../inventario/inventario.module';
import { ProductosModule } from '../productos/productos.module';
import { VentasModule } from '../ventas/ventas.module';
import { ConsolidacionService } from './consolidacion/consolidacion.service';
import { DocumentoReporte, NivelConfidencialidad } from './decorator/reporte';
import { FormatoExportacion } from './exportacion/exportadores';
import { GeneradorReportesFacade } from './fachada/generador-reportes.facade';
import { TipoReporte, TIPOS_REPORTE } from './prototype/plantilla-reporte';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATOS: FormatoExportacion[] = ['HTML', 'CSV', 'JSON'];

class OpcionesDto {
  @IsOptional() @IsString() @MaxLength(30) marcaAgua?: string;
  @IsOptional() @IsIn(['INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO']) confidencialidad?: NivelConfidencialidad;
  @IsOptional() @IsBoolean() indice?: boolean;
  @IsOptional() @IsBoolean() pieLegal?: boolean;
  @IsOptional() @IsBoolean() firmar?: boolean;
}

class GenerarReporteDto {
  @IsIn(TIPOS_REPORTE) tipo!: TipoReporte;
  @Matches(FECHA) desde!: string;
  @Matches(FECHA) hasta!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) filiales!: string[];
  @IsOptional() @IsIn(FORMATOS) formato?: FormatoExportacion;
  @IsOptional() @IsString() @MaxLength(120) titulo?: string;
  @IsOptional() @ValidateNested() @Type(() => OpcionesDto) opciones?: OpcionesDto;
}

class RapidoDto {
  @IsIn(TIPOS_REPORTE) tipo!: TipoReporte;
}

class VerificarDto {
  @IsObject() documento!: DocumentoReporte;
}

@Controller('reportes')
class ReportesController {
  constructor(private readonly fachada: GeneradorReportesFacade) {}

  @Get('plantillas')
  plantillas() {
    return this.fachada.plantillasDisponibles();
  }

  @Get('historial')
  historial(@UsuarioActual() usuario: Usuario) {
    return this.fachada.listarHistorial(usuario);
  }

  @Post()
  generar(@UsuarioActual() usuario: Usuario, @Body() dto: GenerarReporteDto) {
    const filiales = filialesPermitidas(usuario, dto.filiales.map((f) => f.toUpperCase()));
    return this.fachada.generar({ ...dto, filiales }, usuario);
  }

  /** Interfaz simple: un solo parámetro para obtener un reporte listo para enviar. */
  @Post('rapido')
  rapido(@UsuarioActual() usuario: Usuario, @Body() dto: RapidoDto) {
    return this.fachada.generarRapido(dto.tipo, usuario, usuario.rol === 'FILIAL' ? [usuario.filial!] : undefined);
  }

  @Post('verificar')
  @HttpCode(200)
  verificar(@Body() dto: VerificarDto) {
    return this.fachada.verificar(dto.documento);
  }

  @Get(':id')
  obtener(@UsuarioActual() usuario: Usuario, @Param('id') id: string) {
    const { documento } = this.fachada.obtener(id);
    filialesPermitidas(usuario, documento.metadatos.filiales);
    return documento;
  }

  @Get(':id/descargar')
  descargar(@UsuarioActual() usuario: Usuario, @Param('id') id: string, @Query('formato') formato: string = 'HTML', @Res() res: Response) {
    filialesPermitidas(usuario, this.fachada.obtener(id).documento.metadatos.filiales);
    const archivo = this.fachada.exportar(id, formato.toUpperCase() as FormatoExportacion);
    res.setHeader('Content-Type', archivo.tipoMime);
    res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombre}"`);
    res.send(archivo.contenido);
  }
}

/** Indicadores para el panel principal (misma consolidación que usan los reportes). */
@Controller('panel')
class PanelController {
  constructor(
    private readonly consolidacion: ConsolidacionService,
    private readonly filiales: FilialesService,
  ) {}

  @Get()
  obtener(@UsuarioActual() usuario: Usuario, @Query('desde') desde: string, @Query('hasta') hasta: string, @Query('filiales') filiales?: string) {
    const hoy = new Date().toISOString().slice(0, 10);
    const inicio = desde && FECHA.test(desde) ? desde : `${hoy.slice(0, 7)}-01`;
    const fin = hasta && FECHA.test(hasta) ? hasta : hoy;
    const pedidas = filiales ? filiales.split(',').map((f) => f.trim().toUpperCase()) : usuario.rol === 'FILIAL' ? [usuario.filial!] : null;
    const todas = this.filiales.listar(true).map((f) => f.codigo);
    return this.consolidacion.consolidar(inicio, fin, pedidas ? filialesPermitidas(usuario, pedidas) : todas);
  }
}

@Module({
  imports: [FilialesModule, ProductosModule, InventarioModule, VentasModule],
  controllers: [ReportesController, PanelController],
  providers: [ConsolidacionService, GeneradorReportesFacade],
})
export class ReportesModule {}
