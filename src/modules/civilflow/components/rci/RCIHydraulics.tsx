/** Sección 4 del diseño RCI (Red Contra Incendio): hidráulica del piso activo en sub-pestañas
 *  verticales, cada una su bloque titulado (SecRci) — Ramales (ancla rci-hidraulica del «Ir al
 *  dato», EDITAR en el header; con orden manual y totales), Tramos (derivación del montante e
 *  instalación típica VRP), Nudos (equilibrio de presiones) y Detalle nudo a nudo. Los avisos
 *  de la red van encima de los bloques. GRIS CON CANDADO 🔒 = geometría del plano (nombre,
 *  conexión, rociadores dibujados, L con su desglose planta+bajada); AMARILLO = lo que el
 *  diseñador ajusta (fluyen, Ø, material si el dibujo no lo trae, S, material/cotas de la red).
 *  Los resultados (Q, P, pérdida, P final) los llena el compute. Ej: R1 del ejemplo cierra con
 *  50.75 gpm @ 20.29 psi y la derivación C pide 37.70 psi con 128.54 gpm. */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AvisosRci,
  EditTablaBtn,
  SecRci,
  StripRci,
  SubTabsRci,
  useEditarTabla,
  type RciCtx,
  type SubItemRci,
  useNavRci,
} from './RCIUI.tsx';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { MATERIALES, filasRamales, filasTramos } from '../../utils/rci/RCIRowsModel.ts';
import { stripDerivacion } from '../../utils/rci/RCIRowsModelExtras.ts';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import { PanelNudosRci, PanelDetalleRci, VACIO } from './RCIHydraulicNodes.tsx';
import { VrpSvg } from './RCISvgFloorplan.tsx';
import { HidSummary } from './RCIHidSummary.tsx';
import RciRamalesTable from './RCIRamalesTable.tsx';
import RciTramosTable from './RCITramosTable.tsx';
import { cOf } from '../../lib/rci/hydraulics.ts';
import type { Red, TipCalc } from '../../lib/rci/types.ts';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { emitTrazosSaved } from '../../utils/fixtureEvents.ts';
import type { DrawingData } from '../../utils/drawingSyncTypes.ts';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';

/** Barra horizontal de controles de la red (el .hbar del HTML): campos + nota al pie. */
const HB: CSSProperties = { display: 'grid', gap: 2, fontSize: 13, color: 'var(--txt2)' };
/** Control activo de la hbar: caja tipo sanitario con el tamaño de la vista (13). */
const HBIN: CSSProperties = { ...IN_CELDA, fontSize: 14, width: 150 };
/** Control activo de las celdas: caja tipo sanitario con el tamaño de la vista (13); el width
 *  propio va por celda — fijo o con anchoValor (el del valor) para que EDITAR no ensanche. */
const BTN_INL: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg4)',
  color: 'var(--txt2)',
  borderRadius: 5,
  fontSize: 11,
  padding: '4px 10px',
  cursor: 'pointer',
};

/** Barra .hbar del HTML: controles + nota reparten el ancho en columnas uniformes (4: los
 *  3 controles y la nota a la misma altura, ped. usuario). Ambos call sites traen 3 hijos. */
function Hbar({ children, nota }: { children: ReactNode; nota: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 18,
        alignItems: 'end',
        padding: '6px 10px',
        background: 'var(--bg3)',
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      {children}
      <div style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.45 }}>{nota}</div>
    </div>
  );
}

/** Qué columnas de una fila vienen del dibujo (gris 🔒): material/diámetro solo si el trazo
 *  los trae. El candado se busca por ID ESTABLE de la fila: el orden de la red mezclada ya no
 *  coincide con el del gris (el orden manual del diseñador sobrevive al re-merge). */
interface FijosFila {
  dn: boolean;
  mat: boolean;
}

/** Candados por id para ramales o tramos de la red gris. */
function fijosPorId(
  filas: readonly { id?: unknown; dn?: unknown; mat?: unknown }[] | undefined,
): Map<string, FijosFila> {
  const m = new Map<string, FijosFila>();
  for (const f of filas || []) {
    m.set(String(f.id ?? ''), {
      dn: f.dn !== undefined && f.dn !== null && f.dn !== '' && f.dn !== 'auto',
      mat: f.mat !== undefined && f.mat !== null && f.mat !== '',
    });
  }
  return m;
}

/** Nudos disponibles de la red para el select de derivación: conexiones de ramales + extremos
 *  de tramos + la raíz (al final, como el nodeList del HTML). Ej: ['A','B','C (derivación)']. */
