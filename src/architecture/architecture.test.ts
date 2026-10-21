import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { contarFocosPorArchivo, totalFocos } from './complejidad';

/**
 * GUARDIAS DE ARQUITECTURA (desmonotilización 2026-10-19).
 *
 * Comprueban que el código no vuelva a convertirse en monolitos y que la división en
 * módulos no rompa la API pública que usan el resto de la app:
 *  G1 Anti-monolito: ningún archivo nuevo pasa del tope; los conocidos no CRECEN.
 *  G2 API pública: los archivos conservados siguen exportando lo que exportaban.
 *  G3 Ciclos: no aparecen ciclos de import nuevos (el conocido está en la lista).
 *  G4 Pureza: los módulos de cálculo no importan React (son testeables en node).
 *  G5 Cobertura: cada módulo nuevo tiene al menos un test que lo importa.
 *  G8 Complejidad: las búsquedas lineales dentro de bucles (focos O(n²)) no crecen.
 */

const RAIZ = resolve(process.cwd(), 'src');

/** Topes por tipo de módulo (líneas). El código sano del repo vive entre 100 y 700. */
const TOPE_PURO = 500;
const TOPE_HOOK = 700;
/** Tope global para cualquier archivo que no esté en la lista de conocidos. */
const TOPE_NUEVO = 700;

/**
 * Monolitos que NO se parten en esta tanda (ya son fachadas/tipos o son riesgo de render) con
 * su tamaño actual como techo: si uno CRECE, el guard avisa (el monolito volvió a crecer).
 * Los que sí se parten (aparatosPresion, sanAccesoriosTable, useInfTables, PdfViewer,
 * PlanosTab, las tablas grandes) desaparecen de aquí al dividirse: su ausencia ES la prueba.
 */
const CONOCIDOS: Record<string, number> = {
  'modules/civilflow/components/PdfViewer.tsx': 1493,
  'modules/civilflow/lib/PlanoEngine/PlanoMotor.ts': 1425,
  'modules/civilflow/components/workareaContent/useInfTablas.ts': 1236,
  'modules/civilflow/lib/PlanoEngine/renderers/dibujaRamales.ts': 1225,
  'modules/civilflow/utils/sanAccesoriosTabla.ts': 1213,
  'modules/civilflow/utils/waterFilasNucleo.ts': 704,
  'modules/civilflow/components/workarea/PlanosPestana.tsx': 710,
  'modules/civilflow/components/BajantesTabla.tsx': 1001,
  'modules/civilflow/components/SupplyConexion.tsx': 1162,
  'modules/civilflow/components/GasDesign.tsx': 380,
  'modules/civilflow/components/AparatosPanel.tsx': 905,
  'modules/civilflow/components/workarea/PlanoConfigurador.tsx': 605,
  'modules/civilflow/components/LluviaCanalesVerifica.tsx': 993,
  'modules/civilflow/constants/rejillasNTC3631.ts': 978,
  'modules/civilflow/lib/PlanoEngine/manejaArrastrarMueve.ts': 977,
  'pages/auth/PerfilPagina.tsx': 967,
  'modules/civilflow/lib/PlanoEngine/PlanoEstado.ts': 936,
  'modules/civilflow/components/workarea/isometry/useIsometriaDibuja.ts': 918,
  'modules/civilflow/components/rejillasVentilacion/TablaTipologias.tsx': 898,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenu.tsx': 883,
  'pages/PreciosPagina.tsx': 878,
  'modules/civilflow/lib/PlanoEngine/finishRamal.ts': 867,
  'modules/civilflow/components/pdfViewer/tramoEditor/bajanteEditor.tsx': 844,
  'modules/civilflow/components/LluviaBajantesVerifica.tsx': 827,
  'modules/civilflow/components/DesignParametros.tsx': 822,
  'modules/civilflow/utils/equipoFilas.ts': 822,
  'modules/civilflow/components/BombaARDesign.tsx': 815,
  'modules/civilflow/lib/PlanoEngine/sanAccesoriosCalculo.ts': 807,
  'components/help/ayudaGuiaFlujo.tsx': 804,
  'modules/civilflow/components/SanitariaDesign.tsx': 802,
  'modules/civilflow/components/pdfViewer/PdfViewerBarra.tsx': 770,
  'modules/civilflow/components/ep/EPVerificationPagina.tsx': 751,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/medioRamalAccesorioSelector.tsx': 749,
  'modules/civilflow/context/LluviasContexto.tsx': 746,
  'modules/civilflow/lib/PlanoEngine/manejaArrastrarArriba.ts': 743,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/diametroSelector.tsx': 736,
  'modules/civilflow/utils/copiaDibujoFromPlano.ts': 701,
};

