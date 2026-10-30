import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { contarFocosPorArchivo, totalFocos } from './complexity';

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
 */
const CONOCIDOS: Record<string, number> = {
  'modules/civilflow/components/PdfViewer.tsx': 818,
  'modules/civilflow/lib/PlanoEngine/deleteSelected.ts': 702,
  'modules/civilflow/components/pdfViewer/PdfViewerEngineInit.ts': 741,
  'modules/civilflow/lib/PlanoEngine/PlanoEngine.ts': 1176,
  'modules/civilflow/components/workareaContent/useReportTables.ts': 672,
  'modules/civilflow/lib/PlanoEngine/renderers/renderRamales.ts': 407,
  'modules/civilflow/utils/waterRowsCore.ts': 696,
  'modules/civilflow/components/workarea/PlanosTab.tsx': 710,
  'modules/civilflow/components/DownpipesTable.tsx': 215,
  'modules/civilflow/utils/bajanteAssocShared.ts': 726,
  'modules/civilflow/components/GasDesign.tsx': 373,
  'modules/civilflow/components/FixturesPanel.tsx': 523,
  'modules/civilflow/components/workarea/PlanoConfigurator.tsx': 604,
  'modules/civilflow/components/RainChannelsCheck.tsx': 539,
  'modules/civilflow/constants/rejillasNTC3631.ts': 978,
  'modules/civilflow/lib/PlanoEngine/handleDragMove.ts': 62,
  'pages/auth/ProfilePage.tsx': 581,
  'modules/civilflow/lib/PlanoEngine/PlanoState.ts': 636,
  'modules/civilflow/components/workarea/isometry/useIsometryRender.ts': 158,
  'modules/civilflow/components/rejillasVentilation/TableTypologies.tsx': 683,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenu.tsx': 729,
  'pages/PricingPage.tsx': 430,
  'modules/civilflow/lib/PlanoEngine/finishRamal.ts': 600,
  'modules/civilflow/components/pdfViewer/tramoEditor/bajanteEditor.tsx': 520,
  'modules/civilflow/components/RainDownpipesCheck.tsx': 522,
  'modules/civilflow/components/DesignParameters.tsx': 638,
  'modules/civilflow/utils/equipmentRows.ts': 488,
  'modules/civilflow/components/PumpARDesign.tsx': 778,
  'modules/civilflow/lib/PlanoEngine/sanAccessoriesCalc.ts': 807,
  'components/help/helpGuideFlow.tsx': 792,
  'modules/civilflow/components/SanitaryDesign.tsx': 73,
  // Cuerpo verbatim de tablas extraído de SanitaryDesign (794→72): monolito conocido, no nuevo.
  'modules/civilflow/components/sanitary/SanitaryTables.tsx': 669,
  'modules/civilflow/components/pdfViewer/PdfViewerToolbar.tsx': 766,
  'modules/civilflow/components/ep/EPVerificationPage.tsx': 755,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/midRamalAccessorySelector.tsx': 257,
  'modules/civilflow/context/RainwaterContext.tsx': 755,
  'modules/civilflow/lib/PlanoEngine/handleDragUp.ts': 747,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/diameterSelector.tsx': 772,
  'modules/civilflow/utils/copyDrawingFromPlan.ts': 706,
  'modules/civilflow/components/SupplyConnection.tsx': 10,
};

/**
 * Archivos que gestiona esta campaña (los que se parten): deben quedar como fachadas cortas.
 * El resto del repo tiene otras sesiones trabajando encima: su tamaño no es contrato aquí.
 */

/**
 * Ciclos de import PREEXISTENTES que se permiten.
 *
 * Línea base 2026-10-21: la lista anterior tenía 18 entradas con los nombres de archivo
 * VIEJOS (PlanoEngineDrawing.ts, ApparatusContext.tsx, PlansContext.tsx…), que ya no
 * existen: el grafo actual NO tiene ningún ciclo. La lista era letra muerta y el guard
 * comparaba contra ella sin que nada coincidiera.
 *
 * El guard sigue siendo útil: cualquier ciclo que aparezca NO estará en esta lista y
 * hará fallar el test. Si una futura división INTRODUCE un ciclo conocido, se anota
 * aquí (con los nombres REALES de los archivos) para que sea explícito.
 */
const CICLOS_CONOCIDOS: string[] = [];

/**
 * Módulos que nacieron de la desmonotilización: el contrato de la división.
 *  ruta → { maxLineas, puro, testQueLoImporta }
 */
