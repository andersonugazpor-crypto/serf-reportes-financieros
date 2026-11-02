import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfiguracionCorporativa } from '../configuracion/configuracion-corporativa';
import { Dinero } from '../comun/dinero';
import {
  CONFIGURACION,
  POOL_CONEXIONES,
  REPO_FILIALES,
  REPO_PRODUCTOS,
  REPO_STOCK,
  REPO_VENTAS,
} from '../comun/tokens';
import { DatosFilial, Filial } from '../filiales/filial';
import { PoolConexiones } from '../infraestructura/persistencia/pool-conexiones';
import { Repositorio } from '../infraestructura/persistencia/repositorio';
import { Stock } from '../inventario/stock';
import { DatosProducto, Producto } from '../productos/producto';
import { Venta } from '../ventas/venta';

export const FILIALES_DEMO: DatosFilial[] = [
  {
    codigo: 'ES',
    nombre: 'FinanCorp España',
    pais: 'España',
    ciudad: 'Madrid',
    region: 'EUROPA',
    moneda: 'EUR',
    formatoDatos: 'JSON_ES',
  },
  {
    codigo: 'DE',
    nombre: 'FinanCorp Deutschland',
    pais: 'Alemania',
    ciudad: 'Berlín',
    region: 'EUROPA',
    moneda: 'EUR',
    formatoDatos: 'CSV_DE',
  },
  {
    codigo: 'MX',
    nombre: 'FinanCorp México',
    pais: 'México',
    ciudad: 'Ciudad de México',
    region: 'LATAM',
    moneda: 'MXN',
    formatoDatos: 'CSV_MX',
  },
  {
    codigo: 'PE',
    nombre: 'FinanCorp Perú',
    pais: 'Perú',
    ciudad: 'Lima',
    region: 'LATAM',
    moneda: 'PEN',
    formatoDatos: 'XML_PE',
  },
  {
    codigo: 'CO',
    nombre: 'FinanCorp Colombia',
    pais: 'Colombia',
    ciudad: 'Bogotá',
    region: 'LATAM',
    moneda: 'COP',
    formatoDatos: 'ESTANDAR',
  },
];

export const PRODUCTOS_DEMO: DatosProducto[] = [
  {
    sku: 'LT-001',
    nombre: 'Laptop Huawei MateBook D15',
    categoria: 'LAPTOP',
    marca: 'Huawei',
    proveedor: 'Huawei Technologies (Shenzhen)',
    costoImportacionUsd: 520,
    precioListaEur: 899,
  },
  {
    sku: 'LT-002',
    nombre: 'Laptop Lenovo IdeaPad Slim 5',
    categoria: 'LAPTOP',
    marca: 'Lenovo',
    proveedor: 'Lenovo Group (Pekín)',
    costoImportacionUsd: 480,
    precioListaEur: 829,
  },
  {
    sku: 'LT-003',
    nombre: 'Laptop Xiaomi RedmiBook Pro 15',
    categoria: 'LAPTOP',
    marca: 'Xiaomi',
    proveedor: 'Xiaomi Corp. (Pekín)',
    costoImportacionUsd: 640,
    precioListaEur: 1149,
  },
  {
    sku: 'SP-101',
    nombre: 'Smartphone Xiaomi Redmi Note 14 Pro',
    categoria: 'SMARTPHONE',
    marca: 'Xiaomi',
    proveedor: 'Xiaomi Corp. (Pekín)',
    costoImportacionUsd: 210,
    precioListaEur: 399,
  },
  {
    sku: 'SP-102',
    nombre: 'Smartphone OPPO Reno 12',
    categoria: 'SMARTPHONE',
    marca: 'OPPO',
    proveedor: 'Guangdong OPPO (Dongguan)',
    costoImportacionUsd: 260,
    precioListaEur: 499,
  },
  {
    sku: 'SP-103',
    nombre: 'Smartphone Honor Magic 6 Lite',
    categoria: 'SMARTPHONE',
    marca: 'Honor',
    proveedor: 'Honor Device Co. (Shenzhen)',
    costoImportacionUsd: 190,
    precioListaEur: 349,
  },
  {
    sku: 'AC-201',
    nombre: 'Audífonos Anker Soundcore Liberty 4',
    categoria: 'ACCESORIO',
    marca: 'Anker',
    proveedor: 'Anker Innovations (Changsha)',
    costoImportacionUsd: 22,
    precioListaEur: 59,
  },
  {
    sku: 'AC-202',
    nombre: 'Power bank Baseus 20 000 mAh',
    categoria: 'ACCESORIO',
    marca: 'Baseus',
    proveedor: 'Baseus Technology (Shenzhen)',
    costoImportacionUsd: 14,
    precioListaEur: 39,
  },
  {
    sku: 'AC-203',
    nombre: 'Smartwatch Amazfit GTR 4',
    categoria: 'ACCESORIO',
    marca: 'Amazfit',
    proveedor: 'Zepp Health (Hefei)',
    costoImportacionUsd: 85,
    precioListaEur: 179,
  },
  {
    sku: 'RD-301',
    nombre: 'Router TP-Link Archer AX55 Wi-Fi 6',
    categoria: 'REDES',
    marca: 'TP-Link',
    proveedor: 'TP-Link Technologies (Shenzhen)',
    costoImportacionUsd: 48,
    precioListaEur: 109,
  },
  {
    sku: 'RD-302',
    nombre: 'Switch TP-Link 24 puertos Gigabit',
    categoria: 'REDES',
    marca: 'TP-Link',
    proveedor: 'TP-Link Technologies (Shenzhen)',
    costoImportacionUsd: 72,
    precioListaEur: 159,
  },
  {
    sku: 'RD-303',
    nombre: 'Access point Huawei AX3 Pro',
    categoria: 'REDES',
    marca: 'Huawei',
    proveedor: 'Huawei Technologies (Shenzhen)',
    costoImportacionUsd: 35,
    precioListaEur: 79,
  },
];

