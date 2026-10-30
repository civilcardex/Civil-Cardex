/** Pestaña "Informe": resumen de cumplimiento del proyecto y descargas (memorias xlsx/docx/pdf, anexo de aparatos, planos de red), todo cancelable. Ej: "Memorias finales" en Excel arma un libro con las tablas de cada red activa y chequeada. */
import { useMemo, useState, useRef } from 'react';
import {
  generateMemoriaExcel,
  generateMemoriaDocx,
  generateMemoriaPdf,
  ExportCancelada,
  type MemoriaTable,
  type MemoriaData,
} from '../../utils/exportReportFinal.ts';
import { getPdfjs } from '../../utils/lazyPdfjs';
import { downloadPlanosPdf } from '../../utils/exportPlanos.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import { useInfTablas } from './useReportTables.ts';
import { REDES } from '../../constants/uiConfig';

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

async function downloadAnexoPdf(signal?: AbortSignal): Promise<void> {
  const r = await fetch(ANEXO_PDF_URL, { signal });
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

// Opciones del PDF de planos (orig. usuario): equipos (bom/ep) NO son redes de tubería; una
// SUBRED solo se ofrece si su red padre está activa (vent→san, recolectora→ll, rejillas→gas).
const EQUIPOS_NETS = new Set(['bom', 'ep']);
const SUBRED_DE: Record<string, string> = { vent: 'san', recolectora: 'll', rejillas: 'gas' };

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
  cursor: 'pointer',
  transition: 'filter .15s',
};

