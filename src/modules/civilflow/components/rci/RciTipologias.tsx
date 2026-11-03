/** Pestaña Tipologías del diseño RCI (Red Contra Incendio) en 3 sub-pestañas verticales, cada
 *  una su bloque titulado (SecRci): "Pisos del edificio" (ancla rci-tipologias del «Ir al
 *  dato»; tabla gris = nombre y NPT (Nivel de Piso Terminado, del PLANO) / amarillo = editable,
 *  EDITAR en el header), "Tipologías" (+ bloque "Avisos" cuando hay tipologías sin red) y
 *  "Corte esquemático" (pisos apilados por NPT con montante y bomba). Los defaults ya NO se
 *  editan aquí: clas.qr y roc.* viven en Rociadores → "Datos del rociador". Ej: marcar P3 con
 *  «★ aquí» calcula la red de T1 sobre el NPT de P3. */
import type { CSSProperties } from 'react';
import {
  AvisosRci,
  EditTablaBtn,
  SecRci,
  SubTabsRci,
  useEditarTabla,
  useNavRci,
  type RciCtx,
  type SubItemRci,
} from './uiRci.tsx';
import { anchoValor, celdaEditable, IN_CELDA } from './celdaEditable.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import {
  AUTO_SI_NO,
  RIESGOS,
  SINO,
  SISTEMAS,
  filasTipologias,
  resumenTipologias,
  salidaPorClase,
  type FilaTipologia,
} from '../../utils/rci/rowsModel.ts';
import { rangoTipologia } from '../../utils/rci/rowsModelExtras.ts';
import { ElevSvg } from './rciSvgEdificio.tsx';
import { colorTip } from './rciSvgEsquemas.tsx';
import type { NumIn, PisoRow, TipCalc, Tipologia, Tips } from '../../lib/rci/types.ts';

/** Columnas de la tabla de pisos (tooltip = ayuda resumida del HTML de referencia). */
const COLS: { l: string; tip?: string }[] = [
  { l: 'Piso', tip: 'Nombre y NPT: llegan del PLANO (gris 🔒).' },
  { l: 'NPT (m)', tip: 'Nivel de Piso Terminado. Necesario para el perfil de presiones.' },
  { l: 'Uso', tip: 'Uso del piso (texto libre, informativo).' },
  {
    l: 'Planta',
    tip: 'Planta arquitectónica: la red que se calcula es la extraída del plano con esa clave. La misma letra en dos pisos = comparten red.',
  },
  {
    l: 'Riesgo NFPA 13',
    tip: 'Clasificación de riesgo (NFPA 13 cap. 4). "Sin rociadores" saca el piso del cálculo de red.',
  },
  { l: 'Sistema', tip: 'Húmedo o seco. Seco: área +30 %, C del acero 100, sin reducción QR.' },
  { l: 'Techo (m)', tip: 'Altura libre al techo del piso. > 9,14 m: requisitos de techos altos.' },
  {
    l: 'QR',
    tip: 'Rociador de respuesta rápida en toda el área: puede reducir el área de diseño.',
  },
  { l: 'K', tip: 'Factor K del rociador del piso (gpm/psi½).' },
  { l: 'S (m)', tip: 'Separación entre rociadores en el ramal.' },
  { l: 'L (m)', tip: 'Separación entre ramales.' },
  {
    l: 'Salidas',
    tip: 'Salida de manguera del montante en este piso (NFPA 14). El casillero pone la salida por defecto de la clase del sistema.',
  },
  {
    l: 'V.reg',
    tip: 'Válvula reguladora en las salidas. Auto: la incluye el motor si la residual de 1½" supera 100 psi o la estática 175 psi.',
  },
  {
    l: 'VRP',
    tip: 'Válvula reductora de presión en la derivación. Auto: se incluye donde la estática supera la presión de los componentes.',
  },
  {
    l: 'Tip.',
    tip: 'Tipología que agrupa el piso (T1…). ★ = piso representativo: donde se calcula su red.',
  },
];

/** Sub-pestañas de la pestaña Tipologías (ids alineados con SUBS_POR_TAB['pisos']/RUTA_DE, que
 *  manda los «Ir al dato» de pisos a la sub 'pisos'). Ej: setSub('corte') muestra el ElevSvg. */
const SUBS: SubItemRci[] = [
  { id: 'pisos', titulo: 'Pisos del edificio' },
  { id: 'tipos', titulo: 'Tipologías y avisos' },
  { id: 'corte', titulo: 'Corte esquemático' },
];

/** Chip de estado de la red de una tipología (patrón .tchip del HTML). */
const TCHIP: CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--mono)',
  fontWeight: 700,
  color: '#fff',
  padding: '1px 8px',
  borderRadius: 8,
  whiteSpace: 'nowrap',
};

