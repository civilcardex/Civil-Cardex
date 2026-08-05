import { Suspense, lazy, useMemo, useState } from 'react';
import {
  generateMemoriaExcel,
  generateMemoriaDocx,
  generateMemoriaPdf,
  type MemoriaTable,
  type MemoriaData,
} from '../utils/exportMemoriaFinal';
import { pisoLbl, pisoCorto, SAN_UC_IDS, APARATOS_DEF } from '../constants';
import PageNav from './PageNav';
import { RainwaterProvider, useRainwater } from '../context/RainwaterContext';
import { DIAMETROS_AF, DIAMETROS_AC } from '../constants/hydraulicData';
import { lookupInterno, lookupInternoAC } from '../utils/accesoriosUtils';
import { buildSanConnectivity, computeSanRows, computeUdTable } from '../utils/sanitaryRows';
import {
  buildLlBajanteAssociations,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../utils/rainwaterRows';
import { computeWaterNetworkRows, computeAcometidaSummary } from '../utils/waterNetworkRows';
import { computeBombaTables, computeEpTables } from '../utils/equiposRows';
import { computeGasRows } from '../utils/gasRows';
import { computeUcTable } from '../utils/ucRows';
import { computeBajanteVentTable } from '../utils/bajanteVentRows';
import { computeAccesoriosTable } from '../utils/sanAccesoriosRows';
import { computeAccesoriosPorRamalTable } from '../utils/accesoriosPorRamalRows';
import { computeRainDownpipesTable } from '../utils/rainDownpipesRows';
import { chequeoCanalLluvia } from '../utils/calcRainwater';
import { computeHeaterSelectionTables } from '../utils/heaterSelectionRows';
import { computeResumenTuberiasTable } from '../utils/resumenTuberiasRows';
import { getPdfjs } from '../utils/lazyPdfjs';
import { downloadPlanosPdf } from '../utils/exportPlanos';
import InfoTab from './workarea/InfoTab';
import type { useWorkAreaState } from './useWorkAreaState';

const ANEXO_PDF_URL = '/docs/detalle-instalacion-aparatos-hsg.pdf';
// Height, in PDF points (page-space, independent of render scale), of the bottom title-block
// stamp (PROYECTO/CONTIENE/OBSERVACIONES/FECHA/PLANO No) on the source sheet. Measured directly
// against that fixed asset: the stamp cluster spans from ~174pt above the bottom edge to the
// bottom edge on a 1701×2551pt page, with a large empty margin above it — safe to crop as a
// constant rather than hunting for it via text search (this PDF's embedded font has a broken
// glyph map, so extracted text like "PROYECTO" comes back garbled as "PRO<ECTO" and can't be
// matched reliably; text also re-uses words like "ESCALA" elsewhere in the drawing itself).
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
const WorkAreaContent_SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const WorkAreaContent_S2: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'baseline',
  padding: '6px 10px',
  background: 'var(--bg3)',
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  marginBottom: 4,
};
const WorkAreaContent_S10: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 'var(--r)',
  border: '1px solid',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'var(--body)',
  flex: 1,
  justifyContent: 'center',
} as const;
const WorkAreaContent_dlChip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 2px',
  borderBottom: '1px solid var(--line)',
  flexWrap: 'wrap',
};
const WorkAreaContent_dlLabel: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--txt)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 130,
};
const WorkAreaContent_dlBtn: React.CSSProperties = {
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
const PlanosTab = lazy(() => import('./workarea/PlanosTab'));
const AccesoriosTable = lazy(() => import('./AccessoriesTable'));
const HeaterSelection = lazy(() => import('./HeaterSelection'));
const CalculoUD = lazy(() => import('./FixtureUnitCalc'));
const DisenosSanitarios = lazy(() => import('./SanitaryDesign'));
const BajantesTable = lazy(() => import('./DownpipesTable'));
const SanAccesoriosPage = lazy(() => import('./SanAccesoriosPage'));
const DisenoLluvias = lazy(() => import('./RainwaterDesign'));
const ChequeoBajantesLluvias = lazy(() => import('./RainDownpipesCheck'));
const ChequeoCanalesLluvias = lazy(() => import('./RainChannelsCheck'));
const CalculoUC = lazy(() => import('./CalculoUC'));
const WaterNetworkDesign = lazy(() => import('./WaterNetworkDesign'));
const BombaARDesign = lazy(() => import('./BombaARDesign'));
const GasDesign = lazy(() => import('./GasDesign'));
const PressureEquipmentDesign = lazy(() => import('./PressureEquipmentDesign'));
const BaseDatos = lazy(() => import('./DesignParameters'));
const Normativa = lazy(() => import('./Regulations/Regulations'));
const IsometriaTab = lazy(() =>
  import('./workarea/IsometriaTab').then((m) => ({ default: m.IsometriaTab })),
);

const FALLBACK = <div style={{ minHeight: 400 }} />;

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
}

