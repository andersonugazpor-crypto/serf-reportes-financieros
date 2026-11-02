import { Body, Controller, Get, Inject, Module, Param, Patch } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength } from 'class-validator';
import { Roles } from '../auth/seguridad';
import { Moneda } from '../comun/dinero';
import { CONFIGURACION, POOL_CONEXIONES } from '../comun/tokens';
import { PoolConexiones } from '../infraestructura/persistencia/pool-conexiones';
import { ConfiguracionCorporativa } from './configuracion-corporativa';

class TasaDto {
  @IsNumber() @IsPositive() tasa!: number;
}

class PoliticasDto {
  @IsOptional() @IsInt() @Min(0) stockMinimo?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) margenObjetivo?: number;
  @IsOptional() @IsString() @MinLength(10) avisoLegal?: string;
}

@Controller('configuracion')
class ConfiguracionController {
  constructor(
    @Inject(CONFIGURACION) private readonly config: ConfiguracionCorporativa,
    @Inject(POOL_CONEXIONES) private readonly pool: PoolConexiones,
  ) {}

  @Get()
  obtener() {
    return { ...this.config.vista(), pool: this.pool.estado() };
  }

  @Roles('ADMIN')
  @Patch('tasas/:moneda')
  actualizarTasa(@Param('moneda') moneda: string, @Body() dto: TasaDto) {
    this.config.actualizarTasa(moneda.toUpperCase() as Moneda, dto.tasa);
    return this.config.vista();
  }

  @Roles('ADMIN')
  @Patch('politicas')
  actualizarPoliticas(@Body() dto: PoliticasDto) {
    this.config.actualizarPoliticas(dto);
    return this.config.vista();
  }
}

@Module({ controllers: [ConfiguracionController] })
export class ConfiguracionModule {}