/**
 * Archivos que gestiona esta campaña (los que se parten): deben quedar como fachadas cortas.
 * El resto del repo tiene otras sesiones trabajando encima: su tamaño no es contrato aquí.
 */
const GESTIONADOS: Record<string, number> = {
  'modules/civilflow/utils/aparatosPresion.ts': 40,
  'modules/civilflow/utils/sanAccesoriosTabla.ts': 40,
  'modules/civilflow/components/SupplyConexion.tsx': 60,
};

/**
 * Ciclos de import PREEXISTENTES (línea base 2026-10-19: 18 ciclos canónicos). El guard exige
 * que no aparezcan NUEVOS: cualquier ciclo fuera de esta lista es un regresión de la
 * desmonotilización. Si una división elimina alguno, esta lista se acorta (y el guard lo pide).
 */
const CICLOS_CONOCIDOS = [
  'ApparatusContext.tsx|apparatusService.ts',
  'PlanoConfigurator.tsx|useCalibration.ts',
  'PlanoEngine.ts|bombaAssociation.ts|bombaDesvio.ts|deleteSelected.ts',
  'PlanoEngineDrawing.ts|cajaBajante.ts|drawingCreations.ts',
  'PlanoEngineDrawing.ts|cajaBajante.ts|drawingCreations.ts|montantes.ts',
  'PlanoEngineDrawing.ts|deleteJunctionCleanup.ts|deleteRemerge.ts|deleteRemergeInternals.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|deleteJunctionCleanup.ts|deleteRemerge.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|deleteJunctionCleanup.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|deleteRemerge.ts|deleteRemergeInternals.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|deleteRemerge.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|deleteYeePreserve.ts|drawingErase.ts',
  'PlanoEngineDrawing.ts|drawingCreations.ts|montantes.ts',
  'PlanoEngineSelection.ts|PlanoEngineSelectionEdit.ts',
  'PlansContext.tsx|gasRows.ts|projectDataService.ts',
  'ProjectContext.tsx|projectDataService.ts',
  'RainwaterContext.tsx|rainwaterOverrideStore.ts',
  'RainwaterContext.tsx|rainwaterOverridesService.ts',
  'labels.ts|useEpc3DScene.ts',
];

/**
 * Módulos que nacieron de la desmonotilización: el contrato de la división.
 *  ruta → { maxLineas, puro, testQueLoImporta }
 */