const prefetchSan = (p: number) => {
  if (p === 1) import('./FixtureUnitCalc');
  else if (p === 2) import('./SanitaryDesign');
  else if (p === 3) import('./DownpipesTable');
  else if (p === 4) import('./SanAccesoriosPage');
};
const prefetchLl = (p: number) => {
  if (p === 1) import('./RainwaterDesign');
  else if (p === 2) import('./RainDownpipesCheck');
  else if (p === 3) import('./RainChannelsCheck');
};
const prefetchAfAc = (p: number) => {
  if (p === 1) import('./CalculoUC');
  else if (p === 2) import('./WaterNetworkDesign');
  else if (p === 3) import('./AccessoriesTable');
};
const prefetchHeavy = () => {
  import('./BombaARDesign');
  import('./PressureEquipmentDesign');
  import('./GasDesign');
  import('./DesignParameters');
  import('./Regulations/Regulations');
};

function RedesTab({ state }: { state: WorkAreaState }) {
  const {
    redesActivas,
    redes,
    redActiva,
    setRedActiva,
    sanPage,
    setSanPage,
    llPage,
    setLlPage,
    afPage,
    setAfPage,
    acPage,
    setAcPage,
    tramosAf,
    tramosAc,
  } = state;

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      <fieldset
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}
      >
        <legend style={WorkAreaContent_SR_ONLY}>Redes</legend>
        {redesActivas.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => setRedActiva(r.id)}
            onMouseEnter={() => {
              if (r.id === 'bom' || r.id === 'ep' || r.id === 'gas') prefetchHeavy();
            }}
            aria-pressed={redActiva === r.id}
            aria-label={r.lbl}
            style={{
              ...WorkAreaContent_S10,
              borderColor: redActiva === r.id ? r.col : 'var(--line)',
              color: redActiva === r.id ? r.col : 'var(--txt3)',
              background: redActiva === r.id ? 'rgba(0,0,0,.15)' : 'transparent',
              fontWeight: redActiva === r.id ? 700 : 400,
            }}
          >
            {r.icoImg ? (
              <img
                src={r.icoImg}
                alt=""
                width={24}
                height={24}
                style={{ width: 24, height: 24, verticalAlign: 'middle' }}
                loading="lazy"
              />
            ) : (
              <span style={{ fontSize: 18 }}>{r.ico}</span>
            )}
            <span>{r.lbl}</span>
          </button>
        ))}
      </fieldset>
      {redActiva === 'san' && redes.has('san') && (
        <div
          className="fu"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            page={sanPage}
            setPage={setSanPage}
            total={4}
            color="var(--san)"
            labels={[
              'Cálculo de unidades de descarga',
              'Diseño sanitario',
              'Bajantes y ventilación',
              'Accesorios',
            ]}
            onPageHover={prefetchSan}
          />
          {sanPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUD />
            </Suspense>
          )}
          {sanPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <DisenosSanitarios />
            </Suspense>
          )}
          {sanPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <BajantesTable />
            </Suspense>
          )}
          {sanPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <SanAccesoriosPage />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'll' && redes.has('ll') && (
        <div
          className="fu"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            page={llPage}
            setPage={setLlPage}
            total={3}
            color="var(--ll)"
            labels={['Diseño lluvias', 'Chequeo bajantes', 'Chequeo canales']}
            onPageHover={prefetchLl}
          />
          {llPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <DisenoLluvias />
            </Suspense>
          )}
          {llPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <ChequeoBajantesLluvias />
            </Suspense>
          )}
          {llPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <ChequeoCanalesLluvias />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'af' && redes.has('af') && (
        <div
          className="fu"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            page={afPage}
            setPage={setAfPage}
            total={3}
            color="var(--af)"
            labels={['Cálculo de unidades de consumo', 'Diseño de red agua fría', 'Accesorios']}
            onPageHover={prefetchAfAc}
          />
          {afPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUC tipo="af" />
            </Suspense>
          )}
          {afPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <WaterNetworkDesign
                networkType="af"
                diamTable={DIAMETROS_AF}
                lookupFn={lookupInterno as (pulg: number) => number}
              />
            </Suspense>
          )}
          {afPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosTable tramos={tramosAf} />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'ac' && redes.has('ac') && (
        <div
          className="fu"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            page={acPage}
            setPage={setAcPage}
            total={4}
            color="var(--ac)"
            labels={[
              'Cálculo de unidades de consumo',
              'Diseño de red agua caliente',
              'Selección calentador',
              'Accesorios',
            ]}
            onPageHover={prefetchAfAc}
          />
          {acPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUC tipo="ac" />
            </Suspense>
          )}
          {acPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <WaterNetworkDesign
                networkType="ac"
                diamTable={DIAMETROS_AC}
                lookupFn={lookupInternoAC as (pulg: number) => number}
              />
            </Suspense>
          )}
          {acPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <HeaterSelection />
            </Suspense>
          )}
          {acPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosTable tramos={tramosAc} />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'bom' && redes.has('bom') && (
        <Suspense fallback={FALLBACK}>
          <BombaARDesign />
        </Suspense>
      )}
      {redActiva === 'ep' && redes.has('ep') && (
        <Suspense fallback={FALLBACK}>
          <PressureEquipmentDesign />
        </Suspense>
      )}
      {redActiva === 'gas' && redes.has('gas') && (
        <Suspense fallback={FALLBACK}>
          <GasDesign />
        </Suspense>
      )}
      {redesActivas
        .filter(
          (r) =>
            r.id !== 'san' &&
            r.id !== 'll' &&
            r.id !== 'af' &&
            r.id !== 'ac' &&
            r.id !== 'bom' &&
            r.id !== 'ep' &&
            r.id !== 'gas',
        )
        .map(
          (r) =>
            redActiva === r.id &&
            redes.has(r.id) && (
              <div
                key={r.id}
                className="fu"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  flex: 1,
                  minHeight: 250,
                }}
              >
                <div style={{ fontSize: 48, opacity: 0.5 }}>&#x1F6A7;</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt2)' }}>{r.lbl}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--txt3)',
                    textAlign: 'center',
                    maxWidth: 380,
                    lineHeight: 1.6,
                  }}
                >
                  El módulo de <strong>{r.lbl}</strong> está en desarrollo.
                  <br />
                  Pronto estará disponible para uso en CivilFlow.
                </div>
              </div>
            ),
        )}
    </div>
  );
}

