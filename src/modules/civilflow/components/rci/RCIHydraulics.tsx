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
  ChipEstado,
  EditTablaBtn,
  SecRci,
  StripRci,
  SubTabsRci,
  useEditarTabla,
  type RciCtx,
  type SubItemRci,
  useNavRci,
} from './RCIUI.tsx';
import { anchoValor, celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { DIAMETROS, MATERIALES, filasRamales, filasTramos } from '../../utils/rci/RCIRowsModel.ts';
import { SUBS_POR_TAB, stripDerivacion } from '../../utils/rci/RCIRowsModelExtras.ts';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import { PanelNudosRci, PanelDetalleRci } from './RCIHydraulicNodes.tsx';
import { VrpSvg } from './RCISvgFloorplan.tsx';
import { cOf } from '../../lib/rci/hydraulics.ts';
import type { Red, TipCalc } from '../../lib/rci/types.ts';

const TH10 = { ...TH, fontSize: 11 } as const;
const TDC = { ...TD, fontSize: 13, padding: '1px 3px' } as const;

/** Barra horizontal de controles de la red (el .hbar del HTML): campos + nota al pie. */
const HB: CSSProperties = { display: 'grid', gap: 2, fontSize: 13, color: 'var(--txt2)' };
/** Control activo de la hbar: caja tipo sanitario con el tamaño de la vista (13). */
const HBIN: CSSProperties = { ...IN_CELDA, fontSize: 13, width: 150 };
/** Control activo de las celdas: caja tipo sanitario con el tamaño de la vista (13); el width
 *  propio va por celda — fijo o con anchoValor (el del valor) para que EDITAR no ensanche. */
const CELDA: CSSProperties = {
  ...IN_CELDA,
  fontSize: 13,
  boxSizing: 'border-box',
  textAlign: 'center',
};
const BTN_INL: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg4)',
  color: 'var(--txt2)',
  borderRadius: 5,
  fontSize: 11,
  padding: '4px 10px',
  cursor: 'pointer',
};
const BTN_MV: CSSProperties = { ...BTN_INL, padding: '1px 6px' };