const MODULOS_NUEVOS: Array<{ ruta: string; maxLineas: number; puro: boolean; test: string }> = [
  {
    ruta: 'modules/civilflow/utils/propagation/index.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/reading.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/reading',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/aristas.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/aristas.ts',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/folding.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/folding',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/dfs.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/dfs',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/writing.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/writing',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/conteo.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/conteo.ts',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/index.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/index',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/collection.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/collection',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/yees.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/yees',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/catalogo.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/catalogo.ts',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/conteo.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/conteo.ts',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/bushing.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/bushing',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/filas.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/filas.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useSanTablas.ts',
    maxLineas: 300,
    puro: false,
    test: '../useSanTablas.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useLlTablas.ts',
    maxLineas: 300,
    puro: false,
    test: '../useLlTablas.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAfTablas.ts',
    maxLineas: 300,
    puro: false,
    test: '../useAfTablas.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAcTablas.ts',
    maxLineas: 300,
    puro: false,
    test: '../useAcTablas.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/tablaAyudantes.ts',
    maxLineas: 60,
    puro: false,
    test: '../tablaAyudantes.ts',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/Acometida.tsx',
    maxLineas: 250,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/LazyNum.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/LazyNumE.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/ParamFila.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/InlineComparisonFila.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/estilos.ts',
    maxLineas: 120,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/utils/diamFractionValor.ts',
    maxLineas: 60,
    puro: true,
    test: '../diamFractionValor.ts',
  },
  {
    ruta: 'test/dibuja.tsx',
    maxLineas: 200,
    puro: false,
    test: '../dibuja.tsx',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/FlujoSeccion.tsx',
    maxLineas: 360,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/ParametrosSeccion.tsx',
    maxLineas: 300,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/VerificationSeccion.tsx',
    maxLineas: 300,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/tipos.ts',
    maxLineas: 120,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/rainChannels/CanalFila.tsx',
    maxLineas: 330,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/components/rainChannels/CanalDimCampo.tsx',
    maxLineas: 140,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/utils/lluviaCanalCalculo.ts',
    maxLineas: 140,
    puro: true,
    test: 'canalesLluviasCalculo',
  },
  {
    ruta: 'modules/civilflow/utils/leePlanoDibujo.ts',
    maxLineas: 60,
    puro: true,
    test: 'leePlanoDibujo',
  },
  {
    ruta: 'modules/civilflow/utils/isLevelTaken.ts',
    maxLineas: 60,
    puro: true,
    test: '../isLevelTaken',
  },
  {
    ruta: 'modules/civilflow/utils/planosMeta.ts',
    maxLineas: 100,
    puro: true,
    test: '../planosMeta.ts',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/aparatoEspejos.ts',
    maxLineas: 410,
    puro: false,
    test: 'useAparatoEspejos',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/aparatoEspejosTipos.ts',
    maxLineas: 60,
    puro: false,
    test: 'useAparatoEspejos',
  },
  {
    ruta: 'architecture/complejidad.ts',
    maxLineas: 250,
    puro: true,
    test: './complejidad',
  },
  {
    ruta: 'modules/civilflow/utils/indices.ts',
    maxLineas: 120,
    puro: true,
    test: '../indices',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/indicesMotor.ts',
    maxLineas: 120,
    puro: true,
    test: '../indicesMotor',
  },
];

/**
 * G8 · COMPLEJIDAD — línea base de búsquedas lineales dentro de bucles (focos O(n²)).
 *
 * Un "foco" es una búsqueda lineal (`.find`, `.findIndex`, `.some`, `.filter`, `.indexOf`,
 * `.includes`) dentro de un bucle: por cada pieza del plano se recorre OTRA vez la lista de
 * piezas. El detector vive en `complejidad.ts` (puro, testeado aparte).
 *
 * Este baseline congela el estado actual: el guard NO permite que ningún archivo CREZCA de
 * focos, ni que aparezca uno nuevo. Cuando un archivo se arregla, su número baja aquí en el
 * mismo commit — si no, la regla D falla y avisa de que el baseline quedó viejo.
 *
 * Los archivos con menos de 5 focos no se listan: tolerados, pero sin veto (arreglarlos es
 * opcional; si uno llega a 5, entra en la lista y sí queda vigilado).
 */
