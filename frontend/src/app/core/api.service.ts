import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Categoria,
  Configuracion,
  DatosConsolidados,
  DocumentoReporte,
  Filial,
  FilaInventario,
  FormatoAdaptador,
  ItemHistorial,
  Plantilla,
  Producto,
  ResultadoImportacion,
  ResultadoReporte,
  Sesion,
  SolicitudReporte,
  TipoReporte,
  Usuario,
  Venta,
  VistaPreviaImportacion,
} from './modelos';

const API = '/api';

/** Único punto de acceso HTTP a la API (los componentes no usan HttpClient directamente). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private params(valores: Record<string, string | undefined | null>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(valores)) if (v) p = p.set(k, v);
    return p;
  }

  // Autenticación
  login(usuario: string, clave: string): Observable<Sesion> {
    return this.http.post<Sesion>(`${API}/auth/login`, { usuario, clave });
  }
  logout(): Observable<void> {
    return this.http.post<void>(`${API}/auth/logout`, {});
  }
  yo(): Observable<Usuario> {
    return this.http.get<Usuario>(`${API}/auth/yo`);
  }

  // Panel
  panel(desde: string, hasta: string, filiales?: string[]): Observable<DatosConsolidados> {
    return this.http.get<DatosConsolidados>(`${API}/panel`, {
      params: this.params({ desde, hasta, filiales: filiales?.join(',') }),
    });
  }

  // Filiales
  filiales(soloActivas = false): Observable<Filial[]> {
    return this.http.get<Filial[]>(`${API}/filiales`, { params: this.params({ activas: soloActivas ? 'true' : null }) });
  }
  formatos(): Observable<FormatoAdaptador[]> {
    return this.http.get<FormatoAdaptador[]>(`${API}/filiales/formatos`);
  }
  crearFilial(datos: Omit<Filial, 'id' | 'activa'>): Observable<Filial> {
    return this.http.post<Filial>(`${API}/filiales`, datos);
  }
  estadoFilial(codigo: string, activa: boolean): Observable<Filial> {
    return this.http.patch<Filial>(`${API}/filiales/${codigo}/estado`, { activa });
  }

  // Productos
  productos(texto?: string, categoria?: Categoria | null): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${API}/productos`, { params: this.params({ texto, categoria }) });
  }
  crearProducto(datos: Omit<Producto, 'id' | 'activo' | 'creadoEn' | 'paisOrigen'>): Observable<Producto> {
    return this.http.post<Producto>(`${API}/productos`, datos);
  }
  actualizarProducto(sku: string, datos: Partial<Producto>): Observable<Producto> {
    return this.http.patch<Producto>(`${API}/productos/${sku}`, datos);
  }
  descontinuarProducto(sku: string): Observable<Producto> {
    return this.http.delete<Producto>(`${API}/productos/${sku}`);
  }

  // Inventario
  inventario(filial?: string | null): Observable<FilaInventario[]> {
    return this.http.get<FilaInventario[]>(`${API}/inventario`, { params: this.params({ filial }) });
  }
  ingresarStock(filialCodigo: string, sku: string, unidades: number): Observable<unknown> {
    return this.http.post(`${API}/inventario/ingresos`, { filialCodigo, sku, unidades });
  }

  // Ventas
  ventas(filtro: { filial?: string | null; sku?: string; desde?: string; hasta?: string }): Observable<{ total: number; ventas: Venta[] }> {
    return this.http.get<{ total: number; ventas: Venta[] }>(`${API}/ventas`, { params: this.params(filtro) });
  }
  registrarVenta(datos: { filialCodigo: string; sku: string; cantidad: number; precioUnitario: number; fecha?: string }): Observable<Venta> {
    return this.http.post<Venta>(`${API}/ventas`, datos);
  }
  previsualizarImportacion(filialCodigo: string, contenido: string): Observable<VistaPreviaImportacion> {
    return this.http.post<VistaPreviaImportacion>(`${API}/ventas/importar/previsualizar`, { filialCodigo, contenido });
  }
  importar(filialCodigo: string, contenido: string): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(`${API}/ventas/importar`, { filialCodigo, contenido });
  }

  // Reportes
  generarReporte(solicitud: SolicitudReporte): Observable<ResultadoReporte> {
    return this.http.post<ResultadoReporte>(`${API}/reportes`, solicitud);
  }
  reporteRapido(tipo: TipoReporte): Observable<ResultadoReporte> {
    return this.http.post<ResultadoReporte>(`${API}/reportes/rapido`, { tipo });
  }
  historial(): Observable<ItemHistorial[]> {
    return this.http.get<ItemHistorial[]>(`${API}/reportes/historial`);
  }
  documento(id: string): Observable<DocumentoReporte> {
    return this.http.get<DocumentoReporte>(`${API}/reportes/${id}`);
  }
  descargar(id: string, formato: string): Observable<Blob> {
    return this.http.get(`${API}/reportes/${id}/descargar`, { params: { formato }, responseType: 'blob' });
  }
  verificar(documento: unknown): Observable<{ valido: boolean; mensaje: string }> {
    return this.http.post<{ valido: boolean; mensaje: string }>(`${API}/reportes/verificar`, { documento });
  }
  plantillas(): Observable<{ bases: Plantilla[]; variantes: Plantilla[] }> {
    return this.http.get<{ bases: Plantilla[]; variantes: Plantilla[] }>(`${API}/reportes/plantillas`);
  }

  // Configuración
  configuracion(): Observable<Configuracion> {
    return this.http.get<Configuracion>(`${API}/configuracion`);
  }
  actualizarTasa(moneda: string, tasa: number): Observable<Configuracion> {
    return this.http.patch<Configuracion>(`${API}/configuracion/tasas/${moneda}`, { tasa });
  }
  actualizarPoliticas(datos: { stockMinimo?: number; margenObjetivo?: number; avisoLegal?: string }): Observable<Configuracion> {
    return this.http.patch<Configuracion>(`${API}/configuracion/politicas`, datos);
  }
  restablecerDemo(): Observable<unknown> {
    return this.http.post(`${API}/demo/restablecer`, {});
  }
}
