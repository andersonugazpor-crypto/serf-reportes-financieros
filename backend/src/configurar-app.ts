import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FiltroErrores } from './comun/filtro-errores';

/** Configuración común de la app (la usan main.ts y las pruebas e2e). */
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroErrores());
  return app;
}
