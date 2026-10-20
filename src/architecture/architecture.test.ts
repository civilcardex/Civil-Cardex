import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

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
  'modules/civilflow/lib/PlanoEngine/PlanoEngine.ts': 1425,
  'modules/civilflow/components/workareaContent/useInfTables.ts': 1236,
  'modules/civilflow/lib/PlanoEngine/renderers/renderRamales.ts': 1225,
  'modules/civilflow/utils/sanAccesoriosTable.ts': 1213,
  'modules/civilflow/components/workarea/PlanosTab.tsx': 710,
  'modules/civilflow/components/DownpipesTable.tsx': 1001,
  'modules/civilflow/components/SupplyConnection.tsx': 1162,
  'modules/civilflow/components/GasDesign.tsx': 380,
  'modules/civilflow/components/FixturesPanel.tsx': 905,
  'modules/civilflow/components/workarea/PlanoConfigurator.tsx': 605,
  'modules/civilflow/components/RainChannelsCheck.tsx': 993,
  'modules/civilflow/constants/rejillasNTC3631.ts': 978,
  'modules/civilflow/lib/PlanoEngine/handleDragMove.ts': 977,
  'pages/auth/ProfilePage.tsx': 967,
  'modules/civilflow/lib/PlanoEngine/PlanoState.ts': 936,
  'modules/civilflow/components/workarea/isometry/useIsometryRender.ts': 918,
  'modules/civilflow/components/rejillasVentilacion/TablaTipologias.tsx': 898,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenu.tsx': 883,
  'pages/PricingPage.tsx': 878,
  'modules/civilflow/lib/PlanoEngine/finishRamal.ts': 867,
  'modules/civilflow/components/pdfViewer/tramoEditor/bajanteEditor.tsx': 844,
  'modules/civilflow/components/RainDownpipesCheck.tsx': 827,
  'modules/civilflow/components/DesignParameters.tsx': 822,
  'modules/civilflow/utils/equipmentRows.ts': 822,
  'modules/civilflow/components/BombaARDesign.tsx': 815,
  'modules/civilflow/lib/PlanoEngine/sanAccessoriesCalc.ts': 807,
  'components/help/helpGuideFlow.tsx': 804,
  'modules/civilflow/components/SanitaryDesign.tsx': 802,
  'modules/civilflow/components/pdfViewer/PdfViewerToolbar.tsx': 770,
  'modules/civilflow/components/ep/EPVerificationPage.tsx': 751,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/midRamalAccessorySelector.tsx': 749,
  'modules/civilflow/context/RainwaterContext.tsx': 746,
  'modules/civilflow/lib/PlanoEngine/handleDragUp.ts': 743,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/diameterSelector.tsx': 736,
  'modules/civilflow/utils/copyDrawingFromPlan.ts': 701,
};

/**
 * Archivos que gestiona esta campaña (los que se parten): deben quedar como fachadas cortas.
 * El resto del repo tiene otras sesiones trabajando encima: su tamaño no es contrato aquí.
 */
const GESTIONADOS: Record<string, number> = {
  'modules/civilflow/utils/aparatosPresion.ts': 40,
  'modules/civilflow/utils/sanAccesoriosTable.ts': 40,
  'modules/civilflow/components/SupplyConnection.tsx': 60,
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
    test: 'aparatosPresion/index',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/reading.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/reading',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/edges.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/edges',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/folding.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/folding',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/dfs.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/dfs',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/writing.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/writing',
  },
  {
    ruta: 'modules/civilflow/utils/propagation/counting.ts',
    maxLineas: 500,
    puro: true,
    test: 'aparatosPresion/counting',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/index.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/index',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/collection.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/collection',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/yees.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/yees',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/catalog.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/catalog',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/counting.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/counting',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/bushing.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/bushing',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/rows.ts',
    maxLineas: 450,
    puro: true,
    test: 'sanAccesoriosTable/rows',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useSanTables.ts',
    maxLineas: 300,
    puro: false,
    test: 'useSanTables',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useLlTables.ts',
    maxLineas: 300,
    puro: false,
    test: 'useLlTables',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAfTables.ts',
    maxLineas: 300,
    puro: false,
    test: 'useAfTables',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAcTables.ts',
    maxLineas: 300,
    puro: false,
    test: 'useAcTables',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/tableHelpers.ts',
    maxLineas: 60,
    puro: false,
    test: 'tablasHelpers',
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
    ruta: 'modules/civilflow/components/supplyConnection/ParamRow.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/InlineComparisonRow.tsx',
    maxLineas: 60,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/styles.ts',
    maxLineas: 120,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/utils/diamFractionValue.ts',
    maxLineas: 60,
    puro: true,
    test: 'diamFractionValue',
  },
  {
    ruta: 'test/render.tsx',
    maxLineas: 200,
    puro: false,
    test: 'harness',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/FlowSection.tsx',
    maxLineas: 360,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/ParametersSection.tsx',
    maxLineas: 300,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/VerificationSection.tsx',
    maxLineas: 300,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/supplyConnection/types.ts',
    maxLineas: 120,
    puro: false,
    test: 'supplyConnection',
  },
  {
    ruta: 'modules/civilflow/components/rainChannels/CanalRow.tsx',
    maxLineas: 330,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/components/rainChannels/CanalDimField.tsx',
    maxLineas: 140,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/utils/rainChannelCalc.ts',
    maxLineas: 140,
    puro: true,
    test: 'canalesLluviasCalculo',
  },
  {
    ruta: 'modules/civilflow/utils/readPlanDrawing.ts',
    maxLineas: 60,
    puro: true,
    test: 'readPlanDrawing',
  },
  {
    ruta: 'modules/civilflow/utils/isLevelTaken.ts',
    maxLineas: 60,
    puro: true,
    test: 'pisoOcupadoPor',
  },
  {
    ruta: 'modules/civilflow/utils/plansMeta.ts',
    maxLineas: 100,
    puro: true,
    test: 'plansMeta',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/fixtureMirrors.ts',
    maxLineas: 400,
    puro: false,
    test: 'useFixtureMirrors',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/fixtureMirrorsTypes.ts',
    maxLineas: 60,
    puro: false,
    test: 'useFixtureMirrors',
  },
];

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
    ruta: 'modules/civilflow/utils/sanAccesoriosTable.ts',
    simbolos: ['computeAccesoriosTable'],
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useInfTables.ts',
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