/** Control activo de las celdas de la tabla de pisos: caja tipo sanitario (IN_CELDA) con el
 *  tamaño de la tabla (13); el width va por celda — fijo o con anchoValor (el del valor) para
 *  que activar EDITAR no ensanche la columna. */
const CELDA: CSSProperties = {
  ...IN_CELDA,
  fontSize: 13,
  boxSizing: 'border-box',
  textAlign: 'center',
};

/** Chip del estado de la red: Calculada (verde) / Sin red (ámbar) / Incompleta (rojo). */
const CHIP: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'var(--mono)',
  padding: '1px 7px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};
const CHIP_OK: CSSProperties = {
  ...CHIP,
  borderColor: 'var(--succ, #5DBB83)',
  color: 'var(--succ, #5DBB83)',
};
const CHIP_PEND: CSSProperties = { ...CHIP, borderColor: '#E0A400', color: '#E0A400' };
const CHIP_ERR: CSSProperties = {
  ...CHIP,
  borderColor: 'var(--err, #F04545)',
  color: 'var(--err, #F04545)',
};

/** Item de leyenda del corte (patrón .legend del HTML). */
const LEG_ITEM: CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  fontSize: 11,
  color: 'var(--txt2)',
};

/** Chip "Red" de una tipología desde R.edif.typ: sin entrada → '—', ok → Calculada,
 *  pend → Sin red (la planta no tiene trazos), resto → Incompleta (cerró con errores). */
function ChipRed({ t, planta }: { t: TipCalc | undefined; planta: string }) {
  if (!t) return <span style={{ ...CHIP, color: 'var(--txt3)' }}>—</span>;
  if (t.ok) return <span style={CHIP_OK}>Calculada</span>;
  if (t.pend)
    return (
      <span style={CHIP_PEND} title={`La planta ${planta} no tiene red todavía`}>
        Sin red
      </span>
    );
  return <span style={CHIP_ERR}>Incompleta</span>;
}

/** Bloque "Pisos del edificio" (ancla rci-tipologias del «Ir al dato»): la tabla de pisos del
 *  PLANO con su botón EDITAR en el header del card. Ej: el select de riesgo mueve el piso de
 *  tipología al vuelo (clasificar reagrupa por criterios). */