const FOCOS_CONOCIDOS: Record<string, number> = {
  'modules/civilflow/lib/PlanoEngine/eliminaSelected.ts': 17,
  'modules/civilflow/lib/PlanoEngine/renderers/dibujaEmpalmes.ts': 16,
  'modules/civilflow/utils/asocDisposicionMigration.ts': 16,
  'modules/civilflow/utils/copiaDibujoFromPlano.ts': 15,
  'modules/civilflow/utils/lluviasFilas.ts': 13,
  'modules/civilflow/utils/propagation/aristas.ts': 13,
  'modules/civilflow/components/pdfViewer/tramoEditor/bajanteEditor.tsx': 11,
  'modules/civilflow/lib/PlanoEngine/renderers/dibujaRamales.ts': 11,
  'modules/civilflow/components/fixtures/aparatoEspejos.ts': 10,
  'modules/civilflow/components/pdfViewer/tramoEditor/editorSecciones.tsx': 9,
  'modules/civilflow/utils/bajanteVentFilas.ts': 9,
  'modules/civilflow/lib/PlanoEngine/eliminaYeePreserve.ts': 8,
  'modules/civilflow/lib/PlanoEngine/manejaArrastrarArriba.ts': 8,
  'modules/civilflow/lib/PlanoEngine/renderers/bajanteFantasmas.ts': 8,
  'modules/civilflow/lib/PlanoEngine/sanAccesoriosCalculo.ts': 8,
  'modules/civilflow/utils/bajanteFilaModelo.ts': 8,
  'modules/civilflow/components/pdfViewer/usePisoRamales.ts': 7,
  'modules/civilflow/components/workarea/IsometriaGeneral.tsx': 7,
  'modules/civilflow/components/workarea/isometry/useIsometriaDibuja.ts': 7,
  'modules/civilflow/lib/PlanoEngine/ratonAbajoArrastres.ts': 7,
  'modules/civilflow/utils/accessoriesTable/bushing.ts': 7,
  'modules/civilflow/utils/construyeTramos.ts': 7,
  'modules/civilflow/components/fixtures/SecMontantes.tsx': 6,
  'modules/civilflow/components/LluviaBajantesVerifica.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/bajanteConexionSecciones.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/canalesAsociados.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenu.tsx': 6,
  'modules/civilflow/lib/PlanoEngine/canalSello.ts': 6,
  'modules/civilflow/lib/PlanoEngine/PlanoMotorRed.ts': 6,
  'modules/civilflow/lib/PlanoEngine/redRenumera.ts': 6,
  'modules/civilflow/lib/PlanoEngine/renderers/dibujaRamalRuta.ts': 6,
  'modules/civilflow/utils/waterFilasAcometida.ts': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/bajanteConexionPanel.tsx': 5,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenuAyudantes.ts': 5,
  'modules/civilflow/components/rejillasVentilacion/TablaTipologias.tsx': 5,
  'modules/civilflow/context/LluviasContexto.tsx': 5,
  'modules/civilflow/lib/PlanoEngine/dibujoFlujo.ts': 5,
  'modules/civilflow/lib/PlanoEngine/manejaRatonAbajo.ts': 5,
  'modules/civilflow/utils/accessoriesTable/yees.ts': 5,
  'modules/civilflow/utils/construyeBajanteGrafo.ts': 5,
  'modules/civilflow/utils/drawingWrites/diametros.ts': 5,
  'modules/civilflow/utils/sanConnectivity.ts': 5,
  'pages/ModuloPagina.tsx': 5,
};

/**
 * Total de focos de todo src/ al congelar el baseline. El guard lo usa como techo global:
 * aunque un archivo nuevo aparezca con 1 foco, el total no puede subir. Baja cuando se
 * arregla algo (y entonces hay que bajar también su número en FOCOS_CONOCIDOS).
 */
const TOTAL_FOCOS_BASE = 542;

/** API pública que los archivos conservados deben seguir exportando (G2). */
const API_PUBLICA: Array<{ ruta: string; simbolos: string[] }> = [
  {
    ruta: 'modules/civilflow/utils/aparatosPresion.ts',
    simbolos: [
      'propagarAparatosPresion',
      'esRedAparatosPresion',
      'esReceptorPropagacion',
      'leerHeredadosPresion',
      'leerFoldTribPresion',
      'leerLibrosPresion',
      'udPropiaDe',
      'diagUltimaPropagacion',
    ],
  },
  {
    ruta: 'modules/civilflow/utils/sanAccesoriosTabla.ts',
    simbolos: ['computeAccesoriosTable'],
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useInfTablas.ts',
    simbolos: ['useInfTables'],
  },
];

/** Ciclos de import conocidos (se permiten; la lista NO debe crecer). */

function listarSrc(dir: string = RAIZ, acc: string[] = [], incluirTests = false): string[] {
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    const st = statSync(p);
    if (st.isDirectory()) listarSrc(p, acc, incluirTests);
    else if (/\.tsx?$/.test(nombre) && (incluirTests || !/\.test\.tsx?$/.test(nombre))) acc.push(p);
  }
  return acc;
}

const REL = (p: string) => relative(RAIZ, p).split(sep).join('/');
const lineasDe = (p: string) => readFileSync(p, 'utf8').split('\n').length;
const todosLosArchivos = listarSrc();

