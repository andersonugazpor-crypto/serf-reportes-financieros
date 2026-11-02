import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '5mb' });
  configurarApp(app);
  const puerto = Number(process.env['PORT'] ?? 3000);
  await app.listen(puerto);
  Logger.log(`API de SERF disponible en http://localhost:${puerto}/api`, 'SERF');
}

void iniciar();
