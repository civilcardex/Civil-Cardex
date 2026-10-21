import ts from 'typescript';

/**
 * Detector de focos de complejidad (guard G8).
 *
 * Un "foco" es una búsqueda lineal (`.find`, `.findIndex`, `.some`, `.filter`, `.indexOf`,
 * `.includes`) hecha DENTRO de un bucle: el caso clásico de O(n²) — por cada pieza del plano
 * se recorre otra vez la lista de piezas.
 *
 * Se parsea con el AST de TypeScript (no con regex): así el detector sabe qué es de verdad
 * un bucle y qué es una llamada suelta, y no cuenta falsos positivos.
 *
 * El detector NO decide si el foco duele: eso lo sabe el que escribe el código. Aquí solo se
 * cuenta, para que el guard pueda decir "esto no puede crecer" y para que cada arreglo hecho
 * baje el número de forma visible.
 */

/** Una búsqueda lineal detectada dentro de un bucle. */
export interface FocoComplejidad {
  /** Ruta relativa a `src/`, con `/` como separador. */
  archivo: string;
  /** Línea (1-based) donde empieza el bucle. */
  linea: number;
  /** Método de búsqueda que se está usando. */
  metodo: string;
}

/** Métodos que recorren la colección ENTERA (o una parte) buscando un valor. */
export const METODOS_BUSQUEDA = [
  'find',
  'findIndex',
  'some',
  'filter',
  'indexOf',
  'includes',
] as const;

const METODO_BUSQUEDA = new Set<string>(METODOS_BUSQUEDA);

/**
 * Cuenta los focos de un archivo.
 *
 * Cada búsqueda lineal cuenta UNA vez, atribuida al bucle MÁS EXTERNO que la contiene: así
 * una búsqueda dentro de un bucle dentro de otro bucle no se cuenta dos veces (el número
 * reflects cuántos bucles deeply anidados hay, no cuántos focos).
 *
 * @param src - código fuente del archivo.
 * @returns los focos encontrados, con su línea y método.
 */