describe('G1 · anti-monolito', () => {
  it('ningún archivo fuera de la lista de conocidos pasa del tope nuevo', () => {
    const grandes = todosLosArchivos
      .map((p) => ({ ruta: REL(p), lineas: lineasDe(p) }))
      .filter((f) => f.lineas > TOPE_NUEVO && !(f.ruta in CONOCIDOS))
      .sort((a, b) => b.lineas - a.lineas);
    expect(grandes.map((g) => `${g.ruta} (${g.lineas})`)).toEqual([]);
  });

  it('los archivos que gestiona esta campaña NO han crecido', () => {
    // Solo los de la desmonotilización: el resto del repo tiene otras sesiones trabajando
    // encima, y su tamaño no es contrato de esta campaña.
    const crecidos: string[] = [];
    for (const [ruta, techo] of Object.entries(GESTIONADOS)) {
      const p = join(RAIZ, ruta);
      if (!exists(p)) {
        crecidos.push(`${ruta}: desapareció (debería ser la fachada)`);
        continue;
      }
      const n = lineasDe(p);
      if (n > techo) crecidos.push(`${ruta}: ${n} > ${techo}`);
    }
    expect(crecidos).toEqual([]);
  });
});

describe('G2 · la API pública no se rompió', () => {
  it('los archivos conservados siguen exportando sus símbolos', () => {
    const faltantes: string[] = [];
    for (const { ruta, simbolos } of API_PUBLICA) {
      const p = join(RAIZ, ruta);
      if (!exists(p)) {
        faltantes.push(`${ruta}: el archivo ya no existe`);
        continue;
      }
      const src = readFileSync(p, 'utf8');
      for (const s of simbolos) {
        const re = new RegExp(
          `export\\s+(?:async\\s+)?(?:function|const|class|type|interface|enum)\\s+${s}\\b`,
        );
        if (!re.test(src) && !new RegExp(`export\\s*\\{[^}]*\\b${s}\\b`, 's').test(src))
          faltantes.push(`${ruta}: no exporta ${s}`);
      }
    }
    expect(faltantes).toEqual([]);
  });

  // Las fachadas de la des-monotilización NO tienen importadores: existen SÓLO como
  // contrato del guard G2 (los importadores fueron rewirados al módulo real). Este test
  // hace explícita esa condición: si alguien vuelve a importarlas, avisa (la fachada ya
  // no es una puerta, es un contrato) en vez de dejar que el grafo diga lo contrario.
  it('las fachadas pinningadas siguen SIN importadores (existen solo como contrato)', () => {
    const conImportadores: string[] = [];
    for (const { ruta } of API_PUBLICA) {
      if (!ruta.endsWith('aparatosPresion.ts') && !ruta.endsWith('sanAccesoriosTabla.ts')) continue;
      const nombreArchivo = ruta.split('/').pop()!;
      for (const p of todosLosArchivos) {
        if (p.endsWith(ruta)) continue; // el archivo mismo
        const src = readFileSync(p, 'utf8');
        if (src.includes(nombreArchivo.replace(/\.ts$/, '')) && /from\s+['"][^'"]*'/.test(src)) {
          // Solo cuenta si lo importa por RUTA (no si lo menciona en un comentario).
          if (
            new RegExp(`from\\s+['"][^'"]*${nombreArchivo.replace(/\.ts$/, '')}\\.ts['"]`).test(src)
          ) {
            conImportadores.push(`${ruta} importada por ${REL(p)}`);
          }
        }
      }
    }
    expect(conImportadores).toEqual([]);
  });
});

describe('G3 · sin ciclos de import nuevos', () => {
  it('el grafo de imports relativos no tiene ciclos fuera de los conocidos', () => {
    const aristas = new Map<string, string[]>();
    for (const p of todosLosArchivos) {
      const src = readFileSync(p, 'utf8');
      const dst: string[] = [];
      const re = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const base = resolve(dirname(p), m[1]);
        for (const cand of [
          base + '.ts',
          base + '.tsx',
          join(base, 'index.ts'),
          join(base, 'index.tsx'),
        ])
          if (exists(cand)) {
            dst.push(cand);
            break;
          }
      }
      aristas.set(p, dst);
    }
    const ciclos = new Set<string>();
    const visitar = (n: string, pila: string[], vistas: Set<string>): void => {
      if (pila.includes(n)) {
        // Canónico: los nodos del ciclo ordenados (el mismo ciclo se detecta desde varios
        // puntos de entrada y no debe contar N veces).
        ciclos.add(
          [...pila.slice(pila.indexOf(n))]
            .map((x) => x.split(sep).pop()!)
            .sort()
            .join('|'),
        );
        return;
      }
      if (vistas.has(n)) return;
      vistas.add(n);
      for (const d of aristas.get(n) || []) visitar(d, [...pila, n], vistas);
    };
    for (const p of todosLosArchivos) visitar(p, [], new Set());
    const nuevos = [...ciclos].filter((c) => !CICLOS_CONOCIDOS.includes(c));
    expect(nuevos).toEqual([]);
    expect(ciclos.size).toBeLessThanOrEqual(CICLOS_CONOCIDOS.length);
  });
});

