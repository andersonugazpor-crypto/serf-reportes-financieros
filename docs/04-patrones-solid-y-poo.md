# 04 · Patrones de diseño, SOLID y orientación a objetos

Diagramas UML (fuentes Mermaid editables en [`uml/`](uml/)):

| Diagrama | Archivo |
|---|---|
| Arquitectura del sistema | [`uml/01-arquitectura.png`](uml/01-arquitectura.png) |
| Patrones creacionales | [`uml/02-creacionales.png`](uml/02-creacionales.png) |
| Patrones estructurales | [`uml/03-estructurales.png`](uml/03-estructurales.png) |
| Modelo de dominio | [`uml/04-dominio.png`](uml/04-dominio.png) |
| Secuencia: generar un reporte | [`uml/05-secuencia-reporte.png`](uml/05-secuencia-reporte.png) |
| Casos de uso | [`uml/06-casos-uso.png`](uml/06-casos-uso.png) |

> **StarUML:** los diagramas se entregan como imágenes y en código Mermaid. Para la versión en StarUML, crea un *Class Diagram* por archivo y replica las clases y relaciones de cada imagen (los nombres coinciden con el código fuente).

---

## Patrones creacionales

### Singleton: configuración centralizada y pool de conexiones

`backend/src/configuracion/configuracion-corporativa.ts` · `backend/src/infraestructura/persistencia/pool-conexiones.ts`

```ts
export class ConfiguracionCorporativa {
  private static instancia: ConfiguracionCorporativa | null = null;
  private constructor() { /* valores por defecto */ }

  static obtenerInstancia(): ConfiguracionCorporativa {
    if (!ConfiguracionCorporativa.instancia) {
      ConfiguracionCorporativa.instancia = new ConfiguracionCorporativa();
    }
    return ConfiguracionCorporativa.instancia;
  }
}
```

- El **constructor privado** impide hacer `new ConfiguracionCorporativa()`; la prueba lo verifica con `@ts-expect-error`.
- **Punto de acceso global y controlado:** el estado solo cambia con `actualizarTasa()` y `actualizarPoliticas()`, que validan los datos. `vista()` devuelve una copia congelada sin el secreto de firma.
- **Uso en todo el sistema:** consolidación (tasas), decoradores (aviso legal y secreto de firma), pool (tamaño) y Nest (`useFactory: () => ConfiguracionCorporativa.obtenerInstancia()`).
- `PoolConexiones` es el segundo Singleton: 5 conexiones reutilizables. `ejecutar()` devuelve siempre la conexión al pool, aunque la operación falle.

### Prototype: plantillas por país

`backend/src/reportes/prototype/plantilla-reporte.ts` · `registro-plantillas.ts`

```ts
clonar(): PlantillaReporte {
  return new PlantillaReporte({
    ...,
    estilo: { ...this.estilo },                 // copia del objeto
    textosLegales: [...this.textosLegales],     // copia del arreglo
    estructura: this.estructura.clonar(),       // copia profunda del árbol Composite
  }, false);
}
```

- **Clonación profunda:** modificar un clon no altera la plantilla base; lo verifican 5 pruebas.
- `RegistroPlantillas.obtener('VENTAS', 'PE')` clona la base y la **personaliza** con normativa (PCGE–SUNAT), formato regional (`es-PE`) y texto legal. Con 4 plantillas base se obtienen 24 variantes.
- El código cliente nunca instancia una plantilla concreta: siempre recibe un clon.

### Builder: construcción paso a paso con API fluida

`backend/src/reportes/builder/reporte-builder.ts` · `director-reportes.ts`

```ts
ReporteBuilder.desdePlantilla(plantillaClonada)
  .conTitulo('Reporte de ventas')
  .paraPeriodo('2026-10-01', '2026-10-31')
  .deFiliales(['ES', 'MX'])
  .seccion('ventas-filial', (s) => s
    .tabla('Ventas por filial', columnas, filas, totales)
    .subseccion('Detalle', (d) => d.parrafo('…').subseccion('Más detalle', (m) => m.indicador('KPI', 5, 'numero'))))
  .construir();   // valida los pasos obligatorios y recién ahí crea el Reporte
```

- **Construcción separada de la representación:** el `Reporte` solo existe tras `construir()`, que valida título, periodo, filiales y contenido.
- **Director:** `DirectorReportes` contiene la receta estándar de cada tipo (VENTAS, INVENTARIO, RENTABILIDAD, EJECUTIVO), por eso todos los reportes de un tipo tienen el mismo formato.

### Fábrica de exportadores

`FabricaExportadores.crear('HTML' | 'CSV' | 'JSON')` devuelve la abstracción `Exportador`; la fachada nunca conoce las clases concretas. Para agregar PDF basta con `registrar('PDF', () => new ExportadorPdf())`.

---

## Patrones estructurales

### Composite: secciones y subsecciones

`backend/src/reportes/composite/componentes.ts`