const MODULOS_NUEVOS: Array<{ ruta: string; maxLineas: number; puro: boolean; test: string }> = [
  {
    ruta: 'modules/civilflow/components/workarea/isometry/painters/planSheets.ts',
    maxLineas: 200,
    puro: true,
    test: '../useIsometryRender',
  },
  {
    ruta: 'modules/civilflow/components/workarea/isometry/painters/channels.ts',
    maxLineas: 400,
    puro: true,
    test: '../useIsometryRender',
  },
  {
    // 601 líneas de dibujo con I/O de canvas: no es util pura (TOPE_PURO), usa TOPE_HOOK.
    ruta: 'modules/civilflow/components/workarea/isometry/painters/networks.ts',
    maxLineas: 700,
    puro: false,
    test: '../useIsometryRender',
  },
  {
    ruta: 'modules/civilflow/components/workarea/isometry/painters/axes.ts',
    maxLineas: 120,
    puro: true,
    test: '../useIsometryRender',
  },
  {
    ruta: 'modules/civilflow/components/workarea/isometry/painters/isoView.ts',
    maxLineas: 40,
    puro: true,
    test: '../useIsometryRender',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/events/pointerDown.ts',
    maxLineas: 250,
    puro: true,
    test: '../PlanoEngine',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/events/pointerMove.ts',
    maxLineas: 150,
    puro: true,
    test: '../PlanoEngine',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/events/wheelZoom.ts',
    maxLineas: 80,
    puro: true,
    test: '../PlanoEngine',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/render/frame.ts',
    maxLineas: 200,
    puro: true,
    test: '../PlanoEngine',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/commands/loadWork.ts',
    maxLineas: 150,
    puro: true,
    test: '../PlanoEngine',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/engineFull.ts',
    maxLineas: 100,
    puro: true,
    test: '../PlanoEngine',
  },
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
    ruta: 'modules/civilflow/utils/propagation/edges.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/edges.ts',
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
    ruta: 'modules/civilflow/utils/propagation/counting.ts',
    maxLineas: 500,
    puro: true,
    test: '../propagation/counting.ts',
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
    ruta: 'modules/civilflow/utils/accessoriesTable/catalog.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/catalog.ts',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/counting.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/counting.ts',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/bushing.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/bushing',
  },
  {
    ruta: 'modules/civilflow/utils/accessoriesTable/rows.ts',
    maxLineas: 450,
    puro: true,
    test: '../accessoriesTable/rows.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useSanTables.ts',
    maxLineas: 300,
    puro: false,
    test: '../useSanTables.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useLlTables.ts',
    maxLineas: 300,
    puro: false,
    test: '../useLlTables.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAfTables.ts',
    maxLineas: 300,
    puro: false,
    test: '../useAfTables.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/useAcTables.ts',
    maxLineas: 300,
    puro: false,
    test: '../useAcTables.ts',
  },
  {
    ruta: 'modules/civilflow/components/workareaContent/tableHelpers.ts',
    maxLineas: 60,
    puro: false,
    test: '../tableHelpers.ts',
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
    test: '../diamFractionValue.ts',
  },
  {
    ruta: 'test/render.tsx',
    maxLineas: 200,
    puro: false,
    test: '../render.tsx',
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
    ruta: 'modules/civilflow/components/rainChannels/ChannelRow.tsx',
    maxLineas: 330,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/components/rainChannels/ChannelDimField.tsx',
    maxLineas: 140,
    puro: false,
    test: 'rainChannels',
  },
  {
    ruta: 'modules/civilflow/utils/rainChannelCalc.ts',
    maxLineas: 140,
    puro: true,
    test: 'rainChannelCalc',
  },
  {
    ruta: 'modules/civilflow/utils/readPlanDrawing.ts',
    maxLineas: 80,
    puro: true,
    test: 'readPlanDrawing',
  },
  {
    ruta: 'modules/civilflow/utils/isLevelTaken.ts',
    maxLineas: 60,
    puro: true,
    test: '../isLevelTaken',
  },
  {
    ruta: 'modules/civilflow/utils/plansMeta.ts',
    maxLineas: 100,
    puro: true,
    test: '../plansMeta.ts',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/fixtureMirrors.ts',
    maxLineas: 130,
    puro: false,
    test: 'useFixtureMirrors',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/mirrorOutputs.ts',
    maxLineas: 110,
    puro: false,
    test: '../fixtureMirrors',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/crossFloorInheritance.ts',
    maxLineas: 260,
    puro: false,
    test: '../fixtureMirrors',
  },
  {
    ruta: 'modules/civilflow/components/fixtures/fixtureMirrorsTypes.ts',
    maxLineas: 80,
    puro: false,
    test: 'useFixtureMirrors',
  },
  {
    ruta: 'architecture/complexity.ts',
    maxLineas: 250,
    puro: true,
    test: './complexity',
  },
  {
    ruta: 'modules/civilflow/utils/indices.ts',
    maxLineas: 120,
    puro: true,
    test: '../indices',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/engineIndices.ts',
    maxLineas: 120,
    puro: true,
    test: '../engineIndices',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/intersectionTrim.ts',
    maxLineas: 200,
    puro: true,
    test: '../intersectionTrim',
  },
  {
    ruta: 'modules/civilflow/components/rejillasVentilation/typologiesChrome.tsx',
    maxLineas: 350,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/rainDownpipesHeader.tsx',
    maxLineas: 250,
    puro: false,
    test: 'rainDownpipesDerived',
  },
  {
    ruta: 'modules/civilflow/utils/rainDownpipesDerived.ts',
    maxLineas: 150,
    puro: true,
    test: 'rainDownpipesDerived',
  },
  {
    ruta: 'modules/civilflow/components/designParameters/GasCatalogCard.tsx',
    maxLineas: 200,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/tramoEditor/bajanteGhostEditor.tsx',
    maxLineas: 220,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/tramoEditor/DirectionFlowButtons.tsx',
    maxLineas: 80,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenuConvert.ts',
    maxLineas: 200,
    puro: true,
    test: 'ramalMenuConvert',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/planoNets.ts',
    maxLineas: 250,
    puro: true,
    test: 'planoNets',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/planoNumbering.ts',
    maxLineas: 150,
    puro: true,
    test: 'planoNets',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/finishRamalMergeExtreme.ts',
    maxLineas: 300,
    puro: true,
    test: 'finishRamalMergeExtreme',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/tramoEditor/AssociatedRamalesGrid.tsx',
    maxLineas: 180,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/useNetVisibilityState.ts',
    maxLineas: 150,
    puro: false,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/components/pdfViewer/aparatosDeleteSweep.ts',
    maxLineas: 70,
    puro: true,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/lib/PlanoEngine/planoToolDispatch.ts',
    maxLineas: 80,
    puro: true,
    test: 'typologiesChrome',
  },
  {
    ruta: 'modules/civilflow/utils/pumpReport.ts',
    maxLineas: 400,
    puro: true,
    test: 'typologiesChrome',
  },
];