describe('G4 · los módulos de cálculo son puros', () => {
  it('ningún módulo nuevo de cálculo importa React', () => {
    const impure: string[] = [];
    for (const m of MODULOS_NUEVOS) {
      if (!m.puro) continue;
      const p = join(RAIZ, m.ruta);
      if (!exists(p)) continue;
      const src = readFileSync(p, 'utf8');
      if (/from\s+['"]react['"]/.test(src)) impure.push(m.ruta);
    }
    expect(impure).toEqual([]);
  });
});

describe('G5 · cada módulo nuevo tiene test', () => {
  it('los tests importados cubren cada módulo nuevo', () => {
    const sinTest: string[] = [];
    const fuentesTest = listarSrc(RAIZ, [], true).filter((p) => p.includes('.test.'));
    const contenido = fuentesTest.map((p) => readFileSync(p, 'utf8')).join('\n');
    for (const m of MODULOS_NUEVOS) {
      if (!exists(join(RAIZ, m.ruta))) {
        sinTest.push(`${m.ruta}: no existe todavía`);
        continue;
      }
      if (!contenido.includes(m.test))
        sinTest.push(`${m.ruta}: ningún test lo importa (${m.test})`);
    }
    expect(sinTest).toEqual([]);
  });
});

describe('G8 · los focos de complejidad no crecen', () => {
  // El conteo se calcula UNA vez (parsear 600 archivos con el AST de TS cuesta segundos).
  let conteoReal: Record<string, number>;
  // Parsear 600 archivos con el AST de TypeScript tarda ~12 s: el hook necesita margen.
  beforeAll(() => {
    const fuentes: Record<string, string> = {};
    for (const p of todosLosArchivos) fuentes[REL(p)] = readFileSync(p, 'utf8');
    conteoReal = contarFocosPorArchivo(fuentes);
  }, 120_000);

  it('ningún archivo nuevo alcanza 5 focos de búsqueda lineal en bucle', () => {
    const nuevos = Object.entries(conteoReal)
      .filter(([ruta, n]) => n >= 5 && !(ruta in FOCOS_CONOCIDOS))
      .map(([ruta, n]) => `${ruta}: ${n}`);
    expect(nuevos).toEqual([]);
  });

  it('ningún archivo conocido ha crecido', () => {
    const crecidos: string[] = [];
    for (const [ruta, tope] of Object.entries(FOCOS_CONOCIDOS)) {
      const n = conteoReal[ruta] ?? 0;
      if (n > tope) crecidos.push(`${ruta}: ${n} > ${tope}`);
    }
    expect(crecidos).toEqual([]);
  });

  it('el total de focos no sube', () => {
    const total = totalFocos(conteoReal);
    expect(total).toBeLessThanOrEqual(TOTAL_FOCOS_BASE);
  });

  it('el baseline no quedó viejo: si el código tiene menos focos, hay que bajar el número', () => {
    // Anti-congelación: arreglar un archivo sin actualizar la lista deja el guard mintiendo
    // sobre el estado real. Esta regla obliga a bajar el baseline en el mismo commit.
    const viejos: string[] = [];
    for (const [ruta, tope] of Object.entries(FOCOS_CONOCIDOS)) {
      const n = conteoReal[ruta] ?? 0;
      if (n < tope) viejos.push(`${ruta}: el código tiene ${n}, el baseline dice ${tope}`);
    }
    expect(viejos).toEqual([]);
  });
});

describe('manifest de módulos nuevos', () => {
  it('los módulos declarados respetan su propio tope de líneas', () => {
    const excedidos: string[] = [];
    for (const m of MODULOS_NUEVOS) {
      const p = join(RAIZ, m.ruta);
      if (!exists(p)) continue;
      const n = lineasDe(p);
      const tope = m.puro ? Math.min(m.maxLineas, TOPE_PURO) : Math.min(m.maxLineas, TOPE_HOOK);
      if (n > tope) excedidos.push(`${m.ruta}: ${n} > ${tope}`);
    }
    expect(excedidos).toEqual([]);
  });
});

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}