/** Barra .hbar del HTML: controles alineados y la nota de uso debajo. */
function Hbar({ children, nota }: { children: ReactNode; nota: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 18px',
        alignItems: 'end',
        padding: '6px 10px',
        background: 'var(--bg3)',
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      {children}
      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--txt3)', lineHeight: 1.45 }}>
        {nota}
      </div>
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

/** Sub-pestañas de Hidráulica: las dos de SUBS_POR_TAB (destino de «Ir al dato») más las dos
 *  nuevas de resultados (se ocultan sin red calculada). */
const SUBS_HID: SubItemRci[] = [
  ...SUBS_POR_TAB['hidraulica'].map((s) => ({ id: s.id, titulo: s.l })),
  { id: 'nudos', titulo: 'Nudos: equilibrio' },
  { id: 'detalle', titulo: 'Detalle nudo a nudo' },
];

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

  const setRamal = (i: number, k: 'fluyen' | 'dn' | 'mat' | 'S') => (v: string) =>
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
  /* Cota del nudo de derivación: una cota por nudo; crea la entrada si aún no existe. */
  const setZRaiz = (v: string) =>
    editar((e) => {
      const r = e.redes[redKey];
      if (!r) return e;
      const nodos = { ...(r.nodos || {}) };
      nodos[raiz] = { ...(nodos[raiz] || { z: '' }), z: v };
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

  const subs: SubItemRci[] = SUBS_HID.map((s) =>
    s.id === 'nudos' || s.id === 'detalle' ? { ...s, oculto: !rd } : s,
  );
  /* La sub abierta vive en la nav del shell; cae a 'ramales' si la guardada quedó oculta. */
  const navHid = useNavRci();
  const subActiva =
    navHid.sub && subs.some((s) => s.id === navHid.sub && !s.oculto) ? navHid.sub : 'ramales';

  /* Footer de totales: dibujados y con flujo contra lo que exige el área de diseño. */
  const okN = rd ? rd.flTot === R.roc.Nreq : false;

  return (
    <>
      {/* Avisos de la red encima de los bloques (ramal flotante, nudo sin cerrar…). */}
      {rd && rd.errs.length ? <AvisosRci avisos={rd.errs} /> : null}
      <SubTabsRci
        subs={subs}
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
                  Ordénelos desde el más remoto; un solo diámetro por ramal.
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
            <div style={{ overflowX: 'auto' }}>
              <table
                className="tbl"
                style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 800 }}
              >
                <caption
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                >
                  Ramales del piso
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={TH10}>
                      Ramal
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Nudo donde conecta el ramal (la última letra es la derivación del montante)"
                    >
                      Conecta
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Rociadores dibujados en el plano (del dibujo)"
                    >
                      Dibujados
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Rociadores con flujo. Vacío = reparto automático desde el más remoto hasta cubrir el área"
                    >
                      Fluyen
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Diámetro único del ramal. Auto: el menor que cumple la velocidad máxima"
                    >
                      Ø
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Material del ramal. Gris = lo trae el dibujo"
                    >
                      Material
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Separación entre rociadores del ramal (vacío = la del proyecto)"
                    >
                      S (m)
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Longitud del ramal punta → conexión, del dibujo. Entre paréntesis: brazo = L − (fluyen − 1) × S"
                    >
                      L ramal (m)
                    </th>
                    <th scope="col" style={TH10} title="Diámetro con el que se calculó">
                      Ø usado
                    </th>
                    <th scope="col" style={TH10} title="Caudal del ramal en su conexión">
                      Q (gpm)
                    </th>
                    <th scope="col" style={TH10} title="Presión que pide el ramal en su conexión">
                      P req. (psi)
                    </th>
                    <th scope="col" style={TH10} title="Cálculo completo y dentro de límites">
                      Estado
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Subir (más remoto) o bajar el ramal en el orden del cálculo"
                    >
                      Orden
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rams.map((f, i) => {
                    const fij = fijosR.get(f.id) || { dn: false, mat: false };
                    return (
                      <tr key={f.id || i}>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          🔒 {f.nombre}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          {f.con || '—'}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          {f.dib ?? '—'}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editRam,
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={f.auto ? '' : String(f.fluyen ?? '')}
                              placeholder={f.fluyen !== null ? String(f.fluyen) : ''}
                              onChange={(e) => setRamal(i, 'fluyen')(e.target.value)}
                              aria-label={`Rociadores con flujo de ${f.nombre}`}
                              style={{ ...CELDA, width: 46 }}
                            />,
                          )}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editRam && !fij.dn,
                            <select
                              value={f.dn}
                              onChange={(e) => setRamal(i, 'dn')(e.target.value)}
                              style={{ ...CELDA, width: anchoValor(f.dn) }}
                            >
                              {DIAMETROS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>,
                          )}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editRam && !fij.mat,
                            <select
                              value={f.mat}
                              onChange={(e) => setRamal(i, 'mat')(e.target.value)}
                              style={{ ...CELDA, width: anchoValor(f.mat) }}
                            >
                              <option value="">—</option>
                              {MATERIALES.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>,
                          )}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editRam,
                            <input
                              type="number"
                              step="any"
                              value={sDeRamal(red, i)}
                              placeholder={sProyecto}
                              onChange={(e) => setRamal(i, 'S')(e.target.value)}
                              aria-label={`Separación S de ${f.nombre}`}
                              style={{ ...CELDA, width: 52 }}
                            />,
                          )}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                          title="Del dibujo (con la bajada si llega a la derivación)"
                        >
                          {f.Lr !== null ? f.Lr.toFixed(2) : '—'}
                          {f.brazo !== null ? ` (${f.brazo.toFixed(2)})` : ''}
                        </td>
                        <td className="c" style={TDC}>
                          {f.dnUsado || '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                          {f.Q !== null ? f.Q.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                          {f.P !== null ? f.P.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{
                            ...TDC,
                            color: f.ok ? 'var(--succ, #5DBB83)' : 'var(--err, #F04545)',
                            fontWeight: 700,
                          }}
                        >
                          {f.ok ? 'OK' : 'revisar'}
                        </td>
                        <td className="c" style={{ padding: '1px 2px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            title="Subir (más remoto)"
                            aria-label={`Subir ${f.nombre}`}
                            disabled={!editRam || i === 0}
                            onClick={() => moverRamal(i, -1)}
                            style={BTN_MV}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Bajar"
                            aria-label={`Bajar ${f.nombre}`}
                            disabled={!editRam || i === rams.length - 1}
                            onClick={() => moverRamal(i, 1)}
                            style={{ ...BTN_MV, marginLeft: 2 }}
                          >
                            ↓
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rams.length === 0 && (
                    <tr>
                      <td colSpan={13} style={TDC}>
                        Sin ramales extraídos: dibuje rci en el plano y confírmelo.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...TDC, fontWeight: 700 }}>Totales</td>
                    <td style={TDC} />
                    <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                      {rd ? rd.dibTot || '—' : '—'}
                    </td>
                    <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                      {rd ? rd.flTot : '—'}
                    </td>
                    <td colSpan={8} className="c" style={{ ...TDC, color: 'var(--txt2)' }}>
                      {rd ? (
                        <>
                          <ChipEstado
                            st={okN ? 'CUMPLE' : rd.flTot < R.roc.Nreq ? 'NO CUMPLE' : 'REVISAR'}
                          />{' '}
                          {okN
                            ? `${rd.flTot} = ${R.roc.Nreq} requeridos ✓`
                            : `${rd.flTot} con flujo · el área exige ${R.roc.Nreq}`}{' '}
                          <span style={{ color: 'var(--txt3)' }}>
                            {R.roc.Nramal} por ramal (lado largo {fmt(R.roc.Llargo)} m)
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td style={TDC} />
                  </tr>
                </tfoot>
              </table>
            </div>
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
                    onChange={(e) => setZRaiz(e.target.value)}
                    style={HBIN}
                    aria-label="Cota de la derivación"
                  />,
                )}
              </label>
              <button type="button" onClick={() => setVrpAbierta(true)} style={BTN_INL}>
                Ver instalación típica de la derivación
              </button>
            </Hbar>
            <div style={{ overflowX: 'auto' }}>
              <table
                className="tbl"
                style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 700 }}
              >
                <caption
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                >
                  Tramos del piso
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={TH10}>
                      Tramo
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Nudo de inicio (llegan ramales o el tramo anterior)"
                    >
                      De
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Nudo final; la derivación del montante es la última letra"
                    >
                      A
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Material del tramo. Gris = lo trae el dibujo"
                    >
                      Material
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Diámetro. Auto: lo elige el motor por velocidad"
                    >
                      Ø
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Longitud total con desglose: planta + bajada a la derivación (del dibujo)"
                    >
                      L (m)
                    </th>
                    <th scope="col" style={TH10} title="Diámetro con el que se calculó">
                      Ø usado
                    </th>
                    <th scope="col" style={TH10} title="Caudal total que transporta">
                      Q (gpm)
                    </th>
                    <th scope="col" style={TH10} title="Pérdida por fricción y accesorios">
                      Pérdida (psi)
                    </th>
                    <th scope="col" style={TH10} title="Presión por desnivel">
                      Pe (psi)
                    </th>
                    <th scope="col" style={TH10} title="Presión al final del tramo">
                      P final (psi)
                    </th>
                    <th scope="col" style={TH10} title="Velocidad del agua">
                      V (m/s)
                    </th>
                    <th scope="col" style={TH10} title="Cálculo completo y dentro de límites">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trams.map((f, i) => {
                    const fij = fijosT.get(f.id) || { dn: false, mat: false };
                    return (
                      <tr key={f.id || i}>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          🔒 {f.nombre}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          {f.de || '—'}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                        >
                          {f.a || '—'}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editTram && !fij.mat,
                            <select
                              value={f.mat}
                              onChange={(e) => setTramo(i, 'mat')(e.target.value)}
                              style={{ ...CELDA, width: anchoValor(f.mat) }}
                            >
                              <option value="">—</option>
                              {MATERIALES.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>,
                          )}
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          {celdaEditable(
                            editTram && !fij.dn,
                            <select
                              value={f.dn}
                              onChange={(e) => setTramo(i, 'dn')(e.target.value)}
                              style={{ ...CELDA, width: anchoValor(f.dn) }}
                            >
                              {DIAMETROS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>,
                          )}
                        </td>
                        <td
                          className="c"
                          style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
                          title="Planta + bajada (del dibujo)"
                        >
                          {f.L !== null ? f.L.toFixed(2) : '—'}
                          {f.desgBajada !== null && f.desgBajada > 0 ? (
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--txt3)' }}>
                              {f.desgPlanta !== null ? f.desgPlanta.toFixed(2) : '—'} planta +{' '}
                              {f.desgBajada.toFixed(2)} bajada
                            </span>
                          ) : null}
                        </td>
                        <td className="c" style={TDC}>
                          {f.dnUsado || '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                          {f.Q !== null ? f.Q.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Pf !== null ? f.Pf.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Pe !== null ? f.Pe.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 600 }}>
                          {f.Pfin !== null ? f.Pfin.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.V !== null ? f.V.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{
                            ...TDC,
                            color: f.ok ? 'var(--succ, #5DBB83)' : 'var(--err, #F04545)',
                            fontWeight: 700,
                          }}
                        >
                          {f.ok ? 'OK' : 'revisar'}
                        </td>
                      </tr>
                    );
                  })}
                  {trams.length === 0 && (
                    <tr>
                      <td colSpan={13} style={TDC}>
                        Sin tramos extraídos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SecRci>
        ) : null}
        {subActiva === 'nudos' && rd ? <PanelNudosRci rd={rd} /> : null}
        {subActiva === 'detalle' && rd ? <PanelDetalleRci rd={rd} /> : null}
      </SubTabsRci>
      {vrpAbierta ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.6)',
            padding: 20,
          }}
        >
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
        </div>
      ) : null}
    </>
  );
}

/** S digitada del ramal (vacío = usa la del proyecto). */
function sDeRamal(red: Red | undefined, i: number): string {
  const r = red?.ramales[i];
  return r && r.S !== undefined && r.S !== null ? String(r.S) : '';
}
