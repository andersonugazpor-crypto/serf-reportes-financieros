import { Global, Module } from '@nestjs/common';
import { ConfiguracionCorporativa } from '../../configuracion/configuracion-corporativa';
import {
  CONFIGURACION,
  POOL_CONEXIONES,
  REPO_FILIALES,
  REPO_PRODUCTOS,
  REPO_REPORTES,
  REPO_STOCK,
  REPO_VENTAS,
} from '../../comun/tokens';
import { PoolConexiones } from './pool-conexiones';
import { RepositorioEnMemoria } from './repositorio';

/**
 * Registra las implementaciones concretas de persistencia.
 * Los Singletons se exponen con `useFactory` llamando a `obtenerInstancia()`:
 * Nest reutiliza la misma instancia que existe en el resto de la aplicación.
 */
@Global()
@Module({
  providers: [
    { provide: CONFIGURACION, useFactory: () => ConfiguracionCorporativa.obtenerInstancia() },
    { provide: POOL_CONEXIONES, useFactory: () => PoolConexiones.obtenerInstancia() },
    { provide: REPO_FILIALES, useFactory: () => new RepositorioEnMemoria('filiales') },
    { provide: REPO_PRODUCTOS, useFactory: () => new RepositorioEnMemoria('productos') },
    { provide: REPO_STOCK, useFactory: () => new RepositorioEnMemoria('stock') },
    { provide: REPO_VENTAS, useFactory: () => new RepositorioEnMemoria('ventas') },
    { provide: REPO_REPORTES, useFactory: () => new RepositorioEnMemoria('reportes') },
  ],
  exports: [CONFIGURACION, POOL_CONEXIONES, REPO_FILIALES, REPO_PRODUCTOS, REPO_STOCK, REPO_VENTAS, REPO_REPORTES],
})
export class PersistenciaModule {}
