import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/configurar-app';
import { ConfiguracionCorporativa } from '../../src/configuracion/configuracion-corporativa';
import { AdaptadorPeru } from '../../src/filiales/adaptadores/adaptadores';
import { PoolConexiones } from '../../src/infraestructura/persistencia/pool-conexiones';

/** Pruebas de integración: levantan la API completa y la consumen por HTTP. */
describe('API de SERF (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<string, string> = {};

  const login = async (usuario: string, clave: string) =>
    (await request(app.getHttpServer()).post('/api/auth/login').send({ usuario, clave }).expect(200)).body
      .token as string;

  beforeAll(async () => {
    ConfiguracionCorporativa.reiniciarParaPruebas();
    PoolConexiones.reiniciarParaPruebas();
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
    tokens.gerente = await login('gerente', 'Gerente2026!');
    tokens.analista = await login('analista', 'Analista2026!');
    tokens.pe = await login('operador.pe', 'Peru2026!');
  });

  afterAll(async () => app.close());

  const get = (url: string, quien = 'gerente') =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${tokens[quien]}`);
  const post = (url: string, cuerpo: object, quien = 'gerente') =>
    request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${tokens[quien]}`).send(cuerpo);

  describe('Seguridad', () => {
    it('rechaza peticiones sin token', () => request(app.getHttpServer()).get('/api/productos').expect(401));

    it('rechaza credenciales incorrectas', () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ usuario: 'gerente', clave: 'incorrecta' })
        .expect(401));

    it('aplica permisos por rol', async () => {
      await request(app.getHttpServer())
        .patch('/api/configuracion/tasas/PEN')
        .set('Authorization', `Bearer ${tokens.analista}`)
        .send({ tasa: 0.3 })
        .expect(403);
    });

    it('un operador de filial solo ve los datos de su filial', async () => {
      const res = await get('/api/inventario', 'pe').expect(200);
      expect(res.body.every((f: { filialCodigo: string }) => f.filialCodigo === 'PE')).toBe(true);
      await get('/api/inventario?filial=MX', 'pe').expect(403);
    });
  });

  describe('Productos y ventas', () => {
    it('registra un producto importado y valida datos', async () => {
      const nuevo = {
        sku: 'AC-299',
        nombre: 'Cargador GaN 65W',
        categoria: 'ACCESORIO',
        marca: 'Ugreen',
        proveedor: 'Ugreen (Shenzhen)',
        costoImportacionUsd: 18,
        precioListaEur: 45,
      };
      const res = await post('/api/productos', nuevo).expect(201);
      expect(res.body).toMatchObject({ sku: 'AC-299', paisOrigen: 'China' });
      await post('/api/productos', nuevo).expect(409);
      await post('/api/productos', { ...nuevo, sku: 'XX' }).expect(400);
    });

    it('registra una venta, descuenta stock e impide vender sin stock', async () => {
      await post('/api/inventario/ingresos', { filialCodigo: 'PE', sku: 'AC-299', unidades: 3 }, 'pe').expect(201);
      await post('/api/ventas', { filialCodigo: 'PE', sku: 'AC-299', cantidad: 2, precioUnitario: 159.9 }, 'pe').expect(
        201,
      );
      const inventario = await get('/api/inventario?filial=PE', 'pe');
      expect(inventario.body.find((f: { sku: string }) => f.sku === 'AC-299').cantidad).toBe(1);
      const sinStock = await post(
        '/api/ventas',
        { filialCodigo: 'PE', sku: 'AC-299', cantidad: 5, precioUnitario: 159.9 },
        'pe',
      ).expect(409);
      expect(sinStock.body.mensaje).toContain('Stock insuficiente');
    });
  });

  describe('Integración de datos de filiales (Adapter)', () => {
    it('previsualiza e importa el XML de Perú sin duplicar ventas', async () => {
      const contenido = new AdaptadorPeru().ejemplo();
      const vista = await post('/api/ventas/importar/previsualizar', { filialCodigo: 'PE', contenido }, 'pe').expect(
        200,
      );
      expect(vista.body.ventas).toHaveLength(2);

      const primera = await post('/api/ventas/importar', { filialCodigo: 'PE', contenido }, 'pe').expect(201);
      expect(primera.body).toMatchObject({ ventasImportadas: 2, stocksActualizados: 2 });
      const segunda = await post('/api/ventas/importar', { filialCodigo: 'PE', contenido }, 'pe').expect(201);
      expect(segunda.body).toMatchObject({ ventasImportadas: 0, ventasDuplicadas: 2 });
    });

    it('una filial nueva se integra con el formato estándar (escalabilidad)', async () => {
      await post('/api/filiales', {
        codigo: 'CL',
        nombre: 'FinanCorp Chile',
        pais: 'Chile',
        ciudad: 'Santiago',
        region: 'LATAM',
        moneda: 'CLP',
        formatoDatos: 'ESTANDAR',
      }).expect(201);
      const contenido = JSON.stringify({
        ventas: [{ referencia: 'CL-1', fecha: '2026-10-15', sku: 'SP-101', cantidad: 2, precioUnitario: 389000 }],
        inventario: [],
      });
      const res = await post('/api/ventas/importar', { filialCodigo: 'CL', contenido }).expect(201);
      expect(res.body.ventasImportadas).toBe(1);
    });
  });

  describe('Reportes (Facade)', () => {
    let idReporte = '';

    it('genera un reporte ejecutivo consolidado con todas las capas', async () => {
      const res = await post('/api/reportes', {
        tipo: 'EJECUTIVO',
        desde: '2026-01-01',
        hasta: '2026-12-31',
        filiales: ['ES', 'MX', 'PE', 'DE', 'CO'],
        formato: 'HTML',
        opciones: {
          indice: true,
          marcaAgua: 'Borrador',
          confidencialidad: 'CONFIDENCIAL',
          pieLegal: true,
          firmar: true,
        },
      }).expect(201);
      idReporte = res.body.id;
      expect(res.body.documento.metadatos.ambito).toBe('CORPORATIVO');
      expect(res.body.documento.capas).toHaveLength(6);
      expect(res.body.archivo.contenido).toContain('<!doctype html>');
      expect(res.body.documento.indice.length).toBeGreaterThan(5);
    });

    it('usa la plantilla del país cuando el reporte es de una sola filial', async () => {
      const res = await post('/api/reportes', {
        tipo: 'VENTAS',
        desde: '2026-01-01',
        hasta: '2026-12-31',
        filiales: ['DE'],
      }).expect(201);
      expect(res.body.documento.metadatos).toMatchObject({ ambito: 'DE', locale: 'de-DE', plantillaId: 'ventas-de' });
    });

    it('la interfaz simple genera un reporte firmado con un solo parámetro', async () => {
      const res = await post('/api/reportes/rapido', { tipo: 'VENTAS' }).expect(201);
      expect(res.body.documento.firma).not.toBeNull();
      expect(res.body.documento.confidencialidad).toBe('CONFIDENCIAL');
    });

    it('descarga el reporte en CSV y lo lista en el historial', async () => {
      const csv = await get(`/api/reportes/${idReporte}/descargar?formato=CSV`).expect(200);
      expect(csv.headers['content-disposition']).toContain('.csv');
      const historial = await get('/api/reportes/historial').expect(200);
      expect(historial.body.some((r: { id: string }) => r.id === idReporte)).toBe(true);
    });

    it('verifica la firma y detecta manipulaciones', async () => {
      const documento = (await get(`/api/reportes/${idReporte}`).expect(200)).body;
      expect((await post('/api/reportes/verificar', { documento }).expect(200)).body.valido).toBe(true);
      documento.metadatos.titulo = 'Alterado';
      expect((await post('/api/reportes/verificar', { documento }).expect(200)).body.valido).toBe(false);
    });

    it('el operador de una filial no puede generar reportes de otras', () =>
      post(
        '/api/reportes',
        { tipo: 'VENTAS', desde: '2026-01-01', hasta: '2026-12-31', filiales: ['MX'] },
        'pe',
      ).expect(403));

    it('valida la solicitud', () =>
      post('/api/reportes', { tipo: 'OTRO', desde: 'ayer', hasta: '2026-12-31', filiales: [] }).expect(400));
  });

  describe('Configuración centralizada (Singleton)', () => {
    it('un cambio de tasa se refleja en la consolidación', async () => {
      const antes = (await get('/api/panel?desde=2026-01-01&hasta=2026-12-31&filiales=MX')).body.totales.ingresos;
      const tasa = ConfiguracionCorporativa.obtenerInstancia().tasaHaciaConsolidacion('MXN');
      await request(app.getHttpServer())
        .patch('/api/configuracion/tasas/MXN')
        .set('Authorization', `Bearer ${tokens.gerente}`)
        .send({ tasa: tasa * 2 })
        .expect(200);
      const despues = (await get('/api/panel?desde=2026-01-01&hasta=2026-12-31&filiales=MX')).body.totales.ingresos;
      expect(despues).toBeCloseTo(antes * 2, 0);
    });

    it('expone el estado del pool de conexiones', async () => {
      const res = await get('/api/configuracion').expect(200);
      expect(res.body.pool.total).toBe(5);
      expect(res.body.pool.ocupadas).toBe(0);
      expect(res.body.pool.prestamosRealizados).toBeGreaterThan(0);
    });
  });
});
