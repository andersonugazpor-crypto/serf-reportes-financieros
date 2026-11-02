import { Dinero } from '../comun/dinero';
import { Entidad } from '../comun/entidad';
import { asegurar } from '../comun/errores';

export type Categoria = 'LAPTOP' | 'SMARTPHONE' | 'ACCESORIO' | 'REDES';

export const CATEGORIAS: readonly Categoria[] = ['LAPTOP', 'SMARTPHONE', 'ACCESORIO', 'REDES'];

export const ETIQUETA_CATEGORIA: Readonly<Record<Categoria, string>> = {
  LAPTOP: 'Laptops',
  SMARTPHONE: 'Smartphones',
  ACCESORIO: 'Accesorios electrónicos',
  REDES: 'Equipos de redes',
};

export interface ProductoDto {
  id: string;
  sku: string;
  nombre: string;
  categoria: Categoria;
  marca: string;
  proveedor: string;
  paisOrigen: string;
  costoImportacionUsd: number;
  precioListaEur: number;
  activo: boolean;
  creadoEn: string;
}

export interface DatosProducto {
  sku: string;
  nombre: string;
  categoria: Categoria;
  marca: string;
  proveedor: string;
  paisOrigen?: string;
  costoImportacionUsd: number;
  precioListaEur: number;
}

/**
 * Producto tecnológico importado.
 * Los importes son objetos `Dinero` privados; cambiar precios exige pasar por
 * métodos que validan que el precio de lista supere el costo (encapsulamiento).
 */
export class Producto extends Entidad<ProductoDto> {
  readonly sku: string;
  private _nombre: string;
  readonly categoria: Categoria;
  private _marca: string;
  private _proveedor: string;
  readonly paisOrigen: string;
  private _costoImportacion: Dinero;
  private _precioLista: Dinero;
  private _activo = true;

  constructor(datos: DatosProducto, creadoEn?: Date) {
    const sku = datos.sku?.trim().toUpperCase();
    asegurar(/^[A-Z]{2,4}-\d{3,5}$/.test(sku ?? ''), 'SKU inválido. Formato esperado: LT-001.');
    asegurar(CATEGORIAS.includes(datos.categoria), `Categoría inválida: ${datos.categoria}`);
    asegurar(datos.nombre?.trim().length >= 3, 'El nombre debe tener al menos 3 caracteres.');
    super(sku, creadoEn);
    this.sku = sku;
    this._nombre = datos.nombre.trim();
    this.categoria = datos.categoria;
    this._marca = datos.marca?.trim() || 'Genérico';
    this._proveedor = datos.proveedor?.trim() || 'Proveedor no especificado';
    this.paisOrigen = datos.paisOrigen?.trim() || 'China';
    this._costoImportacion = Dinero.cero('USD');
    this._precioLista = Dinero.cero('EUR');
    this.actualizarPrecios(datos.costoImportacionUsd, datos.precioListaEur);
  }

  get nombre(): string {
    return this._nombre;
  }
  get marca(): string {
    return this._marca;
  }
  get proveedor(): string {
    return this._proveedor;
  }
  get costoImportacion(): Dinero {
    return this._costoImportacion;
  }
  get precioLista(): Dinero {
    return this._precioLista;
  }
  get activo(): boolean {
    return this._activo;
  }

  actualizarPrecios(costoUsd: number, precioEur: number): void {
    asegurar(costoUsd > 0, 'El costo de importación debe ser mayor que 0.');
    asegurar(precioEur > 0, 'El precio de lista debe ser mayor que 0.');
    this._costoImportacion = Dinero.de(costoUsd, 'USD');
    this._precioLista = Dinero.de(precioEur, 'EUR');
  }

  actualizarDatos(cambios: Partial<Pick<DatosProducto, 'nombre' | 'marca' | 'proveedor'>>): void {
    if (cambios.nombre !== undefined) {
      asegurar(cambios.nombre.trim().length >= 3, 'El nombre debe tener al menos 3 caracteres.');
      this._nombre = cambios.nombre.trim();
    }
    if (cambios.marca !== undefined) this._marca = cambios.marca.trim() || this._marca;
    if (cambios.proveedor !== undefined) this._proveedor = cambios.proveedor.trim() || this._proveedor;
  }

  descontinuar(): void {
    this._activo = false;
  }

  aDto(): ProductoDto {
    return {
      id: this.id,
      sku: this.sku,
      nombre: this._nombre,
      categoria: this.categoria,
      marca: this._marca,
      proveedor: this._proveedor,
      paisOrigen: this.paisOrigen,
      costoImportacionUsd: this._costoImportacion.monto,
      precioListaEur: this._precioLista.monto,
      activo: this._activo,
      creadoEn: this.creadoEn.toISOString(),
    };
  }
}
