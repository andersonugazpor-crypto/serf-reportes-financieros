import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { DatosDemoModule } from './datos-demo/datos-demo.module';
import { FilialesModule } from './filiales/filiales.module';
import { PersistenciaModule } from './infraestructura/persistencia/persistencia.module';
import { InventarioModule } from './inventario/inventario.module';
import { ProductosModule } from './productos/productos.module';
import { ReportesModule } from './reportes/reportes.module';
import { VentasModule } from './ventas/ventas.module';

/** Módulo raíz: un módulo por funcionalidad, cada uno con una responsabilidad. */
@Module({
  imports: [
    PersistenciaModule,
    AuthModule,
    ConfiguracionModule,
    FilialesModule,
    ProductosModule,
    InventarioModule,
    VentasModule,
    ReportesModule,
    DatosDemoModule,
  ],
})
export class AppModule {}