function InfTab({ state }: { state: WorkAreaState }) {
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
        10,
        totalStr,
        Qmax > 0 ? Qmax.toFixed(2) : '—',
        chequeo,
      ];
    });
    return { title: 'Chequeo capacidad canal recolectora cubierta aguas lluvias', headers, rows };
  }, [hasLl, conRecolectora, canalesLl]);

  // ── AF (computed fresh — no dependency on having visited that screen) ──
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

  // ── Acometida (AF only) — computeAcometidaSummary recomputes everything from tramosAf + plans,
  // the same "computed fresh" pattern as afTable/ucAfTable above, so (unlike an earlier version of
  // this that read a value WaterNetworkDesign.tsx persisted only once it was opened) the export
  // never depends on the user having visited that specific screen first.
  // Acometida rows use their own formatter (not the shared f2) because f2 treats 0 as "no data"
  // and prints '—' — but 0 is a legitimate computed value here (e.g. Qaco with no fixtures yet),
  // and should read as 0, not as missing.
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

  // ── AC (computed fresh; also feeds from AF's own persisted pFin at the calentador node) ──
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

  // ── GAS (computed fresh from persisted drawing/accessory data — no dependency on having visited that screen) ──
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

  // ── BOMBA / EP ── computeBombaTables/computeEpTables (equiposRows.ts) rebuild every table from
  // every screen page fresh at download time — same "no screen-visit dependency, no stale useMemo"
  // pattern as buildAcometidaTables above, and one table per card instead of a single flattened
  // summary (matches what the live BombaARDesign/EPInputPage/EPVerificationPage screens actually
  // show across their pages).
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
              <div key={k} style={WorkAreaContent_S2}>
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
          <div style={WorkAreaContent_dlChip}>
            <img
              src="/iconos_civilflow/memorias_finales.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={WorkAreaContent_dlLabel}>Memorias finales</span>
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

          <div style={WorkAreaContent_dlChip}>
            <img
              src="/iconos_civilflow/detalle_aparatos.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={WorkAreaContent_dlLabel}>Anexo — Detalle aparatos</span>
            <button
              type="button"
              disabled={anexoBusy}
              onClick={handleDescargarAnexo}
              style={WorkAreaContent_dlBtn}
            >
              {anexoBusy ? 'Descargando…' : 'Descargar'}
            </button>
          </div>

          <div style={WorkAreaContent_dlChip}>
            <img
              src="/iconos_civilflow/planos_red.webp"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20, flexShrink: 0 }}
              loading="lazy"
            />
            <span style={WorkAreaContent_dlLabel}>Planos de red</span>
            <button
              type="button"
              disabled={planosBusy || confirmedPlanos.length === 0}
              onClick={handleDescargarPlanos}
              style={{ ...WorkAreaContent_dlBtn, opacity: confirmedPlanos.length === 0 ? 0.5 : 1 }}
            >
              {planosBusy ? 'Generando…' : 'Descargar'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function WorkAreaContent({ state }: WorkAreaContentProps) {
  const { tab, redes } = state;

  return (
    <RainwaterProvider>
      {tab === 'info' && (
        <section
          aria-label="Información del proyecto"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Información del proyecto</h2>
          <InfoTab state={state} />
        </section>
      )}
      {tab === 'planos' && (
        <section
          aria-label="Carga de planos"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Carga de planos</h2>
          <Suspense fallback={FALLBACK}>
            <PlanosTab state={state} />
          </Suspense>
        </section>
      )}
      {tab === 'redes' && state.redesActivas.length > 0 && (
        <section
          aria-label="Diseño de red"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Diseño de red</h2>
          <RedesTab state={state} />
        </section>
      )}
      {tab === 'datos' && (
        <section
          aria-label="Parámetros de diseño"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Parámetros de diseño</h2>
          <Suspense fallback={FALLBACK}>
            <BaseDatos redes={redes} />
          </Suspense>
        </section>
      )}
      {tab === 'crit' && (
        <section
          aria-label="Criterios y normativa"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Criterios y normativa</h2>
          <Suspense fallback={FALLBACK}>
            <Normativa />
          </Suspense>
        </section>
      )}
      {tab === 'inf' && (
        <section
          aria-label="Resumen del proyecto"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Resumen del proyecto</h2>
          <InfTab state={state} />
        </section>
      )}
      {tab === 'iso' && (
        <section
          aria-label="Isometría de red"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={WorkAreaContent_SR_ONLY}>Isometría de red</h2>
          <Suspense fallback={FALLBACK}>
            <IsometriaTab state={state} />
          </Suspense>
        </section>
      )}
    </RainwaterProvider>
  );
}