function TablaPisos({
  filas,
  nota,
  setPiso,
  toggleSalida,
  setRep,
}: {
  filas: FilaTipologia[];
  /** Nota del header: cuántos pisos y tipologías hay. */
  nota: string;
  setPiso: (i: number, k: keyof PisoRow) => (v: string) => void;
  toggleSalida: (i: number, actual: string) => () => void;
  setRep: (tipId: string, nombre: string) => void;
}) {
  const [edit, toggleEdit] = useEditarTabla();
  return (
    <SecRci
      id="tipologias"
      titulo="Pisos del edificio"
      nota={nota}
      icono="/iconos/pisos_edificio.webp"
      extra={<EditTablaBtn on={edit} onToggle={toggleEdit} />}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 900 }}>
          <caption
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            Pisos y tipologías
          </caption>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.l} scope="col" title={c.tip} style={{ ...TH, fontSize: 11 }}>
                  {c.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.i}>
                <td
                  className="c"
                  style={{ ...TD, fontSize: 13, background: 'var(--bg3)', color: 'var(--txt3)' }}
                  title="Del plano (no editable aquí)"
                >
                  {f.nombre}{' '}
                  {f.esRep ? <span title="Piso representativo de su tipología">★</span> : null}
                </td>
                <td
                  className="c"
                  style={{ ...TD, fontSize: 13, background: 'var(--bg3)', color: 'var(--txt3)' }}
                >
                  {f.npt}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      value={f.uso}
                      onChange={(e) => setPiso(f.i, 'uso')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.uso) }}
                    />,
                    f.uso,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      value={f.planta}
                      onChange={(e) => setPiso(f.i, 'planta')(e.target.value)}
                      title="Red que usa este piso (clave de la planta)"
                      style={{ ...CELDA, width: 60 }}
                    />,
                    f.planta,
                    60,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <select
                      value={f.riesgo}
                      onChange={(e) => setPiso(f.i, 'riesgo')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.riesgo) }}
                    >
                      {RIESGOS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    f.riesgo,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <select
                      value={f.sistema}
                      onChange={(e) => setPiso(f.i, 'sistema')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.sistema) }}
                    >
                      {SISTEMAS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    f.sistema,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.htecho}
                      onChange={(e) => setPiso(f.i, 'htecho')(e.target.value)}
                      style={{ ...CELDA, width: 52 }}
                    />,
                    f.htecho,
                    52,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <select
                      value={f.qr}
                      onChange={(e) => setPiso(f.i, 'qr')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.qr) }}
                    >
                      {SINO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    f.qr,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.K}
                      onChange={(e) => setPiso(f.i, 'K')(e.target.value)}
                      style={{ ...CELDA, width: 48 }}
                    />,
                    f.K,
                    48,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.S}
                      onChange={(e) => setPiso(f.i, 'S')(e.target.value)}
                      style={{ ...CELDA, width: 52 }}
                    />,
                    f.S,
                    52,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.L}
                      onChange={(e) => setPiso(f.i, 'L')(e.target.value)}
                      style={{ ...CELDA, width: 52 }}
                    />,
                    f.L,
                    52,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px', whiteSpace: 'nowrap' }}>
                  {edit ? (
                    <>
                      <input
                        type="checkbox"
                        checked={f.salida !== 'Ninguna'}
                        onChange={toggleSalida(f.i, f.salida)}
                        aria-label={`Salida de manguera en ${f.nombre}`}
                      />
                      <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 3 }}>
                        {f.salida}
                      </span>
                    </>
                  ) : (
                    <span>{f.salida}</span>
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <select
                      value={f.vreg}
                      onChange={(e) => setPiso(f.i, 'vreg')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.vreg) }}
                    >
                      {AUTO_SI_NO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    f.vreg,
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {celdaEditable(
                    edit,
                    <select
                      value={f.vrp}
                      onChange={(e) => setPiso(f.i, 'vrp')(e.target.value)}
                      style={{ ...CELDA, width: anchoValor(f.vrp) }}
                    >
                      {AUTO_SI_NO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    f.vrp,
                  )}
                </td>
                <td
                  className="c"
                  style={{ ...TD, fontSize: 13, color: 'var(--txt3)', whiteSpace: 'nowrap' }}
                >
                  {f.tipId || '—'}
                  {f.tipId && edit ? (
                    <button
                      type="button"
                      onClick={() => setRep(f.tipId!, f.nombre)}
                      title={`Calcular la red de ${f.tipId} sobre este piso`}
                      style={{
                        marginLeft: 4,
                        fontSize: 11,
                        padding: '0 4px',
                        cursor: 'pointer',
                        border: '1px solid var(--line)',
                        borderRadius: 3,
                        background: 'transparent',
                        color: 'var(--txt2)',
                      }}
                    >
                      ★ aquí
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ ...TD, fontSize: 13, color: 'var(--txt3)' }}>
                  Sin pisos: confirme planos en el proyecto para registrarlos aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SecRci>
  );
}

/** Bloque "Tipologías": una fila por tipología con su rango de pisos, representativo, planta y
 *  el chip de su red. El botón «Abrir su red» del HTML se omite: requiere cambiar el piso
 *  activo de RciDesign y este componente solo recibe { ctx } (sin setter de piso) — si el shell
 *  pasa un onAbrirRed(gid) algún día, va aquí. */
function TablaTipologias({
  grupos,
  rows,
  typ,
}: {
  grupos: Tipologia[];
  rows: PisoRow[];
  typ: Record<string, TipCalc>;
}) {
  return (
    <SecRci id="tipos" titulo="Tipologías" icono="/iconos/tipologias.webp">
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 640 }}>
          <caption
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            Tipologías: redes por calcular
          </caption>
          <thead>
            <tr>
              {['Tipología', 'Pisos', 'N.º', 'Representativo', 'Planta', 'Red'].map((l) => (
                <th key={l} scope="col" style={{ ...TH, fontSize: 11 }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const rep = rows[g.rep];
              const htsDistintas = new Set(g.hts).size > 1;
              return (
                <tr key={g.id}>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    <span style={{ ...TCHIP, background: colorTip(g.id) }}>{g.id}</span>
                  </td>
                  <td style={{ ...TD, fontSize: 13 }}>{rangoTipologia(g, rows)}</td>
                  <td
                    className="c"
                    style={{ ...TD, fontSize: 13 }}
                    title="Pisos que representa esta tipología"
                  >
                    {g.pisos.length}
                  </td>
                  <td
                    className="c"
                    style={{ ...TD, fontSize: 13 }}
                    title="Representativo: por defecto el piso más alto (recibe menos presión). El «★ aquí» de la tabla de pisos lo cambia"
                  >
                    {rep ? String(rep.nombre || '(sin nombre)') : '—'} ★{htsDistintas ? ' *' : ''}
                  </td>
                  <td
                    className="c"
                    style={{ ...TD, fontSize: 13 }}
                    title="Planta arquitectónica: la clave de la red extraída del plano"
                  >
                    {g.planta}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    <ChipRed t={typ[g.id]} planta={g.planta} />
                  </td>
                </tr>
              );
            })}
            {grupos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...TD, fontSize: 13, color: 'var(--txt3)' }}>
                  Sin tipologías todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--txt3)' }}>
        ★ Representativo: por defecto el piso más alto (recibe menos presión). * Alturas de techo
        distintas dentro de la tipología.
      </p>
    </SecRci>
  );
}

