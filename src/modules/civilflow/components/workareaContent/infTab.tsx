import { useMemo, useState } from 'react';
import {
  generateMemoriaExcel,
  generateMemoriaDocx,
  generateMemoriaPdf,
  type MemoriaTable,
  type MemoriaData,
} from '../../utils/exportMemoriaFinal';
import { pisoLbl, pisoCorto, SAN_UC_IDS, APARATOS_DEF } from '../../constants';
import { useRainwater } from '../../context/RainwaterContext';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../constants/hydraulicData';
import { lookupInterno, lookupInternoAC } from '../../utils/accesoriosUtils';
import { buildSanConnectivity, computeSanRows, computeUdTable } from '../../utils/sanitaryRows';
import {
  buildLlBajanteAssociations,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../../utils/rainwaterRows';
import { computeWaterNetworkRows, computeAcometidaSummary } from '../../utils/waterNetworkRows';
import { computeBombaTables, computeEpTables } from '../../utils/equiposRows';
import { computeGasRows } from '../../utils/gasRows';
import { computeUcTable } from '../../utils/ucRows';
import { computeBajanteVentTable } from '../../utils/bajanteVentRows';
import { computeAccesoriosTable } from '../../utils/sanAccesoriosRows';
import { computeAccesoriosPorRamalTable } from '../../utils/accesoriosPorRamalRows';
import { computeRainDownpipesTable } from '../../utils/rainDownpipesRows';
import { chequeoCanalLluvia } from '../../utils/calcRainwater';
import { computeHeaterSelectionTables } from '../../utils/heaterSelectionRows';
import { computeResumenTuberiasTable } from '../../utils/resumenTuberiasRows';
import { getPdfjs } from '../../utils/lazyPdfjs';
import { downloadPlanosPdf } from '../../utils/exportPlanos';
import type { useWorkAreaState } from '../useWorkAreaState';

const ANEXO_PDF_URL = '/docs/detalle-instalacion-aparatos-hsg.pdf';
// Altura, en puntos PDF (espacio de página, independiente de la escala de renderizado), del
// rótulo inferior (PROYECTO/CONTIENE/OBSERVACIONES/FECHA/PLANO No) de la hoja de origen. Medida
// directamente sobre ese activo fijo: el bloque del rótulo va de ~174pt sobre el borde inferior
// hasta el borde inferior en una página de 1701×2551pt, con un margen vacío grande encima —
// seguro recortar con una constante en vez de buscarlo por texto (la fuente embebida de este PDF
// tiene el mapa de glifos roto, así que el texto extraído como "PROYECTO" sale corrupto como
// "PRO<ECTO" y no se puede buscar de forma fiable; además, palabras como "ESCALA" se reutilizan
// en otras partes del dibujo).
const ANEXO_ROTULO_HEIGHT_PT = 185;

async function downloadAnexoPdf(): Promise<void> {
  const r = await fetch(ANEXO_PDF_URL);
  if (!r.ok) throw new Error('No se encontró el anexo.');
  const buf = await r.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);

  const baseVp = page.getViewport({ scale: 1 });
  const targetLongSide = 2200;
  const scale = Math.min(2.5, targetLongSide / Math.max(baseVp.width, baseVp.height));
  const vp = page.getViewport({ scale });

  const cropY = Math.max(1, Math.round(vp.height - ANEXO_ROTULO_HEIGHT_PT * scale));

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.floor(vp.width);
  fullCanvas.height = Math.floor(vp.height);
  await page.render({ canvas: fullCanvas, viewport: vp }).promise;

  const cropH = cropY < fullCanvas.height ? cropY : fullCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = fullCanvas.width;
  outCanvas.height = cropH;
  const ctx = outCanvas.getContext('2d');
  if (ctx) ctx.drawImage(fullCanvas, 0, 0);

  const dataUrl = outCanvas.toDataURL('image/png');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: outCanvas.width >= outCanvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [outCanvas.width, outCanvas.height],
  });
  doc.addImage(dataUrl, 'PNG', 0, 0, outCanvas.width, outCanvas.height);
  doc.save('Detalle instalacion aparatos.pdf');
}

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