function nudosDeRed(red: Red | undefined, raiz: string): string[] {
  const s = new Set<string>();
  for (const r of red?.ramales || []) {
    const c = String(r.con || '').trim();
    if (c) s.add(c);
  }
  for (const t of red?.tramos || []) {
    const de = String(t.de || '').trim();
    const a = String(t.a || '').trim();
    if (de) s.add(de);
    if (a) s.add(a);
  }
  return [...s]
    .filter(Boolean)
    .sort(
      (x, y) =>
        (x === raiz ? 1 : 0) - (y === raiz ? 1 : 0) || x.localeCompare(y, 'es', { numeric: true }),
    );
}

/** Sub-pestañas de Hidráulica (ped. usuario): las 4 con contenido — Ramales, Tramos, Nudos,
 *  Detalle nudo a nudo — en el orden del HTML. */
const SUBS_HID: SubItemRci[] = [
  { id: 'ramales', titulo: 'Ramales' },
  { id: 'tramos', titulo: 'Tramos' },
  { id: 'nudos', titulo: 'Nudos' },
  { id: 'detalle', titulo: 'Detalle nudo a nudo' },
];

/** Pestaña Hidráulica del diseño rci (Red Contra Incendio): pinta las sub-pestañas Ramales,
 *  Tramos, Nudos y Detalle nudo a nudo con la red del piso activo — los candados de edición
 *  salen de la red gris (la copia solo dibujo). Ej: "Ramales" lista D1 con su diámetro. */