/** Bloque "Corte esquemático": el corte del edificio por tipologías (ElevSvg ya portado) con la
 *  leyenda corta del HTML. Ej: <ElevSvg pisos rows zBomba /> apila P1..P3 por NPT y marca B. */
function CorteEdificio({ pisos, tips, zBomba }: { pisos: PisoRow[]; tips: Tips; zBomba: NumIn }) {
  return (
    <SecRci id="corte" titulo="Corte esquemático" icono="/iconos/corte_esquematico.webp">
      <div>
        <ElevSvg pisos={pisos} groups={tips} zBomba={zBomba} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={LEG_ITEM}>
            <i
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 5,
                background: '#fff',
                border: '2.5px solid var(--rci, #f87171)',
                boxSizing: 'border-box',
              }}
            />
            Salida del montante: conexión 2½" (bomberos) o gabinete con manguera 1½"
          </span>
          <span style={LEG_ITEM}>
            <i
              style={{
                display: 'inline-block',
                width: 16,
                height: 0,
                borderTop: '3px solid var(--rci, #f87171)',
              }}
            />
            Montante
          </span>
          <span style={LEG_ITEM}>★ Piso representativo (color intenso)</span>
          <span style={LEG_ITEM}>B Eje de la bomba</span>
        </div>
      </div>
    </SecRci>
  );
}

/** Pestaña Tipologías del diseño RCI. Ej: <RciTipologias ctx={ctx} /> dentro de RciDesign. */
export function RciTipologias({ ctx }: { ctx: RciCtx }) {
  const { estado, tips, R, editar } = ctx;
  /* La sub abierta vive en la nav del shell (RciDesign): irA conmuta pestaña+sub y recuerda. */
  const nav = useNavRci();
  const { irA } = nav;
  const activa = nav.sub ?? SUBS[0].id;
  const filas = filasTipologias(estado, tips);
  const resumen = resumenTipologias(tips, R.edif);
  /** Avisos del bloque homónimo: tipologías cuyo planta no tiene red calculada. */
  const avisosSinRed = resumen
    .filter((t) => !t.conRed)
    .map(
      (t) =>
        `${t.id} (${t.pisos}) sin red calculada: revise que su planta (${t.planta}) tenga trazos rci con montante conectado.`,
    );

  const setPiso = (i: number, k: keyof PisoRow) => (v: string) =>
    editar((e) => ({
      ...e,
      pisos: {
        ...e.pisos,
        rows: e.pisos.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)),
      },
    }));
  /** El checkbox de salidas pone la salida por defecto de la clase del sistema. */
  const toggleSalida = (i: number, actual: string) => () =>
    setPiso(
      i,
      'salida',
    )(
      actual && actual !== 'Ninguna'
        ? 'Ninguna'
        : salidaPorClase(String(estado.sp.clase || 'Clase III')),
    );
  const setRep = (tipId: string, nombre: string) =>
    editar((e) => ({ ...e, pisos: { ...e.pisos, rep: { ...e.pisos.rep, [tipId]: nombre } } }));

  return (
    <SubTabsRci subs={SUBS} sub={activa} setSub={(id) => irA('tipologias', id)}>
      {activa === 'pisos' ? (
        <TablaPisos
          filas={filas}
          nota={`${filas.length} piso(s) · ${resumen.length} tipología(s)`}
          setPiso={setPiso}
          toggleSalida={toggleSalida}
          setRep={setRep}
        />
      ) : null}
      {activa === 'tipos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TablaTipologias grupos={tips.groups} rows={estado.pisos.rows} typ={R.edif.typ} />
          {/* Avisos: solo cuando hay tipologías sin red (sin aviso no hay bloque vacío). */}
          {avisosSinRed.length ? (
            <SecRci id="avisos" titulo="Avisos" nota="tipologías sin red">
              <AvisosRci avisos={avisosSinRed} />
            </SecRci>
          ) : null}
        </div>
      ) : null}
      {activa === 'corte' ? (
        <CorteEdificio pisos={estado.pisos.rows} tips={tips} zBomba={estado.pisos.zBomba} />
      ) : null}
    </SubTabsRci>
  );
}

export default RciTipologias;