/** Factor de precio local respecto al precio de lista (estrategia comercial de cada filial). */
const FACTOR_PRECIO: Record<string, number> = { ES: 1, DE: 1.04, MX: 0.97, PE: 0.93, CO: 0.66 };
/** Volumen relativo de ventas por filial. */
const VOLUMEN: Record<string, number> = { ES: 1.3, DE: 0.9, MX: 1.1, PE: 0.8, CO: 0.6 };

/** Generador pseudoaleatorio con semilla: los datos de demostración siempre son los mismos. */
function generador(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Carga filiales, productos, inventario y seis meses de ventas para demostrar el sistema. */
@Injectable()
export class DatosDemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DatosDemo');

  constructor(
    @Inject(POOL_CONEXIONES) private readonly pool: PoolConexiones,
    @Inject(CONFIGURACION) private readonly config: ConfiguracionCorporativa,
    @Inject(REPO_FILIALES) private readonly filiales: Repositorio<Filial>,
    @Inject(REPO_PRODUCTOS) private readonly productos: Repositorio<Producto>,
    @Inject(REPO_STOCK) private readonly stock: Repositorio<Stock>,
    @Inject(REPO_VENTAS) private readonly ventas: Repositorio<Venta>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['SERF_SIN_DATOS_DEMO'] === '1') return;
    if (this.filiales.contar() === 0) this.cargar();
  }

  restablecer(): { filiales: number; productos: number; ventas: number } {
    this.pool.vaciar();
    return this.cargar();
  }

  cargar(hoy = new Date()): { filiales: number; productos: number; ventas: number } {
    const azar = generador(2026);
    FILIALES_DEMO.forEach((f) => this.filiales.guardar(new Filial(f)));
    const productos = PRODUCTOS_DEMO.map((p) => this.productos.guardar(new Producto(p)));

    for (const filial of FILIALES_DEMO) {
      for (const p of productos) {
        // ~15 % de combinaciones quedan con stock crítico para que el sistema muestre alertas.
        const cantidad = azar() < 0.15 ? Math.floor(azar() * 12) : 20 + Math.floor(azar() * 90);
        this.stock.guardar(new Stock(filial.codigo, p.sku, cantidad));
      }
    }

    let total = 0;
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 5, 1, 12));
    for (let dia = new Date(inicio); dia < hoy; dia = new Date(dia.getTime() + 86_400_000)) {
      for (const filial of FILIALES_DEMO) {
        const operaciones = Math.round(azar() * 3 * VOLUMEN[filial.codigo]);
        for (let i = 0; i < operaciones; i++) {
          const p = productos[Math.floor(azar() * productos.length)];
          const cantidad = p.categoria === 'ACCESORIO' ? 1 + Math.floor(azar() * 5) : 1 + Math.floor(azar() * 2);
          const tasa = this.config.tasaHaciaConsolidacion(filial.moneda);
          const precioLocal = (p.precioLista.monto * FACTOR_PRECIO[filial.codigo] * (0.95 + azar() * 0.1)) / tasa;
          const redondeado =
            filial.moneda === 'COP' ? Math.round(precioLocal / 1000) * 1000 : Math.round(precioLocal * 100) / 100;
          total++;
          this.ventas.guardar(
            new Venta({
              fecha: new Date(dia),
              filialCodigo: filial.codigo,
              sku: p.sku,
              cantidad,
              precioUnitario: Dinero.de(redondeado, filial.moneda),
              origen: 'IMPORTACION',
              referenciaExterna: `${filial.codigo}-HIST-${String(total).padStart(5, '0')}`,
            }),
          );
        }
      }
    }
    this.logger.log(
      `Datos de demostración cargados: ${FILIALES_DEMO.length} filiales, ${productos.length} productos, ${total} ventas.`,
    );
    return { filiales: FILIALES_DEMO.length, productos: productos.length, ventas: total };
  }
}