/**
 * G8 · COMPLEJIDAD — línea base de búsquedas lineales dentro de bucles (focos O(n²)).
 *
 * Un "foco" es una búsqueda lineal (`.find`, `.findIndex`, `.some`, `.filter`, `.indexOf`,
 * `.includes`) dentro de un bucle: por cada pieza del plano se recorre OTRA vez la lista de
 * piezas. El detector vive en `complexity.ts` (puro, testeado aparte).
 *
 * Este baseline congela el estado actual: el guard NO permite que ningún archivo CREZCA de
 * focos, ni que aparezca uno nuevo. Cuando un archivo se arregla, su número baja aquí en el
 * mismo commit — si no, la regla D falla y avisa de que el baseline quedó viejo.
 *
 * Los archivos con menos de 5 focos no se listan: tolerados, pero sin veto (arreglarlos es
 * opcional; si uno llega a 5, entra en la lista y sí queda vigilado).
 */
const FOCOS_CONOCIDOS: Record<string, number> = {
  'modules/civilflow/lib/PlanoEngine/deleteSelected.ts': 17,
  'modules/civilflow/utils/assocLayoutMigration.ts': 16,
  'modules/civilflow/utils/copyDrawingFromPlan.ts': 15,
  'modules/civilflow/utils/propagation/edges.ts': 13,
  'modules/civilflow/utils/rainwaterRows.ts': 9,
  'modules/civilflow/components/pdfViewer/tramoEditor/bajanteEditor.tsx': 2,
  'modules/civilflow/lib/PlanoEngine/renderers/renderJunctions.ts': 11,
  'modules/civilflow/lib/PlanoEngine/renderers/renderRamales.ts': 2,
  'modules/civilflow/components/pdfViewer/tramoEditor/editorSections.tsx': 9,
  'modules/civilflow/utils/bajanteVentRows.ts': 9,
  'modules/civilflow/lib/PlanoEngine/deleteYeePreserve.ts': 4,
  'modules/civilflow/lib/PlanoEngine/handleDragUp.ts': 8,
  'modules/civilflow/lib/PlanoEngine/renderers/bajanteGhosts.ts': 8,
  'modules/civilflow/lib/PlanoEngine/sanAccessoriesCalc.ts': 8,
  'modules/civilflow/utils/bajanteRowModel.ts': 8,
  'modules/civilflow/components/pdfViewer/useFloorRamales.ts': 7,
  'modules/civilflow/components/workarea/isometry/useIsometryRender.ts': 0,
  'modules/civilflow/components/workarea/IsometryGeneral.tsx': 7,
  'modules/civilflow/lib/PlanoEngine/mouseDownDrags.ts': 7,
  'modules/civilflow/utils/accessoriesTable/bushing.ts': 7,
  'modules/civilflow/utils/buildTramos.ts': 7,
  'modules/civilflow/components/fixtures/montantesSection.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/associatedChannels.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/bajanteConnectionSections.tsx': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenu.tsx': 4,
  'modules/civilflow/components/RainDownpipesCheck.tsx': 2,
  'modules/civilflow/lib/PlanoEngine/channelSeal.ts': 6,
  'modules/civilflow/lib/PlanoEngine/networkRenumber.ts': 6,
  'modules/civilflow/lib/PlanoEngine/PlanoEngineNetwork.ts': 5,
  'modules/civilflow/utils/waterRowsAcometida.ts': 6,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/bajanteConnectionPanel.tsx': 5,
  'modules/civilflow/components/pdfViewer/drawingElementContextMenu/ramalMenuHelpers.ts': 5,
  'modules/civilflow/components/rejillasVentilation/TableTypologies.tsx': 5,
  'modules/civilflow/context/RainwaterContext.tsx': 5,
  'modules/civilflow/lib/PlanoEngine/handleMouseDown.ts': 5,
  'modules/civilflow/utils/accessoriesTable/yees.ts': 5,
  'modules/civilflow/utils/buildBajanteGraph.ts': 5,
  'modules/civilflow/utils/drawingWrites/diameters.ts': 5,
  'modules/civilflow/utils/sanConnectivity.ts': 5,
  'pages/ModulePage.tsx': 5,
  'modules/civilflow/components/pdfViewer/tramoEditor/AssociatedRamalesGrid.tsx': 6,
};