export function RciHidraulica({
  ctx,
  planId,
  tip,
  red,
  grisRed,
}: {
  ctx: RciCtx;
  /** Clave de la red del piso activo (= planId del plano). */
  planId: string | null;
  /** Tipología que cubre el piso activo (su rd tiene el resultado de la red). */
  tip: TipCalc | null;
  /** Red del piso activo ya mezclada (la que se pinta y edita). */
  red: Red | undefined;
  /** Red GRIS (solo dibujo) de la misma clave: de ahí salen los candados. */
  grisRed: Red | undefined;
}) {
  const { estado, R, editar } = ctx;
  /* Modo edición por tabla: Ramales y Tramos se editan cada uno con su propio flag (al salir
   * de la sub-pestaña el estado local se desmonta y resetea, aceptado por diseño). */
  const [editRam, toggleEditRam] = useEditarTabla();
  const [editTram, toggleEditTram] = useEditarTabla();
  const rd = tip?.rd ?? null;
  /* Techo de la tipología (para el desglose planta+bajada cuando la fila no lo trae). */
  const techo = tip ? tip.roc.HtFt / 3.28084 : 5.3;
  const altDeriv = Number(estado.mont.hD) || 2.5;
  const redKey = planId || '';

  const rams = filasRamales(red, rd);
  const trams = filasTramos(red, rd, techo, altDeriv);
  const fijosR = fijosPorId(grisRed?.ramales);
  const fijosT = fijosPorId(grisRed?.tramos);
  const sProyecto = String(estado.roc.S ?? '');
  const raiz = String(red?.raiz || '').trim() || 'D';
  const nudosLista = nudosDeRed(red, raiz);
  const C = cOf(red?.mat || 'Acero SCH 40', estado.clas.sistema, estado.cmat);
  const strip = stripDerivacion(rd);
  const zRamTxt =
    red && red.zRam !== undefined && red.zRam !== null && red.zRam !== '' ? String(red.zRam) : '';
  const nodoRaiz = red?.nodos?.[raiz];
  const zRaizTxt =
    nodoRaiz && nodoRaiz.z !== undefined && nodoRaiz.z !== null && nodoRaiz.z !== ''
      ? String(nodoRaiz.z)
      : '';

  const setRamal = (i: number, k: 'fluyen' | 'dn' | 'mat' | 'S' | 'zr' | 'troc') => (v: string) => {
    /* MATERIAL → DIBUJO (ped. usuario): lo digitado en la tabla se refleja en el trazo del
     * visor (material + etiqueta del canvas). La fila sabe su trazo por id estable
     * `planId|idTrazo`; se escribe el doc de trazos del piso con ts FRESCO + BD (regla del
     * repo: la copia local solo gana a la BD por ts — sin ts, al reabrir el visor la BD
     * revierte el material). Solo 'mat' — el Ø lo decide el cálculo/auto. */
    if (k === 'mat') {
      const filaId = String(red?.ramales?.[i]?.id ?? red?.ramales?.[i]?.nombre ?? '');
      const elId = filaId.includes('|') ? filaId.slice(filaId.indexOf('|') + 1) : '';
      if (elId && redKey) {
        const doc = loadFromStorage<DrawingData | null>(
          TRAZOS_PREFIX + redKey,
          null,
        ) as unknown as { ts?: number; ramales?: Array<{ id?: string; material?: string }> } | null;
        const trazo = doc?.ramales?.find((r) => r.id === elId);
        if (doc && trazo && (trazo.material || '') !== v) {
          trazo.material = v;
          doc.ts = Date.now();
          const ok = saveToStorage(TRAZOS_PREFIX + redKey, doc, { sinDiario: true });
          if (ok) saveTrazosToDB(String(redKey), doc);
          emitTrazosSaved();
        }
      }
    }
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      return {
        ...e,
        redes: {
          ...e.redes,
          [redKey]: { ...r, ramales: r.ramales.map((x, j) => (j === i ? { ...x, [k]: v } : x)) },
        },
      };
    });
  };
  const setTramo = (i: number, k: 'dn' | 'mat') => (v: string) =>
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      return {
        ...e,
        redes: {
          ...e.redes,
          [redKey]: { ...r, tramos: r.tramos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) },
        },
      };
    });
  /* Claves de la RED entera: material/cota de los ramales y raíz de la derivación. */
  const setRedK = (k: 'mat' | 'zRam' | 'raiz') => (v: string) =>
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      return { ...e, redes: { ...e.redes, [redKey]: { ...r, [k]: v } } };
    });
  /* Cota de un nudo (una por nudo; crea la entrada si aún no existe). La derivación usa la
   * misma vía: nodos[raiz].z. */
  const setZNudo = (nodo: string) => (v: string) =>
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      const nodos = { ...(r.nodos || {}) };
      nodos[nodo] = { ...(nodos[nodo] || { z: '' }), z: v };
      return { ...e, redes: { ...e.redes, [redKey]: { ...r, nodos } } };
    });
  /* Orden de los ramales: el primero es el más remoto; intercambia índices vecinos. */
  const moverRamal = (i: number, dir: -1 | 1) =>
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      const j = i + dir;
      if (j < 0 || j >= r.ramales.length) return e;
      const ramales = r.ramales.slice();
      [ramales[i], ramales[j]] = [ramales[j], ramales[i]];
      return { ...e, redes: { ...e.redes, [redKey]: { ...r, ramales } } };
    });

  const [vrpAbierta, setVrpAbierta] = useState(false);
  /* Escape cierra el modal (listener a nivel documento, patrón HelpPanel). */
  useEffect(() => {
    if (!vrpAbierta) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setVrpAbierta(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [vrpAbierta]);

  /* Sub-pestañas SIEMPRE visibles (ped. usuario): Nudos/Detalle muestran su vacío cuando la
   * red no llega completa a la derivación. */
  /* La sub abierta vive en la nav del shell; cae a 'ramales' si no existe. */
  const navHid = useNavRci();
  const subActiva =
    navHid.sub && SUBS_HID.some((s) => s.id === navHid.sub) ? navHid.sub : 'ramales';

  /* Footer de totales: dibujados y con flujo contra lo que exige el área de diseño. */
  const okN = rd ? rd.flTot === R.roc.Nreq : false;

  return (
    <>
      {/* Avisos de la red encima de los bloques (ramal flotante, nudo sin cerrar…). */}
      {rd && rd.errs.length ? <AvisosRci avisos={rd.errs} /> : null}
      {/* Strip resumen del HTML (#hidSummary): los KPIs del cálculo del piso. */}
      <HidSummary R={R} tip={tip} estado={estado} />
      <SubTabsRci
        subs={SUBS_HID}
        sub={subActiva}
        setSub={(id) => navHid.irA('hidraulica', id)}
        ancho={190}
      >
        {subActiva === 'ramales' ? (
          <SecRci
            id="hidraulica"
            titulo="Ramales del piso"
            nota={tip ? `tipología ${tip.g.id} · planta ${tip.g.planta}` : 'sin red para este piso'}
            icono="/iconos/ramales_piso.webp"
            extra={<EditTablaBtn on={editRam} onToggle={toggleEditRam} />}
          >
            <Hbar
              nota={
                <>
                  Ordenalos desde el más remoto; un solo diámetro por ramal.
                  <br />
                  En el orden del dibujo, de la punta al nudo; el agua circula en sentido contrario.
                </>
              }
            >
              <label style={HB}>
                <span>Material de los ramales</span>
                {celdaEditable(
                  editRam,
                  <select
                    value={red?.mat || 'Acero SCH 40'}
                    onChange={(e) => setRedK('mat')(e.target.value)}
                    style={{ ...HBIN, width: 170 }}
                    aria-label="Material de los ramales"
                  >
                    {MATERIALES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>,
                )}
              </label>
              <div style={HB}>
                <span>Coef. H-W</span>
                <b
                  style={{ fontSize: 13, color: 'var(--txt)' }}
                  title="C de Hazen-Williams del material (solo lectura)"
                >
                  C = {C}
                </b>
              </div>
              <label style={HB}>
                <span>Cota de los ramales (m sobre el NPT)</span>
                {celdaEditable(
                  editRam,
                  <input
                    type="number"
                    step="any"
                    value={zRamTxt}
                    placeholder="0"
                    onChange={(e) => setRedK('zRam')(e.target.value)}
                    style={HBIN}
                    aria-label="Cota de los ramales"
                  />,
                )}
              </label>
            </Hbar>
            <RciRamalesTable
              rams={rams}
              fijosR={fijosR}
              red={red}
              rd={rd}
              editRam={editRam}
              setRamal={setRamal}
              moverRamal={moverRamal}
              sProyecto={sProyecto}
              zRamTxt={zRamTxt}
              okN={okN}
              roc={R.roc}
            />
            <StripRci q={strip ? strip.Q : null} p={strip ? strip.P : null} />
          </SecRci>
        ) : null}
        {subActiva === 'tramos' ? (
          <SecRci
            id="tramos"
            titulo="Tramos del piso"
            icono="/iconos/tramos_piso.webp"
            extra={<EditTablaBtn on={editTram} onToggle={toggleEditTram} />}
          >
            <Hbar
              nota={
                <>
                  En el orden del dibujo, de lo más remoto a la derivación; el agua circula en
                  sentido contrario.
                  <br />
                  Una cota por nudo; en gris, la cota de los ramales.
                </>
              }
            >
              <label style={HB}>
                <span>Derivación del montante</span>
                {celdaEditable(
                  editTram,
                  <select
                    value={raiz}
                    onChange={(e) => setRedK('raiz')(e.target.value)}
                    style={HBIN}
                    aria-label="Derivación del montante"
                  >
                    {nudosLista.map((nn) => (
                      <option key={nn} value={nn}>
                        {nn === raiz ? `${nn} (derivación)` : nn}
                      </option>
                    ))}
                  </select>,
                )}
              </label>
              <label style={HB}>
                <span>Cota de la derivación (m sobre el NPT)</span>
                {celdaEditable(
                  editTram,
                  <input
                    type="number"
                    step="any"
                    value={zRaizTxt}
                    placeholder={fmt(altDeriv)}
                    onChange={(e) => setZNudo(raiz)(e.target.value)}
                    style={HBIN}
                    aria-label="Cota de la derivación"
                  />,
                )}
              </label>
              <button type="button" onClick={() => setVrpAbierta(true)} style={BTN_INL}>
                Ver instalación típica de la derivación
              </button>
            </Hbar>
            <RciTramosTable
              trams={trams}
              fijosT={fijosT}
              red={red}
              editTram={editTram}
              setTramo={setTramo}
              setZNudo={setZNudo}
              zRamTxt={zRamTxt}
              raiz={raiz}
              altDeriv={altDeriv}
            />
          </SecRci>
        ) : null}
        {/* «Red y tipología» y «Fin del piso»: tal cual el HTML v1.7.79 — la psec existe y el
         *  build las deja VACÍAS (buildHidraulica: hRed/alimCard = ""). Sin contenido inventado. */}
        {/* Tabs SIEMPRE visibles (ped. usuario): sin red calculada muestran su vacío —
         *  el usuario ve POR QUÉ no hay nudos, no una sección en blanco. */}
        {subActiva === 'nudos' ? (
          rd ? (
            <PanelNudosRci rd={rd} />
          ) : (
            <div style={VACIO}>Red sin calcular: la derivación no cerró (vea Ramales/Tramos).</div>
          )
        ) : null}
        {subActiva === 'detalle' ? (
          rd ? (
            <PanelDetalleRci rd={rd} />
          ) : (
            <div style={VACIO}>Red sin calcular: no hay ruta nudo a nudo que detallar.</div>
          )
        ) : null}
      </SubTabsRci>
      {vrpAbierta ? (
        <ModalOverlay zIndex={60}>
          {' '}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Instalación típica de la derivación"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              width: 'min(880px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '12px 16px',
              boxShadow: '0 12px 30px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                Instalación típica de la derivación
              </h3>
              <button
                type="button"
                onClick={() => setVrpAbierta(false)}
                aria-label="Cerrar instalación típica"
                style={{ ...BTN_INL, marginLeft: 'auto' }}
              >
                Cerrar ✕
              </button>
            </div>
            <VrpSvg />
          </div>
        </ModalOverlay>
      ) : null}
    </>
  );
}
