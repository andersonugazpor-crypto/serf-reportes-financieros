import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { IsInt, IsPositive, IsString, Length } from 'class-validator';
import { Usuario } from '../auth/auth.service';
import { filialesPermitidas, Roles, UsuarioActual } from '../auth/seguridad';
import { FilialesModule } from '../filiales/filiales.module';
import { ProductosModule } from '../productos/productos.module';
import { InventarioService } from './inventario.service';

class IngresoDto {
  @IsString() @Length(2, 2) filialCodigo!: string;
  @IsString() sku!: string;
  @IsInt() @IsPositive() unidades!: number;
}

@Controller('inventario')
class InventarioController {
  constructor(private readonly inventario: InventarioService) {}

  @Get()
  listar(@UsuarioActual() usuario: Usuario, @Query('filial') filial?: string) {
    const filtro = filial ? [filial.toUpperCase()] : usuario.rol === 'FILIAL' ? [usuario.filial!] : undefined;
    return this.inventario.detalle(filtro ? filialesPermitidas(usuario, filtro) : undefined);
  }

  /** Recepción de mercadería importada. */
  @Roles('ADMIN', 'FILIAL')
  @Post('ingresos')
  ingresar(@UsuarioActual() usuario: Usuario, @Body() dto: IngresoDto) {
    const [filial] = filialesPermitidas(usuario, [dto.filialCodigo.toUpperCase()]);
    return this.inventario.ingresar(filial, dto.sku, dto.unidades).aDto();
  }
}

@Module({
  imports: [FilialesModule, ProductosModule],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