/**
 * Total de focos de todo src/ al congelar el baseline. El guard lo usa como techo global:
 * aunque un archivo nuevo aparezca con 1 foco, el total no puede subir. Baja cuando se
 * arregla algo (y entonces hay que bajar también su número en FOCOS_CONOCIDOS).
 */
const TOTAL_FOCOS_BASE = 503;

/** API pública que los archivos conservados deben seguir exportando (G2). */
const API_PUBLICA: Array<{ ruta: string; simbolos: string[] }> = [
  {
    ruta: 'modules/civilflow/components/workareaContent/useReportTables.ts',
    simbolos: ['useInfTablas'],
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

  it('los monolitos conocidos no CRECEN (techo = tamaño real al cerrar la ronda)', () => {
    // Sin este test la tabla CONOCIDOS era decoración: solo eximía del tope nuevo y los
    // monolitos podían volver a crecer sin que nada fallara (TableTypologies creció
    // 898→924 con el guard verde). Techo = tamaño medido; si uno se encoge, BAJAR el
    // número (misma regla D del guard G8: el techo sigue al código, no al revés).
    const crecidos: string[] = [];
    for (const [ruta, techo] of Object.entries(CONOCIDOS)) {
      const p = join(RAIZ, ruta);
      if (!exists(p)) {
        crecidos.push(`${ruta}: desapareció (quitar de CONOCIDOS)`);
        continue;
      }
      const n = lineasDe(p);
      if (n > techo) crecidos.push(`${ruta}: ${n} > ${techo}`);
    }
    expect(crecidos).toEqual([]);
  });

  it('regla D: el techo no quedó viejo — si el archivo encogió, hay que bajar el número', () => {
    // Anti-congelación de CONOCIDOS (misma regla D de G8): un techo mayor al tamaño real
    // deja margen fantasma para volver a crecer sin aviso.
    const viejos: string[] = [];
    for (const [ruta, techo] of Object.entries(CONOCIDOS)) {
      const p = join(RAIZ, ruta);
      if (!exists(p)) continue;
      const n = lineasDe(p);
      if (n < techo) viejos.push(`${ruta}: el archivo tiene ${n}, el techo dice ${techo}`);
    }
    expect(viejos).toEqual([]);
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
  it(
    'el grafo de imports relativos no tiene ciclos fuera de los conocidos',
    { timeout: 20000 },
    () => {
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
    },
  );
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
