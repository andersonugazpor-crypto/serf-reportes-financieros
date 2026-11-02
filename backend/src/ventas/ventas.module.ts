import { Body, Controller, Get, HttpCode, Module, Post, Query } from '@nestjs/common';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Usuario } from '../auth/auth.service';
import { filialesPermitidas, Roles, UsuarioActual } from '../auth/seguridad';
import { FilialesModule } from '../filiales/filiales.module';
import { InventarioModule } from '../inventario/inventario.module';
import { ProductosModule } from '../productos/productos.module';
import { VentasService } from './ventas.service';

class RegistrarVentaDto {
  @IsString() @Length(2, 2) filialCodigo!: string;
  @IsString() sku!: string;
  @IsInt() @IsPositive() cantidad!: number;
  @IsNumber() @IsPositive() precioUnitario!: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha?: string;
}

class ImportarDto {
  @IsString() @Length(2, 2) filialCodigo!: string;
  @IsString() @MinLength(5) @MaxLength(2_000_000) contenido!: string;
}

@Controller('ventas')
class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Get()
  listar(
    @UsuarioActual() usuario: Usuario,
    @Query('filial') filial?: string,
    @Query('sku') sku?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limite') limite = '200',
  ) {
    const filtro = filial ? [filial.toUpperCase()] : usuario.rol === 'FILIAL' ? [usuario.filial!] : undefined;
    const filiales = filtro ? filialesPermitidas(usuario, filtro) : undefined;
    const ventas = this.ventas.listar({ filiales, sku, desde, hasta });
    return {
      total: ventas.length,
      ventas: ventas.slice(0, Math.min(Number(limite) || 200, 1000)).map((v) => v.aDto()),
    };
  }

  @Roles('ADMIN', 'FILIAL')
  @Post()
  registrar(@UsuarioActual() usuario: Usuario, @Body() dto: RegistrarVentaDto) {
    const [filial] = filialesPermitidas(usuario, [dto.filialCodigo.toUpperCase()]);
    return this.ventas.registrar({ ...dto, filialCodigo: filial }).aDto();
  }

  @Roles('ADMIN', 'FILIAL')
  @Post('importar/previsualizar')
  @HttpCode(200)
  previsualizar(@UsuarioActual() usuario: Usuario, @Body() dto: ImportarDto) {
    const [filial] = filialesPermitidas(usuario, [dto.filialCodigo.toUpperCase()]);
    const lote = this.ventas.previsualizar(filial, dto.contenido);
    return {
      ...lote,
      ventas: lote.ventas.map((v) => ({ ...v, fecha: v.fecha.toISOString().slice(0, 10) })),
    };
  }

  @Roles('ADMIN', 'FILIAL')
  @Post('importar')
  importar(@UsuarioActual() usuario: Usuario, @Body() dto: ImportarDto) {
    const [filial] = filialesPermitidas(usuario, [dto.filialCodigo.toUpperCase()]);
    return this.ventas.importar(filial, dto.contenido);
  }
}

@Module({
  imports: [FilialesModule, ProductosModule, InventarioModule],
  controllers: [VentasController],
  providers: [VentasService],
  exports: [VentasService],
})
export class VentasModule {}
