// Guion de pruebas de usabilidad con usuarios simulados (Puppeteer).
// Requiere: npm i puppeteer y la app corriendo (npm start). Ejecutar: node usabilidad.mjs
import puppeteer from 'puppeteer';

const B = 'http://localhost:4200';
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 860 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = async () => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent.trim()).join(' | '));
const clic = async (texto, sel = 'button') => {
  for (const e of await page.$$(sel)) if ((await e.evaluate((x) => x.textContent)).includes(texto)) { await e.click(); return; }
  throw new Error('No encontrado: ' + texto);
};
const t0 = () => Date.now();
const res = [];

// Tarea A — Operadora de Perú: registrar una venta con más unidades de las que hay.
await page.goto(B + '/login', { waitUntil: 'networkidle0' });
let ini = t0();
await clic('operador.pe'); await w(1500);
await page.goto(B + '/ventas', { waitUntil: 'networkidle0' }); await w(400);
await clic('Registrar venta'); await w(300);
await page.select('#v-sku', 'LT-003'); await w(300);
const precio = await page.$eval('#v-precio', (e) => e.value);
await page.$eval('#v-cant', (e) => { e.value = ''; });
await page.type('#v-cant', '500');
await clic('Registrar', 'form button[type=submit]'); await w(800);
res.push({ tarea: 'A. Venta sin stock (operadora PE)', precioSugerido: precio, mensaje: await toast(), segundos: (Date.now() - ini) / 1000 });

// Tarea B — Integrar un archivo con formato equivocado.
ini = t0();
await page.goto(B + '/integracion', { waitUntil: 'networkidle0' }); await w(500);
await page.type('textarea', '{"ventas": []}'); await w(200);
await clic('Previsualizar'); await w(800);
res.push({ tarea: 'B. Archivo con formato equivocado', mensaje: await toast(), segundos: (Date.now() - ini) / 1000 });

// Tarea C — Previsualizar, luego cambiar el texto e importar (¿usa la vista previa vieja?)
await page.reload({ waitUntil: 'networkidle0' }); await w(500);
await clic('Usar este ejemplo'); await w(200);
await clic('Previsualizar'); await w(800);
await page.type('textarea', '\n<venta codigo="X" fecha="2026-10-10" producto="ZZ-999" cantidad="1" precio="10"/>');
await w(200);
const importarHabilitado = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Importar'))?.disabled === false);
res.push({ tarea: 'C. Editar tras previsualizar', importarSigueHabilitado: importarHabilitado });

// Tarea D — Operadora intenta ver Reportes > solo su filial.
await page.goto(B + '/reportes', { waitUntil: 'networkidle0' }); await w(400);
await clic('Siguiente'); await w(300);
const filialesVisibles = await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim().slice(0, 20)));
res.push({ tarea: 'D. Alcance de filial en reportes', filialesVisibles });

// Tarea E — Gerente: periodo invertido en el asistente.
await page.evaluate(() => sessionStorage.clear());
await page.goto(B + '/login', { waitUntil: 'networkidle0' });
await clic('gerente'); await w(1500);
ini = t0();
await page.goto(B + '/reportes', { waitUntil: 'networkidle0' }); await w(400);
await clic('Siguiente'); await w(300);
await page.$eval('#desde', (e) => { e.value = '2026-12-01'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await clic('Siguiente'); await w(400);
res.push({ tarea: 'E. Periodo invertido', mensaje: await toast(), paso3: await page.evaluate(() => document.body.innerText.includes('Seguridad y formato\n')) });

// Tarea F — Gerente: generar reporte del mes con un clic desde el panel (tiempo).
ini = t0();
await page.goto(B + '/panel', { waitUntil: 'networkidle0' }); await w(500);
await clic('Financiero ejecutivo'); await w(2000);
res.push({ tarea: 'F. Reporte rápido desde el panel', url: page.url().replace(B, ''), segundos: (Date.now() - ini) / 1000, firmado: await page.evaluate(() => document.body.innerText.includes('HMAC-SHA256')) });

console.log(JSON.stringify(res, null, 2));
await browser.close();
