import { Body, Controller, Get, Inject, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsString, Length, MinLength } from 'class-validator';
import { Roles } from '../auth/seguridad';
import { Moneda, MONEDAS } from '../comun/dinero';
import { REGISTRO_ADAPTADORES } from '../comun/tokens';
import { RegistroAdaptadores } from './adaptadores/registro-adaptadores';
import { FormatoDatos, Region } from './filial';
import { FilialesService } from './filiales.service';

const FORMATOS: FormatoDatos[] = ['JSON_ES', 'CSV_MX', 'XML_PE', 'CSV_DE', 'ESTANDAR'];

class CrearFilialDto {
  @IsString() @Length(2, 2) codigo!: string;
  @IsString() @MinLength(3) nombre!: string;
  @IsString() @MinLength(3) pais!: string;
  @IsString() @MinLength(2) ciudad!: string;
  @IsIn(['EUROPA', 'LATAM']) region!: Region;
  @IsIn(MONEDAS) moneda!: Moneda;
  @IsIn(FORMATOS) formatoDatos!: FormatoDatos;
}

class EstadoDto {
  @IsBoolean() activa!: boolean;
}

@Controller('filiales')
class FilialesController {
  constructor(
    private readonly filiales: FilialesService,
    @Inject(REGISTRO_ADAPTADORES) private readonly adaptadores: RegistroAdaptadores,
  ) {}

  @Get()
  listar(@Query('activas') activas?: string) {
    return this.filiales.listar(activas === 'true').map((f) => f.aDto());
  }

  /** Formatos de datos soportados (uno por adaptador registrado) con un archivo de ejemplo. */
  @Get('formatos')
  formatos() {
    return this.adaptadores.listar();
  }

  @Roles('ADMIN')
  @Post()
  registrar(@Body() dto: CrearFilialDto) {
    return this.filiales.registrar(dto).aDto();
  }

  @Roles('ADMIN')
  @Patch(':codigo/estado')
  cambiarEstado(@Param('codigo') codigo: string, @Body() dto: EstadoDto) {
    return this.filiales.cambiarEstado(codigo, dto.activa).aDto();
  }
}

@Module({
  controllers: [FilialesController],
  providers: [FilialesService, { provide: REGISTRO_ADAPTADORES, useFactory: () => new RegistroAdaptadores() }],
  exports: [FilialesService, REGISTRO_ADAPTADORES],
})
export class FilialesModule {}