/** Cuerpo de la pestaña Informe: resumen (checks por red) + tarjetas de descarga con botones Cancelar. */
export function InfTab({ state }: { state: WorkAreaState }) {
  const [memoriaFmt, setMemoriaFmt] = useState<'xlsx' | 'docx' | 'pdf'>('xlsx');
  const [memoriaBusy, setMemoriaBusy] = useState(false);
  const [anexoBusy, setAnexoBusy] = useState(false);
  const [planosBusy, setPlanosBusy] = useState(false);
  // Cancelar (orig. usuario): cada descarga en curso muestra su botón; los generadores
  // consultan el flag entre unidades de trabajo (tabla/hoja/lámina) y abortan con
  // ExportCancelada, que el handler traga en silencio. El anexo aborta el fetch (AbortController).
  const cancelMemoriaRef = useRef(false);
  const cancelPlanosRef = useRef(false);
  const cancelAnexoRef = useRef<AbortController | null>(null);
  // Redes EXCLUIDAS del PDF de planos (orig. usuario): la lista ofrecida son las redes ACTIVAS
  // del proyecto; set vacío = todas incluidas.
  const [netsExcluidasPdf, setNetsExcluidasPdf] = useState<Set<string>>(() => new Set());
  const redesOpcionesPdf = useMemo(
    () =>
      [...state.redes].filter(
        (n) => !EQUIPOS_NETS.has(n) && (!SUBRED_DE[n] || state.redes.has(SUBRED_DE[n])),
      ),
    [state.redes],
  );
  // Regla de exportación (orig. usuario): se imprime lo ACTIVO y CHEQUEADO. Las redes no
  // activas no tienen checkbox en el selector → sus trazos residuales se colaban al PDF.
  // La exclusión efectiva = desmarcadas + toda red del catálogo sin estar activa.
  const ocultasExport = useMemo(() => {
    const s = new Set(netsExcluidasPdf);
    for (const r of REDES) if (!state.redes.has(r.id)) s.add(r.id);
    return s;
  }, [netsExcluidasPdf, state.redes]);
  const tables = useInfTablas(state);
  const proy = tables.proy;
  const plans = tables.plans;
  const pisos = tables.pisos;
  const confirmedPlanos = tables.confirmedPlanos;
  const ucSanTable = tables.ucSanTable;
  const bajVentSanTable = tables.bajVentSanTable;
  const sanAccTable = tables.sanAccTable;
  const tuberiasSanTable = tables.tuberiasSanTable;
  const tuberiasLlTable = tables.tuberiasLlTable;
  const tuberiasAfTable = tables.tuberiasAfTable;
  const tuberiasAcTable = tables.tuberiasAcTable;
  const sanTable = tables.sanTable;
  const llTable = tables.llTable;
  const llBajTable = tables.llBajTable;
  const llCanalTable = tables.llCanalTable;
  const ucAfTable = tables.ucAfTable;
  const accAfTable = tables.accAfTable;
  const accAfDiamTable = tables.accAfDiamTable;
  const afTable = tables.afTable;
  const buildAcometidaTables = tables.buildAcometidaTables;
  const ucAcTable = tables.ucAcTable;
  const heaterTables = tables.heaterTables;
  const accAcTable = tables.accAcTable;
  const accAcDiamTable = tables.accAcDiamTable;
  const acTable = tables.acTable;
  const gasTable = tables.gasTable;
  const hasCheckedNet = tables.hasCheckedNet;
  const allOk = tables.allOk;
  const items = tables.items;
  const estadoLabel = tables.estadoLabel;
  const estadoColor = tables.estadoColor;
  const buildBombaTables = tables.buildBombaTables;
  const buildEpTables = tables.buildEpTables;
  const handleDescargarMemoria = async () => {
    setMemoriaBusy(true);
    cancelMemoriaRef.current = false;
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
        // "Redes a descargar" filtra TAMBIÉN las memorias (orig. usuario): el mismo selector
        // gobierna planos de red y memorias finales — y las redes NO activas tampoco entran
        // (regla "activa y chequeada"; bom/ep SÍ se filtran — están en REDES. Solo aco,
        // no presente en REDES, nunca sale del set).
      ].filter((t) => !t.red || !ocultasExport.has(t.red));
      if (tables.length === 0) {
        throw new Error(
          'No hay tablas para generar. Asegúrate de que las redes tengan datos dibujados.',
        );
      }
      const data: MemoriaData = {
        proyNombre: proy.nombre,
        rows: items.slice(0, 5).map(([k, v]) => [k, v] as [string, string]),
        tables,
      };
      const cancelada = () => cancelMemoriaRef.current;
      if (memoriaFmt === 'xlsx') await generateMemoriaExcel(data, cancelada);
      else if (memoriaFmt === 'pdf') await generateMemoriaPdf(data, cancelada);
      else await generateMemoriaDocx(data, cancelada);
    } catch (e) {
      // Cancelar (orig. usuario): aborto intencional — sin alerta, el usuario lo pidió.
      if (!(e instanceof ExportCancelada))
        alert(`Error generando memorias: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setMemoriaBusy(false);
    }
  };

  const handleDescargarAnexo = async () => {
    setAnexoBusy(true);
    cancelAnexoRef.current = new AbortController();
    try {
      await downloadAnexoPdf(cancelAnexoRef.current.signal);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        alert(`Error descargando anexo: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setAnexoBusy(false);
      cancelAnexoRef.current = null;
    }
  };

  const handleDescargarPlanos = async () => {
    setPlanosBusy(true);
    cancelPlanosRef.current = false;
    try {
      await downloadPlanosPdf(plans, pisos, ocultasExport, () => cancelPlanosRef.current);
    } catch (e) {
      if (!(e instanceof ExportCancelada))
        alert(`Error descargando planos: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setPlanosBusy(false);
    }
  };

  return (
    <div
      className="fu"
      data-tour="cf-tab-inf"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
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
              {items.map(([k, v, fallos]) => (
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
                  {fallos && fallos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 8 }}>
                      {fallos.slice(0, 14).map((e, i) => (
                        <span
                          key={`${e}-${i}`}
                          title={`${e} no cumple — revíselo en su tabla de diseño`}
                          style={{
                            fontSize: 10.5,
                            fontFamily: 'var(--mono)',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: 'rgba(239,68,68,.12)',
                            border: '1px solid rgba(239,68,68,.45)',
                            color: 'var(--err)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="card">
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
                {memoriaBusy && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelMemoriaRef.current = true;
                    }}
                    style={{ ...DL_BTN_STYLE, color: '#E7786B', borderColor: '#E7786B' }}
                  >
                    Cancelar
                  </button>
                )}
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
              {anexoBusy && (
                <button
                  type="button"
                  onClick={() => cancelAnexoRef.current?.abort()}
                  style={{ ...DL_BTN_STYLE, color: '#E7786B', borderColor: '#E7786B' }}
                >
                  Cancelar
                </button>
              )}
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
              {planosBusy && (
                <button
                  type="button"
                  onClick={() => {
                    cancelPlanosRef.current = true;
                  }}
                  style={{ ...DL_BTN_STYLE, color: '#E7786B', borderColor: '#E7786B' }}
                >
                  Cancelar
                </button>
              )}
            </div>

            {redesOpcionesPdf.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '4px 12px',
                  padding: '8px 2px 2px',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--txt3)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  Redes a descargar:
                </span>
                {redesOpcionesPdf.map((net) => {
                  const checked = !netsExcluidasPdf.has(net);
                  return (
                    <label
                      key={net}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        color: checked ? 'var(--txt)' : 'var(--txt3)',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNetsExcluidasPdf((prev) => {
                            const nx = new Set(prev);
                            if (nx.has(net)) nx.delete(net);
                            else nx.add(net);
                            return nx;
                          })
                        }
                        style={{ accentColor: 'var(--acc)', cursor: 'pointer' }}
                      />
                      {REDES.find((r) => r.id === net)?.lbl || net}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
