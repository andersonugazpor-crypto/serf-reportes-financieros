import { Inject, Injectable } from '@nestjs/common';
import { ErrorConflicto, ErrorNoEncontrado } from '../comun/errores';
import { REPO_PRODUCTOS } from '../comun/tokens';
import { Repositorio } from '../infraestructura/persistencia/repositorio';
import { Categoria, DatosProducto, Producto } from './producto';

export interface FiltroProductos {
  texto?: string;
  categoria?: Categoria;
  soloActivos?: boolean;
}

@Injectable()
export class ProductosService {
  constructor(@Inject(REPO_PRODUCTOS) private readonly repo: Repositorio<Producto>) {}

  listar(filtro: FiltroProductos = {}): Producto[] {
    const texto = filtro.texto?.trim().toLowerCase() ?? '';
    return this.repo
      .listar(
        (p) =>
          (!filtro.categoria || p.categoria === filtro.categoria) &&
          (!filtro.soloActivos || p.activo) &&
          (!texto || p.sku.toLowerCase().includes(texto) || p.nombre.toLowerCase().includes(texto) || p.marca.toLowerCase().includes(texto)),
      )
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  obtener(sku: string): Producto {
    const producto = this.repo.buscarPorId(sku.toUpperCase());
    if (!producto) throw new ErrorNoEncontrado('Producto', sku);
    return producto;
  }

  existe(sku: string): boolean {
    return this.repo.buscarPorId(sku.toUpperCase()) !== undefined;
  }

  registrar(datos: DatosProducto): Producto {
    const producto = new Producto(datos);
    if (this.repo.buscarPorId(producto.sku)) throw new ErrorConflicto(`El SKU ${producto.sku} ya está registrado.`);
    return this.repo.guardar(producto);
  }

  actualizar(sku: string, cambios: Partial<DatosProducto>): Producto {
    const producto = this.obtener(sku);
    producto.actualizarDatos(cambios);
    if (cambios.costoImportacionUsd !== undefined || cambios.precioListaEur !== undefined) {
      producto.actualizarPrecios(
        cambios.costoImportacionUsd ?? producto.costoImportacion.monto,
        cambios.precioListaEur ?? producto.precioLista.monto,
      );
    }
    return this.repo.guardar(producto);
  }

  descontinuar(sku: string): Producto {
    const producto = this.obtener(sku);
    producto.descontinuar();
    return this.repo.guardar(producto);
  }
}
