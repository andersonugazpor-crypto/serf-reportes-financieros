import { ConfiguracionCorporativa } from '../../src/configuracion/configuracion-corporativa';
import { ErrorConflicto, ErrorValidacion } from '../../src/comun/errores';
import { PoolConexiones } from '../../src/infraestructura/persistencia/pool-conexiones';
import { RepositorioEnMemoria } from '../../src/infraestructura/persistencia/repositorio';

describe('Patrón Singleton', () => {
  beforeEach(() => {
    ConfiguracionCorporativa.reiniciarParaPruebas();
    PoolConexiones.reiniciarParaPruebas();
  });

  describe('ConfiguracionCorporativa', () => {
    it('devuelve siempre la misma instancia', () => {
      const a = ConfiguracionCorporativa.obtenerInstancia();
      const b = ConfiguracionCorporativa.obtenerInstancia();
      expect(a).toBe(b);
    });

    it('no permite instanciarse con new (constructor privado)', () => {
      // @ts-expect-error: el constructor es privado; TypeScript impide la llamada.
      const intento = () => new ConfiguracionCorporativa();
      expect(typeof intento).toBe('function');
    });

    it('un cambio hecho desde un lugar se ve desde cualquier otro', () => {
      ConfiguracionCorporativa.obtenerInstancia().actualizarTasa('PEN', 0.25);
      expect(ConfiguracionCorporativa.obtenerInstancia().tasaHaciaConsolidacion('PEN')).toBe(0.25);
    });

    it('valida los datos antes de modificar su estado', () => {
      const config = ConfiguracionCorporativa.obtenerInstancia();
      expect(() => config.actualizarTasa('USD', -1)).toThrow(ErrorValidacion);
      expect(() => config.actualizarTasa('EUR', 2)).toThrow('siempre tiene tasa 1');
      expect(() => config.actualizarPoliticas({ margenObjetivo: 1.5 })).toThrow(ErrorValidacion);
    });

    it('la vista es una copia congelada que no expone el secreto de firma', () => {
      const vista = ConfiguracionCorporativa.obtenerInstancia().vista();
      expect(Object.isFrozen(vista)).toBe(true);
      expect(JSON.stringify(vista)).not.toContain('secreto');
      (vista.tasasCambio as Record<string, number>)['USD'] = 999;
      expect(ConfiguracionCorporativa.obtenerInstancia().tasaHaciaConsolidacion('USD')).not.toBe(999);
    });
  });

  describe('PoolConexiones', () => {
    it('es único y tiene el tamaño definido en la configuración', () => {
      const pool = PoolConexiones.obtenerInstancia();
      expect(PoolConexiones.obtenerInstancia()).toBe(pool);
      expect(pool.estado().total).toBe(ConfiguracionCorporativa.obtenerInstancia().tamanoPoolConexiones);
    });

    it('presta y libera conexiones, reutilizándolas', () => {
      const pool = PoolConexiones.obtenerInstancia();
      const c1 = pool.adquirir();
      expect(pool.estado().ocupadas).toBe(1);
      pool.liberar(c1);
      const c2 = pool.adquirir();
      expect(c2).toBe(c1);
      expect(c2.vecesUsada).toBe(2);
      pool.liberar(c2);
    });

    it('lanza un error cuando se agotan las conexiones', () => {
      const pool = PoolConexiones.obtenerInstancia();
      const prestadas = Array.from({ length: pool.estado().total }, () => pool.adquirir());
      expect(() => pool.adquirir()).toThrow(ErrorConflicto);
      prestadas.forEach((c) => pool.liberar(c));
    });

    it('ejecutar() devuelve la conexión aunque la operación falle', () => {
      const pool = PoolConexiones.obtenerInstancia();
      expect(() =>
        pool.ejecutar(() => {
          throw new Error('fallo');
        }),
      ).toThrow('fallo');
      expect(pool.estado().ocupadas).toBe(0);
    });

    it('una conexión liberada no puede seguir usándose', () => {
      const pool = PoolConexiones.obtenerInstancia();
      const c = pool.adquirir();
      pool.liberar(c);
      expect(() => c.tabla('x')).toThrow(ErrorConflicto);
    });

    it('los repositorios comparten datos a través del mismo pool', () => {
      const a = new RepositorioEnMemoria<{ id: string }>('compartida');
      const b = new RepositorioEnMemoria<{ id: string }>('compartida');
      a.guardar({ id: '1' });
      expect(b.buscarPorId('1')).toEqual({ id: '1' });
      expect(PoolConexiones.obtenerInstancia().estado().prestamosRealizados).toBeGreaterThan(0);
    });
  });
});