const SUMMARY_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'baseline',
  padding: '6px 10px',
  background: 'var(--bg3)',
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  marginBottom: 4,
};
const DL_CHIP_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 2px',
  borderBottom: '1px solid var(--line)',
  flexWrap: 'wrap',
};
const DL_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--txt)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 130,
};
const DL_BTN_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: '7px 16px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  background: 'var(--bg2)',
  color: 'var(--txt)',
  fontSize: 13,
  fontWeight: 700,
  transition: 'filter .15s',
};

export function InfTab({ state }: { state: WorkAreaState }) {
  const [memoriaFmt, setMemoriaFmt] = useState<'xlsx' | 'docx' | 'pdf'>('xlsx');
  const [memoriaBusy, setMemoriaBusy] = useState(false);
  const [anexoBusy, setAnexoBusy] = useState(false);
  const [planosBusy, setPlanosBusy] = useState(false);
  const {
    proy,
    redesActivas,
    pisos,
    tramosSan,
    tramosLl,
    tramosAf,
    tramosAc,
    plans,
    aps,
    udBase,
    confirmedPlanos,
  } = state;
  const { bajantesLl, canalesLl, conRecolectora } = useRainwater();
  const okSAN =
    tramosSan.length > 0 &&
    tramosSan.every((t) => {
      const v = t.v_real || 0;
      const y = t.yD || 0;
      const q = t.qQ0 || 0;
      return v >= 0.45 && v <= 4.0 && y <= 0.75 && q <= 1.0;
    });
  const okLL =
    tramosLl.length > 0 &&
    tramosLl.every((t) => {
      const v = t.v_real || 0;
      const y = t.yD || 0;
      const q = t.qQ0 || 0;
      return v >= 0.45 && v <= 4.0 && y <= 0.75 && q <= 1.0;
    });
  const okAF =
    tramosAf.length > 0 && tramosAf.every((t) => t.velCumple !== false && t.presionOk !== false);
  const okAC = tramosAc.length > 0 && tramosAc.every((t) => t.velCumple !== false);
  const hasSan = redesActivas.some((r) => r.id === 'san');
  const hasLl = redesActivas.some((r) => r.id === 'll');
  const hasAf = redesActivas.some((r) => r.id === 'af');
  const hasAc = redesActivas.some((r) => r.id === 'ac');
  const hasGas = redesActivas.some((r) => r.id === 'gas');
  const hasBom = redesActivas.some((r) => r.id === 'bom');
  const hasEp = redesActivas.some((r) => r.id === 'ep');
  const hasCheckedNet = hasSan || hasLl || hasAf || hasAc;
  const allOk =
    hasCheckedNet && (!hasSan || okSAN) && (!hasLl || okLL) && (!hasAf || okAF) && (!hasAc || okAC);
  const items = useMemo<[string, string][]>(() => {
    const rows: [string, string][] = [
      ['PROYECTO', proy.nombre],
      ['DIRECCIÓN', proy.dir || '—'],
      ['USO', proy.uso],
      ['REDES', redesActivas.map((r) => r.lbl).join(' · ')],
      [
        'NIVELES',
        pisos
          .toSorted((a, b) => a.n - b.n)
          .map((p) => pisoLbl(p.n))
          .join(' · '),
      ],
    ];
    if (hasSan) rows.push(['SANITARIA', okSAN ? '✓ OK' : '✗ Revisar']);
    if (hasLl) rows.push(['AGUAS LLUVIAS', okLL ? '✓ OK' : '✗ Revisar']);
    if (hasAf) rows.push(['AGUA FRÍA', okAF ? '✓ OK' : '✗ Revisar']);
    if (hasAc) rows.push(['AGUA CALIENTE', okAC ? '✓ OK' : '✗ Revisar']);
    return rows;
  }, [proy, redesActivas, pisos, okSAN, okLL, okAF, okAC, hasSan, hasLl, hasAf, hasAc]);

  const estadoLabel = !hasCheckedNet
    ? '—'
    : allOk
      ? '✓ Listo para descargar'
      : '✗ Revisar redes con errores';
  const estadoColor = !hasCheckedNet ? 'var(--txt3)' : allOk ? 'var(--ok)' : 'var(--err)';

  const f2 = (n: number) => (n > 0 ? n.toFixed(2) : '—');

  // ── SAN ──
  const sanMergedBase = useMemo(
    () =>
      SAN_UC_IDS.map((id) => {
        const fromAps = aps.find((p) => p.id === id);
        const def = APARATOS_DEF.find((d) => d.id === id);
        return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
      }),
    [aps],
  );

  const ucSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeUdTable(tramosSan, plans, sanMergedBase);
  }, [hasSan, tramosSan, plans, sanMergedBase]);

  const bajVentSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeBajanteVentTable(tramosSan, plans, udBase, pisos);
  }, [hasSan, tramosSan, plans, udBase, pisos]);

  const sanAccTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeAccesoriosTable('san', tramosSan, plans);
  }, [hasSan, tramosSan, plans]);

  const tuberiasSanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    return computeResumenTuberiasTable('san', plans);
  }, [hasSan, plans]);

  const tuberiasLlTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    return computeResumenTuberiasTable('ll', plans);
  }, [hasLl, plans]);

  const tuberiasAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeResumenTuberiasTable('af', plans);
  }, [hasAf, plans]);

  const tuberiasAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeResumenTuberiasTable('ac', plans);
  }, [hasAc, plans]);

  const sanTable = useMemo<MemoriaTable | null>(() => {
    if (!hasSan) return null;
    const mergedBase = sanMergedBase;
    const displayTramos = tramosSan.filter((t) => t.tipo === 'ramal' && !t.esBajante);
    const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);
    const rows = computeSanRows(displayTramos, componentTotalMap, mergedBase);
    return {
      title: 'Diseño de red sanitaria',
      headerGroups: [
        'Tramo',
        'Nivel',
        { label: 'Unidades de descarga', span: 3 },
        'No. Descargas',
        'K',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        { label: 'Diámetro', span: 3 },
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'Velocidad real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        { label: 'Fuerza Tractiva', span: 2 },
      ],
      headers: [
        'Tramo',
        'Nivel',
        'Propia',
        'Otros',
        'Total',
        'No. Descargas',
        'K',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        'Calculado (")',
        'Diseño (")',
        'Interior (mm)',
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'Velocidad real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        'Real (kg/m²)',
        '>0.15',
      ],
      rows: rows.map((r) => [
        r.id,
        pisoCorto(r.piso),
        r.udPropias,
        Math.max(0, r.udAcum - r.udPropias),
        r.udAcum,
        r.nSalidas || '—',
        r.K != null ? r.K.toFixed(2) : '—',
        r.Q != null && r.Q > 0 ? r.Q.toFixed(2) : '—',
        r.n > 0 ? r.n.toFixed(3) : '—',
        r.sVal > 0 ? r.sVal : '—',
        r.DcalcPulg > 0 ? r.DcalcPulg.toFixed(2) : '—',
        r.DdisPulg > 0 ? r.DdisPulg : '—',
        r.DintMm > 0 ? r.DintMm : '—',
        f2(r.Qo),
        f2(r.Vo),
        f2(r.qqo),
        f2(r.Vreal),
        r.chequeoV,
        f2(r.Yc),
        f2(r.Yn),
        f2(r.Froude),
        r.tipoFlujo,
        f2(r.Ymax),
        r.chequeoYn,
        f2(r.fuerzaTractiva),
        r.chequeoFT,
      ]),
    };
  }, [hasSan, tramosSan, plans, sanMergedBase]);

  // ── LL ──
  const llTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    const tribIds = getTributarioIds(tramosLl);
    const displayTramos = tramosLl.filter(
      (t) => t._key != null && !t.esBajante && !tribIds.has(t._key) && !tribIds.has(t.id),
    );
    const associations = buildLlBajanteAssociations(tramosLl, plans);
    const qMap = computeLlQMap(tramosLl, plans, bajantesLl, associations);
    const rows = computeLlRows(displayTramos, qMap, associations);
    return {
      title: 'Diseño de red aguas lluvias',
      headerGroups: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Fin',
        'Bajantes asociados',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        { label: 'Diámetro', span: 3 },
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'V. real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        { label: 'Fuerza Tractiva', span: 2 },
      ],
      headers: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Fin',
        'Bajantes asociados',
        'Caudal (LPS)',
        'Manning',
        'Pendiente (%)',
        'Calculado (")',
        'Diseño (")',
        'Interior (mm)',
        'Qo (LPS)',
        'Vo (m/s)',
        'Q/Qo',
        'V. real (m/s)',
        'Chequeo velocidad',
        'Yc (mm)',
        'Yn (mm)',
        'Froude',
        'Flujo',
        'Ymax (mm)',
        'Yn vs Yc',
        'Real (kg/m²)',
        '>0.15',
      ],
      rows: rows.map((r) => [
        r.id,
        r.piso ? pisoCorto(r.piso) : '—',
        r.desde || '—',
        r.hasta || '—',
        r.bajantesAsociadas.join(', ') || '—',
        r.Q > 0 ? r.Q.toFixed(2) : '—',
        r.n > 0 ? r.n.toFixed(3) : '—',
        r.sVal > 0 ? r.sVal : '—',
        r.DcalcPulg > 0 ? r.DcalcPulg.toFixed(2) : '—',
        r.DdisPulg > 0 ? r.DdisPulg : '—',
        r.DintMm > 0 ? r.DintMm : '—',
        f2(r.Qo),
        f2(r.Vo),
        f2(r.qqo),
        f2(r.Vreal),
        r.chequeoV,
        f2(r.Yc),
        f2(r.Yn),
        f2(r.Froude),
        r.tipoFlujo,
        f2(r.Ymax),
        r.chequeoYn,
        f2(r.fuerzaTractiva),
        r.chequeoFT,
      ]),
    };
  }, [hasLl, tramosLl, plans, bajantesLl]);

  const llBajTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl) return null;
    return computeRainDownpipesTable(tramosLl, plans, bajantesLl);
  }, [hasLl, tramosLl, plans, bajantesLl]);

  const llCanalTable = useMemo<MemoriaTable | null>(() => {
    if (!hasLl || !conRecolectora || canalesLl.length === 0) return null;
    const headers = [
      'Ramal',
      'Área parcial (m²)',
      'Área acum. (m²)',
      'Intensidad (mm/hr)',
      'Coef. escorrentía',
      'Caudal real (LPS)',
      'Manning',
      'Pendiente (%)',
      'Base (cm)',
      'Altura (cm)',
      'Longitud (cm)',
      'Borde libre (cm)',
      'Total (cm)',
      'Caudal máximo (LPS)',
      'Chequeo',
    ];
    const rows = canalesLl.map((c) => {
      const { Qreal, Qmax, chequeo, totalStr } = chequeoCanalLluvia(c);
      return [
        c.sector || '—',
        c.areaParcial || '—',
        c.areaAcumulada || '—',
        c.intensidad || '—',
        c.coeficienteC || '—',
        Qreal > 0 ? Qreal.toFixed(2) : '—',
        c.manning || '—',
        c.pendiente,
        c.b,
        c.h,
        c.longitud ?? '—',
        10,
        totalStr,
        Qmax > 0 ? Qmax.toFixed(2) : '—',
        chequeo,
      ];
    });
    return { title: 'Chequeo capacidad canal recolectora cubierta aguas lluvias', headers, rows };
  }, [hasLl, conRecolectora, canalesLl]);

  // ── AF (calculado en fresco — sin depender de haber visitado esa pantalla) ──
  const ucAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeUcTable('af', tramosAf, aps);
  }, [hasAf, tramosAf, aps]);

  const accAfTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeAccesoriosPorRamalTable(tramosAf, 'Accesorios por ramal — agua fría');
  }, [hasAf, tramosAf]);

  const accAfDiamTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    return computeAccesoriosTable('af', tramosAf, plans);
  }, [hasAf, tramosAf, plans]);

  const afTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAf) return null;
    const rows = computeWaterNetworkRows(
      'af',
      tramosAf,
      tramosAf,
      plans,
      proy.p_red,
      DIAMETROS_AF,
      lookupInterno as (pulg: number) => number,
    );
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red agua fría',
      headerGroups: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        { label: 'Unidades Consumo', span: 3 },
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        { label: 'Diámetro', span: 2 },
        'Coeficiente C',
        'Vel. (mm/s)',
        { label: 'Longitud (m)', span: 4 },
        { label: 'Pérdidas por fricción', span: 2 },
        { label: 'Presión', span: 2 },
      ],
      headers: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        'Propia',
        'Otros Ramales',
        'Total',
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        'Diseño',
        'Interno',
        'Coeficiente C',
        'Vel. (mm/s)',
        'Horizontal',
        'Vertical',
        'Eq. Accesorios',
        'Total',
        '%',
        'm',
        'Inicial',
        'Final',
      ],
      rows: rows.map((r) => [
        r.id,
        r.ini,
        r.fin,
        pisoCorto(r.piso),
        f2(r.udPropia),
        f2(Math.max(0, r.udTotal - r.udPropia)),
        f2(r.udTotal),
        r.nDesc > 0 ? String(r.nDesc) : '—',
        r.K > 0 ? r.K.toFixed(2) : '—',
        r.Qprob > 0 ? r.Qprob.toFixed(3) : '—',
        f2(r.diamEst),
        r.diamDis,
        f2(r.dInt),
        String(r.cHW),
        f2(r.Vmms),
        f2(r.Lh),
        f2(r.Lv),
        f2(r.Le),
        f2(r.Lt),
        f2(r.hfPct),
        f2(r.hfM),
        f2(r.Pin),
        f2(r.Pfin),
      ]),
    };
  }, [hasAf, tramosAf, plans, proy.p_red]);

  // ── Acometida (solo AF) — computeAcometidaSummary recalcula todo desde tramosAf + plans, con el
  // mismo patrón de "cálculo en fresco" que afTable/ucAfTable de arriba, así (a diferencia de una
  // versión anterior que leía un valor que WaterNetworkDesign.tsx solo persistía al abrirlo) la
  // exportación nunca depende de que el usuario haya visitado antes esa pantalla específica.
  // Las filas de Acometida usan su propio formateador (no el f2 compartido) porque f2 trata el 0
  // como "sin datos" e imprime '—' — pero aquí el 0 es un valor calculado legítimo (p. ej. Qaco
  // sin aparatos todavía) y debe leerse como 0, no como dato faltante.
  function buildAcometidaTables(): MemoriaTable[] {
    if (!hasAf) return [];
    const d = computeAcometidaSummary(tramosAf, plans, DIAMETROS_AF);
    if (!d) return [];
    const fmtAco = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
    const tramosTable: MemoriaTable = {
      title: 'Tramos',
      headers: [
        'Tramo',
        'Desde',
        'Hasta',
        'Horizontal (m)',
        'Eq. Accesorios (m)',
        'Diámetro estimado',
        'Diámetro propuesto',
      ],
      rows: [
        [
          'AC-01',
          d.tr1.desde,
          d.tr1.hasta,
          fmtAco(d.tr1.h),
          fmtAco(d.tr1.le),
          fmtAco(d.tr1.diamEstimado),
          d.tr1.diamPropuesto || '—',
        ],
        [
          'AC-02',
          d.tr2.desde,
          d.tr2.hasta,
          fmtAco(d.tr2.h),
          fmtAco(d.tr2.le),
          fmtAco(d.tr2.diamEstimado),
          d.tr2.diamPropuesto || '—',
        ],
      ],
    };
    const parametrosTable: MemoriaTable = {
      title: 'Resumen de parámetros',
      side: true,
      headers: ['Parámetro', 'AC-01', 'AC-02', 'Unidad'],
      rows: [
        ['Caudal (Q)', fmtAco(d.Qaco), fmtAco(d.Qaco), 'l/s'],
        ['Diámetro interior', fmtAco(d.dInt1), fmtAco(d.dInt2), 'mm'],
        ['Velocidad', fmtAco(d.V1), fmtAco(d.V2), 'mm/s'],
        ['Longitud total', fmtAco(d.Lt1), fmtAco(d.Lt2), 'm'],
        ['Pérdidas por fricción (%)', fmtAco(d.hfPct1), fmtAco(d.hfPct2), '%'],
        ['Pérdidas por fricción (m)', fmtAco(d.hfM1), fmtAco(d.hfM2), 'mca'],
        ['Coeficiente C', String(d.cHW1), String(d.cHW2), '—'],
        ['Diámetro del contador', d.diamContador || '—', '', 'pulg'],
        ['Caudal nominal (Qn)', fmtAco(d.Qn), '', 'L/s'],
      ],
    };
    const verificacionTable: MemoriaTable = {
      title: 'Verificación',
      headers: ['Parámetro', 'Valor'],
      rows: [
        ['AC-01 Presión inicial (mca)', fmtAco(d.p1Ini)],
        ['AC-01 Presión final (mca)', fmtAco(d.p1Fin)],
        ['AC-02 Presión inicial (mca)', fmtAco(d.p2Ini)],
        ['AC-02 Presión final (mca)', fmtAco(d.p2Fin)],
        ['Pérdidas en contador (mca)', fmtAco(d.hfContador)],
        ['Pérdidas máximas permitidas (mca)', fmtAco(d.hfMax)],
        ['Chequeo pérdidas contador', d.hfContador <= d.hfMax ? 'O.K.' : 'NO CUMPLE'],
        [
          'Diámetro acometida vs contador',
          d.diamConformeOk ? 'Conforme' : `No conforme (+${fmtAco(d.diamDiff)}")`,
        ],
        ['Presión residual final (mca)', fmtAco(d.pResidual)],
        ['ESTADO GENERAL', d.estadoOk ? 'O.K.' : 'NO CUMPLE'],
      ],
    };
    return [tramosTable, parametrosTable, verificacionTable];
  }

  // ── AC (calculado en fresco; además se alimenta del pFin propio persistido por AF en el nodo calentador) ──
  const ucAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeUcTable('ac', tramosAc, aps);
  }, [hasAc, tramosAc, aps]);

  const heaterTables = useMemo<MemoriaTable[]>(() => {
    if (!hasAc) return [];
    return computeHeaterSelectionTables(tramosAc, plans);
  }, [hasAc, tramosAc, plans]);

  const accAcTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeAccesoriosPorRamalTable(tramosAc, 'Accesorios por ramal — agua caliente');
  }, [hasAc, tramosAc]);

  const accAcDiamTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    return computeAccesoriosTable('ac', tramosAc, plans);
  }, [hasAc, tramosAc, plans]);

  const acTable = useMemo<MemoriaTable | null>(() => {
    if (!hasAc) return null;
    const rows = computeWaterNetworkRows(
      'ac',
      tramosAc,
      tramosAf,
      plans,
      proy.p_red,
      DIAMETROS_AC,
      lookupInternoAC as (pulg: number) => number,
    );
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red agua caliente',
      headerGroups: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        { label: 'Unidades Consumo', span: 3 },
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        { label: 'Diámetro', span: 2 },
        'Coeficiente C',
        'Vel. (mm/s)',
        { label: 'Longitud (m)', span: 4 },
        { label: 'Pérdidas por fricción', span: 2 },
        { label: 'Presión', span: 2 },
      ],
      headers: [
        'Tramo',
        'Inicio',
        'Final',
        'Piso',
        'Propia',
        'Otros Ramales',
        'Total',
        'No. de descargas',
        'K',
        'Caudal (lps)',
        'Diámetro estimado',
        'Diseño',
        'Interno',
        'Coeficiente C',
        'Vel. (mm/s)',
        'Horizontal',
        'Vertical',
        'Eq. Accesorios',
        'Total',
        '%',
        'm',
        'Inicial',
        'Final',
      ],
      rows: rows.map((r) => [
        r.id,
        r.ini,
        r.fin,
        pisoCorto(r.piso),
        f2(r.udPropia),
        f2(Math.max(0, r.udTotal - r.udPropia)),
        f2(r.udTotal),
        r.nDesc > 0 ? String(r.nDesc) : '—',
        r.K > 0 ? r.K.toFixed(2) : '—',
        r.Qprob > 0 ? r.Qprob.toFixed(3) : '—',
        f2(r.diamEst),
        r.diamDis,
        f2(r.dInt),
        String(r.cHW),
        f2(r.Vmms),
        f2(r.Lh),
        f2(r.Lv),
        f2(r.Le),
        f2(r.Lt),
        f2(r.hfPct),
        f2(r.hfM),
        f2(r.Pin),
        f2(r.Pfin),
      ]),
    };
  }, [hasAc, tramosAc, tramosAf, plans, proy.p_red]);

  // ── GAS (calculado en fresco desde los datos de dibujo/accesorios persistidos — sin depender de haber visitado esa pantalla) ──
  const gasTable = useMemo<MemoriaTable | null>(() => {
    if (!hasGas) return null;
    const rows = computeGasRows(plans);
    if (rows.length === 0) return null;
    return {
      title: 'Diseño de red de gas',
      headers: [
        'Tramo',
        'Nivel',
        'Inicio',
        'Final',
        'Material',
        'DN',
        'D int (mm)',
        'K',
        'Long (m)',
        'Le (m)',
        'ΔP (mbar)',
        'Vel (m/s)',
        'Pres. ini (mbar)',
        'Pres. fin (mbar)',
        'Chequeo',
      ],
      rows: rows.map((r) => [
        r.id,
        pisoCorto(r.piso),
        r.ini,
        r.fin,
        r.material || '—',
        r.dn || '—',
        r.dInt > 0 ? r.dInt.toFixed(2) : '—',
        r.K > 0 ? String(r.K) : '—',
        r.longitud > 0 ? r.longitud.toFixed(2) : '—',
        r.le.toFixed(2),
        r.dP.toFixed(2),
        r.vel.toFixed(2),
        r.pIni.toFixed(2),
        r.pFin.toFixed(2),
        r.chequeo,
      ]),
    };
  }, [hasGas, plans]);

  // ── BOMBA / EP ── computeBombaTables/computeEpTables (equiposRows.ts) reconstruyen cada tabla
  // desde todas las páginas de la pantalla en fresco al momento de descargar — mismo patrón de
  // "sin dependencia de visitar pantallas, sin useMemo obsoleto" que buildAcometidaTables de
  // arriba, y una tabla por tarjeta en vez de un resumen único aplanado (coincide con lo que las
  // pantallas reales BombaARDesign/EPInputPage/EPVerificationPage muestran en sus páginas).
  const buildBombaTables = (): MemoriaTable[] => (hasBom ? computeBombaTables() : []);
  const buildEpTables = (): MemoriaTable[] => (hasEp ? computeEpTables() : []);

  const handleDescargarMemoria = async () => {
    setMemoriaBusy(true);
    try {
      const tag = (arr: (MemoriaTable | null)[], red: string): MemoriaTable[] =>
        arr.filter((t): t is MemoriaTable => t !== null).map((t) => ({ ...t, red }));
      const tables = [
        ...tag([ucSanTable, sanTable, bajVentSanTable, sanAccTable, tuberiasSanTable], 'san'),
        ...tag([llTable, llBajTable, llCanalTable, tuberiasLlTable], 'll'),
        ...tag([ucAfTable, afTable, accAfTable, accAfDiamTable, tuberiasAfTable], 'af'),
        ...tag(buildAcometidaTables(), 'aco'),
        ...tag(
          [ucAcTable, acTable, ...heaterTables, accAcTable, accAcDiamTable, tuberiasAcTable],
          'ac',
        ),
        ...tag([gasTable], 'gas'),
        ...tag(buildBombaTables(), 'bom'),
        ...tag(buildEpTables(), 'ep'),
      ];
      if (tables.length === 0) {
        throw new Error(
          'No hay tablas para generar. Asegúrate de que las redes tengan datos dibujados.',
        );
      }
      const data: MemoriaData = { proyNombre: proy.nombre, rows: items.slice(0, 5), tables };
      if (memoriaFmt === 'xlsx') await generateMemoriaExcel(data);
      else if (memoriaFmt === 'pdf') await generateMemoriaPdf(data);
      else await generateMemoriaDocx(data);
    } catch (e) {
      alert(`Error generando memorias: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setMemoriaBusy(false);
    }
  };

  const handleDescargarAnexo = async () => {
    setAnexoBusy(true);
    try {
      await downloadAnexoPdf();
    } catch (e) {
      alert(`Error descargando anexo: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setAnexoBusy(false);
    }
  };

  const handleDescargarPlanos = async () => {
    setPlanosBusy(true);
    try {
      await downloadPlanosPdf(plans, pisos);
    } catch (e) {
      alert(`Error descargando planos: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setPlanosBusy(false);
    }
  };

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      <section className="card">
        <div className="card-h">
          <h2 className="card-t">
            <img
              src="/Informes.webp"
              alt="Informes"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />
            Resumen del proyecto
          </h2>
        </div>
        <div className="card-b">
          <dl style={{ margin: 0 }}>
            {items.map(([k, v]) => (
              <div key={k} style={SUMMARY_ROW_STYLE}>
                <dt
                  style={{
                    fontSize: 12,
                    color: 'var(--txt3)',
                    minWidth: 130,
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {k}
                </dt>
                <dd
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    margin: 0,
                    color: String(v).includes('✗')
                      ? 'var(--err)'
                      : String(v).includes('✓')
                        ? 'var(--ok)'
                        : 'var(--txt)',
                  }}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 460, width: '100%' }}>
        <div className="card-h">
          <h2 className="card-t">
            <img
              src="/iconos_civilflow/descargas.webp"
              alt="Descargas"
              width={20}
              height={20}
              style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />
            Descargas
          </h2>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.2,
              background: !hasCheckedNet
                ? 'var(--bg2)'
                : allOk
                  ? 'rgba(34,197,94,.15)'
                  : 'rgba(239,68,68,.15)',
              color: estadoColor,
              border: `1px solid ${!hasCheckedNet ? 'var(--line)' : allOk ? 'var(--ok)' : 'var(--err)'}`,
            }}
          >
            {estadoLabel}
          </span>
        </div>
        <div
          className="card-b"
          style={{ display: 'flex', flexDirection: 'column', padding: '4px 10px' }}
        >
          <div style={DL_CHIP_STYLE}>
            <img
              src="/iconos_civilflow/memorias_finales.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={DL_LABEL_STYLE}>Memorias finales</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: 'var(--r)',
                overflow: 'hidden',
                border: '1px solid var(--line)',
                opacity: allOk ? 1 : 0.5,
                flexShrink: 0,
              }}
            >
              <select
                aria-label="Formato de descarga"
                disabled={!allOk || memoriaBusy}
                value={memoriaFmt}
                onChange={(e) => setMemoriaFmt(e.target.value as 'xlsx' | 'docx' | 'pdf')}
                style={{
                  padding: '6px 6px 6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRight: '1px solid var(--line)',
                  background: 'var(--bg2)',
                  color: 'var(--txt)',
                  cursor: allOk ? 'pointer' : 'not-allowed',
                }}
              >
                <option value="xlsx">Excel</option>
                <option value="docx">Word</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                type="button"
                disabled={!allOk || memoriaBusy}
                onClick={handleDescargarMemoria}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: allOk ? 'pointer' : 'not-allowed',
                  background: allOk ? 'var(--acc)' : 'var(--bg2)',
                  color: allOk ? '#0f1115' : 'var(--txt3)',
                }}
              >
                {memoriaBusy ? 'Generando…' : 'Descargar'}
              </button>
            </div>
          </div>

          <div style={DL_CHIP_STYLE}>
            <img
              src="/iconos_civilflow/detalle_aparatos.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={DL_LABEL_STYLE}>Anexo — Detalle aparatos</span>
            <button
              type="button"
              disabled={anexoBusy}
              onClick={handleDescargarAnexo}
              style={DL_BTN_STYLE}
            >
              {anexoBusy ? 'Descargando…' : 'Descargar'}
            </button>
          </div>

          <div style={DL_CHIP_STYLE}>
            <img
              src="/iconos_civilflow/planos_red.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={DL_LABEL_STYLE}>Planos de red</span>
            <button
              type="button"
              disabled={planosBusy || confirmedPlanos.length === 0}
              onClick={handleDescargarPlanos}
              style={{ ...DL_BTN_STYLE, opacity: confirmedPlanos.length === 0 ? 0.5 : 1 }}
            >
              {planosBusy ? 'Generando…' : 'Descargar'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