- `ComponenteReporte` (abstracto) define `aNodo()`, `clonar()`, `reemplazarMarcadores()` y `contarElementos()`.
- `Seccion` (compuesto) contiene cualquier `ComponenteReporte`, incluidas otras secciones, con **anidamiento ilimitado** (una prueba crea 25 niveles). También impide ciclos.
- Las hojas son `Parrafo`, `Tabla`, `Grafico` e `Indicador`.
- En el frontend, `NodoReporteComponent` es **recursivo**: dibuja cualquier profundidad.

### Decorator: características extra sin modificar el reporte

`backend/src/reportes/decorator/decoradores.ts`

```ts
let capa: IReporte = reporte;
if (opciones.indice) capa = new IndiceDecorator(capa);
if (opciones.marcaAgua) capa = new MarcaAguaDecorator(capa, opciones.marcaAgua);
if (opciones.confidencialidad) capa = new ConfidencialDecorator(capa, opciones.confidencialidad);
if (opciones.pieLegal) capa = new PieLegalDecorator(capa);
if (opciones.firmar) capa = new FirmaDigitalDecorator(capa, usuario);   // siempre al final
```

- Cada decorador envuelve un `IReporte`, delega en él y agrega **una sola** característica sobre una copia del documento.
- Las capas se registran en orden (`documento.capas`) y la interfaz las muestra.
- `FirmaDigitalDecorator` calcula un HMAC-SHA256 sobre el JSON canónico del documento. `VerificadorFirma` detecta cualquier modificación, incluso después de que el documento viaje como archivo.

### Facade: interfaz simplificada

`backend/src/reportes/fachada/generador-reportes.facade.ts`

`generar(solicitud, usuario)` o `generarRapido(tipo, usuario)` ocultan cinco subsistemas: consolidación, plantillas, builder y director, decoradores y exportadores. El controlador y la interfaz web hacen **una sola llamada**.

### Adapter: integración de formatos de cada filial

`backend/src/filiales/adaptadores/` · `backend/src/filiales/sistemas-externos/`

| Filial | Sistema local (*adaptee*) | Formato | Adaptador |
|---|---|---|---|
| España | `ErpEspana` | JSON con `articulo`, `uds`, `importe_unitario_eur` | `AdaptadorEspana` |
| México | `PosMexico` | CSV, fechas `DD/MM/AAAA` | `AdaptadorMexico` |
| Perú | `SistemaContablePeru` | XML con atributos | `AdaptadorPeru` |
| Alemania | `WarenwirtschaftDeutschland` | Secciones `[VERKAUF]`/`[BESTAND]`, `;` y coma decimal | `AdaptadorAlemania` |
| Colombia y nuevas | — | JSON estándar corporativo | `AdaptadorEstandar` |

Todos implementan `AdaptadorDatosFilial.adaptar()` y devuelven el mismo `LoteNormalizado`.

---

## Principios SOLID

| Principio | Dónde se aplica |
|---|---|
| **S** · Responsabilidad única | `ConsolidacionService` solo calcula cifras; `DirectorReportes` solo arma recetas; cada decorador agrega una característica; cada exportador produce un formato; `FiltroErrores` traduce errores de dominio a HTTP. Las entidades no saben de HTTP. |
| **O** · Abierto/cerrado | Una filial nueva implica registrar un adaptador; un formato de salida nuevo, registrar un exportador; una capa nueva, una clase que extiende `DecoradorReporte`. Ninguno de estos cambios modifica código existente. |
| **L** · Sustitución de Liskov | Cualquier `ComponenteReporte` funciona donde se espera otro (contar, clonar, serializar). Cualquier decorador sustituye a `IReporte`. Cualquier adaptador sustituye a `AdaptadorDatosFilial`. |
| **I** · Segregación de interfaces | Interfaces pequeñas: `Identificable`, `Repositorio<T>` (5 métodos), `Exportador` (1 método), `IReporte` (1 método), `Prototipo<T>` (1 método). |
| **D** · Inversión de dependencias | Los servicios reciben `Repositorio<T>` por *token* de inyección (`REPO_VENTAS`, etc.). Cambiar a una base de datos real implica cambiar `PersistenciaModule`, no los servicios. |

## Diseño orientado a objetos

- **Abstracción y herencia:** `Entidad<TDto>` (abstracta) → `Filial`, `Producto`, `Stock`, `Venta`; `AdaptadorBase` → 5 adaptadores; `DecoradorReporte` → 5 decoradores; `ComponenteReporte` → 5 componentes.
- **Encapsulamiento completo:** los atributos son `private` y se exponen con getters. Los cambios pasan por métodos que validan:
  - `Producto.actualizarPrecios()`
  - `Stock.retirar()` lanza `ErrorConflicto` si no hay stock.
  - `Seccion.obtenerHijos()` devuelve una copia.
  - `Tabla` hace copias defensivas de sus arreglos.
- **Objeto de valor `Dinero`:** inmutable, trabaja en céntimos y no permite sumar monedas distintas sin convertir.
- **Validación con `asegurar()`:** errores de dominio tipados (`ErrorValidacion`, `ErrorConflicto`, `ErrorNoEncontrado`) que un filtro global convierte en HTTP 400/409/404.
