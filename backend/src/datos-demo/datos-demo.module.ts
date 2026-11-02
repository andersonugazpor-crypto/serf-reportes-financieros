import { Controller, HttpCode, Module, Post } from '@nestjs/common';
import { Roles } from '../auth/seguridad';
import { DatosDemoService } from './datos-demo.service';

@Controller('demo')
class DatosDemoController {
  constructor(private readonly demo: DatosDemoService) {}

  /** Vuelve a cargar los datos de ejemplo (útil antes de una demostración). */
  @Roles('ADMIN')
  @Post('restablecer')
  @HttpCode(200)
  restablecer() {
    return this.demo.restablecer();
  }
}

@Module({ controllers: [DatosDemoController], providers: [DatosDemoService] })
export class DatosDemoModule {}
