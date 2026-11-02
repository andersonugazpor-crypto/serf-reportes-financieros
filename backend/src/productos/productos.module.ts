import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches, MinLength } from 'class-validator';
import { Roles } from '../auth/seguridad';
import { Categoria, CATEGORIAS } from './producto';
import { ProductosService } from './productos.service';

class CrearProductoDto {
  @Matches(/^[A-Za-z]{2,4}-\d{3,5}$/, { message: 'SKU inválido. Formato esperado: LT-001.' }) sku!: string;
  @IsString() @MinLength(3) nombre!: string;
  @IsIn(CATEGORIAS) categoria!: Categoria;
  @IsString() marca!: string;
  @IsString() proveedor!: string;
  @IsOptional() @IsString() paisOrigen?: string;
  @IsNumber() @IsPositive() costoImportacionUsd!: number;
  @IsNumber() @IsPositive() precioListaEur!: number;
}

class ActualizarProductoDto {
  @IsOptional() @IsString() @MinLength(3) nombre?: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() proveedor?: string;
  @IsOptional() @IsNumber() @IsPositive() costoImportacionUsd?: number;
  @IsOptional() @IsNumber() @IsPositive() precioListaEur?: number;
}

@Controller('productos')
class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@Query('texto') texto?: string, @Query('categoria') categoria?: Categoria, @Query('activos') activos?: string) {
    return this.productos.listar({ texto, categoria, soloActivos: activos === 'true' }).map((p) => p.aDto());
  }

  @Get(':sku')
  obtener(@Param('sku') sku: string) {
    return this.productos.obtener(sku).aDto();
  }

  @Roles('ADMIN', 'ANALISTA')
  @Post()
  registrar(@Body() dto: CrearProductoDto) {
    return this.productos.registrar(dto).aDto();
  }

  @Roles('ADMIN', 'ANALISTA')
  @Patch(':sku')
  actualizar(@Param('sku') sku: string, @Body() dto: ActualizarProductoDto) {
    return this.productos.actualizar(sku, dto).aDto();
  }

  @Roles('ADMIN')
  @Delete(':sku')
  descontinuar(@Param('sku') sku: string) {
    return this.productos.descontinuar(sku).aDto();
  }
}

@Module({ controllers: [ProductosController], providers: [ProductosService], exports: [ProductosService] })
export class ProductosModule {}