export function detectarFocosEnFuente(src: string): FocoComplejidad[] {
  const sf = ts.createSourceFile('foco.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const focos: FocoComplejidad[] = [];

  /**
   * Propiedades cuyo tamaño NO escala con el plano: los puntos de un trazo, sus extremos, su
   * longitud. Buscar dentro de ellas es barato (decenas de elementos), aunque el detector lo
   * vea como un bucle.
   *
   * OJO: se comparan por NOMBRE de propiedad (sin punto). Con un regex que exigía el punto
   * inicial contra `name.text` (que NO lo tiene), la exclusión NUNCA se aplicaba y el
   * baseline medía 25 focos de más (regla D del guard: si el código tiene menos, hay que
   * bajar el número).
   */
  const PROPS_POR_TRAZO = new Set(['pts', 'puntos', 'extremos', 'vertices', 'verticesPts']);

  /**
   * Propiedades de listas CORRELATIVAS (los ids que una pieza recibe o alimenta). Son cortas —
   * unas pocas por pieza — y no crecen con el tamaño del plano.
   */
  const PROPS_LISTA_CORTA = new Set(['recibeDeIds', 'alimentaIds']);

  /**
   * Catálogos de tamaño FIJO (la lista de redes, de materiales, de tipos de accesorio…).
   * Buscar en ellos no escala con el plano: son 6-10 elementos y no crecen.
   */
  const CATALOGOS_FIJOS =
    /^(NETS|CATALOGO|CATALOGOS|MODULOS|MODULES|GAS|APARATOS_DEF|UD_BASE|TEE_TYPES|PLAN_CODO_TYPES|ACC_COLS|GAS_ACC_KEYS)$/;

  /** ¿Es esta llamada una búsqueda lineal sobre una colección? */
  const esBusqueda = (call: ts.CallExpression): string | null => {
    const expr = call.expression;
    if (!ts.isPropertyAccessExpression(expr)) return null;
    const nombre = expr.name.text;
    if (!METODO_BUSQUEDA.has(nombre)) return null;
    // Sobre un literal inline (`[...].find(...)`) no escala: no cuenta.
    if (ts.isArrayLiteralExpression(expr.expression)) return null;
    // Sobre un STRING no escala (`id.includes('|')`): el receptor es de tamaño fijo.
    if (
      ts.isStringLiteral(expr.expression) ||
      ts.isNoSubstitutionTemplateLiteral(expr.expression)
    ) {
      return null;
    }
    // Sobre los puntos de un trazo no escala: un trazo tiene decenas de puntos, no cientos.
    if (
      ts.isPropertyAccessExpression(expr.expression) &&
      PROPS_POR_TRAZO.has(expr.expression.name.text)
    ) {
      return null;
    }
    // Sobre un catálogo de tamaño fijo no escala.
    if (ts.isIdentifier(expr.expression) && CATALOGOS_FIJOS.test(expr.expression.text)) {
      return null;
    }
    // Sobre una lista correlativa corta (los ids que una pieza recibe) no escala.
    if (
      ts.isPropertyAccessExpression(expr.expression) &&
      PROPS_LISTA_CORTA.has(expr.expression.name.text)
    ) {
      return null;
    }
    return nombre;
  };

  /** El cuerpo de un bucle (la parte que se repite). */
  const cuerpoDe = (n: ts.Node): ts.Node => {
    if (
      ts.isForStatement(n) ||
      ts.isForOfStatement(n) ||
      ts.isForInStatement(n) ||
      ts.isWhileStatement(n) ||
      ts.isDoStatement(n)
    ) {
      return (n as ts.ForStatement).statement;
    }
    return n;
  };

  /** ¿Es este nodo un bucle? */
  const esBucle = (n: ts.Node): boolean =>
    ts.isForStatement(n) ||
    ts.isForOfStatement(n) ||
    ts.isForInStatement(n) ||
    ts.isWhileStatement(n) ||
    ts.isDoStatement(n);

  /** Recorre buscando el bucle más externo que contiene a `objetivo` en su CUERPO. */
  const bucleExterno = (objetivo: ts.Node): ts.Node | null => {
    let encontrado: ts.Node | null = null;
    const contiene = (raiz: ts.Node, objetivo: ts.Node): boolean => {
      if (raiz === objetivo) return true;
      let hit = false;
      raiz.forEachChild((c) => {
        if (!hit && contiene(c, objetivo)) hit = true;
      });
      return hit;
    };
    const buscar = (n: ts.Node, dentro: ts.Node | null): void => {
      if (objetivo === n) {
        encontrado = dentro;
        return;
      }
      let siguiente = dentro;
      if (esBucle(n) && !dentro && contiene(cuerpoDe(n), objetivo)) siguiente = n;
      n.forEachChild((c) => buscar(c, siguiente));
    };
    sf.forEachChild((c) => buscar(c, null));
    return encontrado;
  };

  // Cada llamada de búsqueda: se cuenta si está dentro de un bucle (o dentro del callback
  // de un forEach/map/filter, que también es un bucle).
  const visitar = (nodo: ts.Node): void => {
    if (ts.isCallExpression(nodo)) {
      const metodo = esBusqueda(nodo);
      if (metodo && !esFiltroDeReasignacion(nodo)) {
        const bucle = bucleExterno(nodo);
        if (bucle) {
          const linea = sf.getLineAndCharacterOfPosition(bucle.getStart()).line + 1;
          focos.push({ archivo: '', linea, metodo });
        }
      }
    }
    nodo.forEachChild(visitar);
  };
  sf.forEachChild(visitar);

  // Los callbacks de forEach/map/filter también son bucles: una búsqueda dentro del callback
  // cuenta si NO está ya dentro de un bucle propio.
  const visitarCallbacks = (nodo: ts.Node): void => {
    if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      ['forEach', 'map', 'filter'].includes(nodo.expression.name.text)
    ) {
      for (const arg of nodo.arguments) {
        if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue;
        const recorrer = (x: ts.Node): void => {
          if (ts.isCallExpression(x)) {
            const metodo = esBusqueda(x);
            if (metodo && !bucleExterno(x)) {
              const linea = sf.getLineAndCharacterOfPosition(nodo.getStart()).line + 1;
              focos.push({ archivo: '', linea, metodo });
            }
          }
          x.forEachChild(recorrer);
        };
        recorrer(arg.body);
      }
    }
    nodo.forEachChild(visitarCallbacks);
  };
  sf.forEachChild(visitarCallbacks);

  return focos;
}

/**
 * ¿Este filtro REASIGNA un array del motor (`engine.ramales = engine.ramales.filter(...)`)?
 *
 * No es una búsqueda: es una pasada que CONSTRUYE la lista nueva. Cuenta una vez por
 * reasignación, no por elemento — y el resultado no escala al cuadrado. El detector lo
 * contaba porque estaba dentro de un bucle, inflando los archivos que borran o filtran.
 */
function esFiltroDeReasignacion(call: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (call.expression.name.text !== 'filter') return false;
  const padre = call.parent;
  if (!padre) return false;
  return ts.isBinaryExpression(padre) && padre.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}

/**
 * Cuenta los focos por archivo de un conjunto de fuentes.
 * @param fuentes - mapa ruta (relativa a src/) → contenido.
 * @returns mapa ruta → número de focos.
 */
export function contarFocosPorArchivo(fuentes: Record<string, string>): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const [ruta, src] of Object.entries(fuentes)) {
    const n = detectarFocosEnFuente(src).length;
    if (n > 0) conteo[ruta] = n;
  }
  return conteo;
}

/** Suma de los focos de un mapa de conteos. */
export function totalFocos(conteo: Record<string, number>): number {
  return Object.values(conteo).reduce((s, n) => s + n, 0);
}
