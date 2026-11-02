/**
 * Tokens de inyección de dependencias (DIP).
 * Los servicios piden `Repositorio<T>` por token y Nest entrega la implementación
 * configurada en PersistenciaModule; cambiar de almacenamiento no toca los servicios.
 */
export const REPO_FILIALES = Symbol('REPO_FILIALES');
export const REPO_PRODUCTOS = Symbol('REPO_PRODUCTOS');
export const REPO_STOCK = Symbol('REPO_STOCK');
export const REPO_VENTAS = Symbol('REPO_VENTAS');
export const REPO_REPORTES = Symbol('REPO_REPORTES');
export const CONFIGURACION = Symbol('CONFIGURACION');
export const POOL_CONEXIONES = Symbol('POOL_CONEXIONES');
export const REGISTRO_ADAPTADORES = Symbol('REGISTRO_ADAPTADORES');
