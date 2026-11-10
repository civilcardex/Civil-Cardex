/** Grupo de campos RCI (Red Contra Incendio) como tarjeta con tabla Dato/Valor/Unidad/Tipo/
 *  Observación: una fila por campo, EDITAR propio por tabla (sin EDITAR global), chip de
 *  naturaleza (TAGS_RCI: qué fija la norma y qué decide el diseñador) y la ayuda SIEMPRE
 *  visible en la columna Observación (además del title de la etiqueta). Ej:
 *  <GrupoTabla titulo="Normativa" campos={GRUPOS.normativa} estado={estado} R={R} editar={editar} grande />. */
import { Fragment, useState, type CSSProperties } from 'react';
import { EditTablaBtn, TagRci, useEditarTabla, type RciCtx } from './RCIUI.tsx';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import type { RciResult, RciState } from '../../lib/rci/types.ts';

/* Naturaleza de cada dato (TAGS del HTML): qué fija la norma y qué decide el diseñador. */
export const TAGS_RCI: Record<string, string> = {
  'clas.almacen': 'Proyecto',
  'clas.arrumeH': 'Proyecto',
  'clas.riesgo': 'Norma',
  'clas.sistema': 'Proyecto',
  'clas.qr': 'Criterio',
  'clas.htecho': 'Proyecto',
  'clas.constr': 'Proyecto',
  'clas.techoIncl': 'Proyecto',
  'clas.ocultoComb': 'Proyecto',
  'roc.K': 'Fabricante',
  'roc.Pmin': 'Rango',
  'roc.S': 'Rango',
  'roc.L': 'Rango',
  'roc.Dmuro': 'Rango',
  'tub.Vmax': 'Criterio',
  'tub.Pcomp': 'Fabricante',
  'mang.mangBomba': 'Proyecto',
  'mang.mangTanque': 'Proyecto',
  'mang.duracion': 'Rango',
  'mont.mat': 'Criterio',
  'mont.dn': 'Criterio',
  'mont.hS': 'Rango',
  'mont.hD': 'Proyecto',
  'mont.zBase': 'Proyecto',
  'mont.holgura': 'Criterio',
  'pisos.zBomba': 'Proyecto',
  'sp.clase': 'Norma',
  'sp.num': 'Proyecto',
  'sp.rociado': 'Proyecto',
  'sp.diam': 'Rango',
  'sp.zMinSalida': 'Proyecto',
  'bomba.margen': 'Criterio',
  'bomba.qrManual': 'Rango',
  'bomba.fchurn': 'Fabricante',
  'bomba.etaN': 'Fabricante',
  'bomba.eta150': 'Fabricante',
  'bomba.fs': 'Fabricante',
  'bomba.zFondo': 'Proyecto',
  'bomba.hmin': 'Proyecto',
  'bomba.hmax': 'Proyecto',
  'bomba.matSuc': 'Proyecto',
  'bomba.dnSuc': 'Rango',
  'bomba.lSuc': 'Proyecto',
  'bomba.c90': 'Proyecto',
  'bomba.tee': 'Proyecto',
  'bomba.comp': 'Proyecto',
  'bomba.chq': 'Proyecto',
  'bomba.altitud': 'Proyecto',
  'bomba.patmManual': 'Proyecto',
  'bomba.tagua': 'Proyecto',
  'bomba.npshr': 'Fabricante',
  'bomba.margenNpsh': 'Criterio',
  'bomba.qjockey': 'Rango',
  'tanque.vextra': 'Criterio',
  'local.zonaSis': 'Proyecto',
  'local.cp': 'Norma',
  'local.losaRestr': 'Proyecto',
  'sia.n': 'Norma',
  'sia.entradas': 'Proyecto',
  'sia.rosca': 'Proyecto',
  'sia.npt': 'Proyecto',
  'sia.h': 'Rango',
  'sia.mat': 'Criterio',
  'sia.dn': 'Rango',
  'sia.L': 'Proyecto',
  'sia.c90': 'Proyecto',
  'sia.tee': 'Proyecto',
  'sia.chq': 'Norma',
  'sia.cierre': 'Norma',
  'sia.drenaje': 'Criterio',
  'sia.hidrante': 'Proyecto',
};

/** Ayuda de un campo: texto fijo o resuelta con el resultado (R) y el estado vivos. */
type Ayuda = string | ((r: RciResult, e: RciState) => string);

/** Definición de un campo del formulario: ruta del estado (path), etiqueta, ayuda, opciones o
 *  entrada numérica, unidad y el path Sí/No del que depende (dep → campo deshabilitado).
 *  `optsPar` son opciones [valor, etiqueta] — el select guarda el valor corto y muestra la
 *  etiqueta larga. Ej: clas.constr guarda 'Combustible obstruida' y muestra '…, elementos a
 *  ≥ 0,91 m'. */
export interface DefCampo {
  path: string;
  lbl: string;
  ayu: Ayuda;
  opts?: readonly string[];
  optsPar?: readonly (readonly [string, string])[];
  num?: boolean;
  uni?: string;
  dep?: string;
  /** Fila SIEMPRE gris (solo lectura): el valor llega de otra parte y no se edita aquí.
   *  Ej: meta.pais — lista única del proyecto (Identificación), no del módulo RCI. */
  soloLectura?: boolean;
  /** Forma compacta del valor para el title del control (no cambia el estado ni el value).
   *  Ej: mont.dn '1 1/2"' → title «… · formato: 1-1/2"». */
  fmtValor?: (v: string) => string;
  /** Clave de modal que la celda Observación ofrece con un botón pequeño. Ej: 'clases' →
   *  «¿Qué clase elegir?» (el modal vive en la pestaña, RciInputs). */
  abreModal?: string;
  /** Rango normativo de la fila (ped. usuario): si el valor queda fuera, NO se escribe y la
   *  fila muestra la alerta roja. Se resuelve con el estado y el resultado vivos porque los
   *  límites dependen del riesgo (ej: roc.S ≤ S máx de HZ). Ej: roc.S → { min: 1.8, max: ro.hz.s }. */
  rango?: (e: RciState, R: RciResult) => { min?: number; max?: number } | null;
}

/* ---------------- Estilos locales ---------------- */
const TH10: CSSProperties = { ...TH, fontSize: 11 };
const TDC: CSSProperties = { ...TD, fontSize: 12, padding: '1px 4px' };

type EditarRci = RciCtx['editar'];

/** Celda de etiqueta: texto del campo con la ayuda al pasar el mouse. */
const LBL_TD: CSSProperties = {
  ...TD,
  fontSize: 11,
  fontFamily: 'var(--body)',
  color: 'var(--txt2)',
  textAlign: 'left',
};
/** Celda de unidad. */
const UNI_TD: CSSProperties = {
  ...TDC,
  fontSize: 10.5,
  color: 'var(--txt3)',
  whiteSpace: 'nowrap',
};
/** Celda de observación: la ayuda del campo SIEMPRE visible (no solo el title), texto que
 *  puede ocupar varias líneas (maxWidth para envolver a ~2 líneas). Ej: tub.Vmax muestra
 *  «NFPA 13 no fija límite; 6 m/s es práctica común» sin pasar el mouse. */
const OBS_TD: CSSProperties = {
  ...TD,
  fontSize: 13,
  color: 'var(--txt2)',
  textAlign: 'left',
  whiteSpace: 'normal',
  maxWidth: 380,
};
/** Botón chico dentro de la celda Observación: abre el modal de la clave d.abreModal. */
const BTN_OBS: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 12,
  cursor: 'pointer',
  marginLeft: 6,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};
/** Control de valor activo: caja tipo sanitario (IN_CELDA) con el tamaño de esta tabla (14);
 *  el width va por fila con anchoValor (el del valor) para que activar EDITAR no ensanche la columna. */
const CTRL: CSSProperties = {
  ...IN_CELDA,
  fontSize: 14,
  boxSizing: 'border-box',
  textAlign: 'center',
};
/** Icono ⓘ de dependencia junto al título: tabla con filas que se habilitan con una
 *  condición Sí/No de otra tabla (title = la explicación, depNota). SVG propio (el glifo de
 *  texto ⓘ se ve borroso a 13 px en Windows): círculo + i con extremos redondeados. */
function IconoDep() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      role="img"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="10" cy="10" r="8.3" fill="none" stroke="var(--txt3)" strokeWidth="1.9" />
      <circle cx="10" cy="5.9" r="1.45" fill="var(--txt3)" />
      <path
        d="M10 8.9 V 14.4"
        stroke="var(--txt3)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Props de GrupoTabla: lo que la tarjeta necesita para pintarse y editarse. nota queda
 *  aceptada por compatibilidad con los llamadores, pero el header muestra SOLO el título. */
interface PropsGrupo {
  titulo: string;
  nota?: string;
  /** Ruta pública del icono decorativo del header (ej. '/iconos/montantes_nfpa14.webp'). */
  icono?: string;
  campos: DefCampo[];
  estado: RciState;
  R: RciResult;
  editar: EditarRci;
  /** Ancho mínimo de la tabla (px): estira las columnas para tablas aireadas. */
  minAncho?: number;
  /** Texto del icono ⓘ junto al título: qué condición Sí/No habilita las filas bloqueadas
   *  de esta tabla. Ausente = la tabla no tiene filas dependientes. */
  depNota?: string;
  /** Modo compacto (sub Tubería y mangueras: caben 3 tablas sin scroll vertical): fuentes
   *  un paso menores en título, celdas y controles. */
  compacta?: boolean;
  /** Abre el modal pedido por un campo con `abreModal` (la clave llega como parámetro).
   *  Ej: (clave) => clave === 'clases' && setModalClases(true). */
  onAbrirModal?: (clave: string) => void;
  /** Aceptada por compatibilidad; el tamaño grande y las columnas compactas son siempre. */
  grande?: boolean;
}

/** Un grupo de campos como tarjeta (section.card): cabecera card-h con título 15px gris +
 *  EditTablaBtn a la derecha; debajo la tabla Dato/Valor/Unidad/Tipo/Observación. La edición
 *  la gatea el flag LOCAL de esta tabla (useEditarTabla propio, no el EDITAR global de la
 *  barra); las deps (dep ≠ 'Sí') deshabilitan encima y cada control lleva data-campo para
 *  «Ir al dato». `icono` queda a la IZQUIERDA del título, dentro del h3. La tabla es compacta:
 *  width auto (abraza el contenido) y alineada a la izquierda.
 *  Ej: la sub 'normativa' pinta 14 filas de st.local. */
export function GrupoTabla({
  titulo,
  icono,
  campos,
  estado,
  R,
  editar,
  onAbrirModal,
  minAncho,
  depNota,
  compacta,
}: PropsGrupo) {
  const [edit, toggleEdit] = useEditarTabla();
  /* Gate de rango (ped. usuario): el input es un BORRADOR mientras se teclea; el valor solo se
   * escribe al estado cuando cae dentro del rango del def. Inválido → queda en el input con la
   * alerta roja bajo la fila y al salir (blur) la celda VUELVE al valor persistido (el
   * borrador se descarta sin escribir nada — un '' persistido rompería las derivadas del
   * motor). Así teclear «0,5» rumbo a «2,5» no se traba en el 0. */
  const [draft, setDraft] = useState<{ path: string; val: string } | null>(null);
  const [errPath, setErrPath] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');
  /** Texto del rango para la alerta: «entre X y Y» / «mínimo X» / «máximo X». */
  const txtRango = (rg: { min?: number; max?: number }): string => {
    const partes: string[] = [];
    if (rg.min !== undefined) partes.push(`mínimo ${rg.min}`);
    if (rg.max !== undefined) partes.push(`máximo ${rg.max}`);
    return partes.join(' y ');
  };
  /** Cambio de un campo numérico con rango: valida y solo persiste lo válido. */
  const onChangeNum = (d: DefCampo, v: string) => {
    const rg = d.rango?.(estado, R) ?? null;
    if (rg && v !== '') {
      const n = parseFloat(v.replace(',', '.'));
      const fuera =
        isNaN(n) || (rg.min !== undefined && n < rg.min) || (rg.max !== undefined && n > rg.max);
      if (fuera) {
        setDraft({ path: d.path, val: v });
        setErrPath(d.path);
        setErrMsg(`Fuera de rango: ${txtRango(rg)} — no se guarda.`);
        return;
      }
    }
    setDraft(null);
    setErrPath(null);
    setErrMsg('');
    setP(d.path)(v);
  };
  /** Sale del input con borrador inválido: se descarta y la celda vuelve al valor persistido
   *  (el wiring value={draft?.path === d.path ? draft.val : v} lo pinta solo). NUNCA se
   *  persiste '' — un hueco rompe las derivadas del motor (NaN en zMinSalida, etc.). */
  const blurNum = (): void => {
    setDraft(null);
    setErrPath(null);
    setErrMsg('');
  };
  /** Lee un path 'seccion.hoja' del estado (ej: 'local.exigeSP'). */
  const get = (path: string): string | number => {
    const [sec, hoja] = path.split('.');
    const grp = (estado as unknown as Record<string, Record<string, string | number>>)[sec];
    return (grp && grp[hoja]) ?? '';
  };
  /** Escribe un path 'seccion.hoja' de forma inmutable (mismo gesto que el set(path) del HTML). */
  const setP = (path: string) => (v: string) => {
    const [sec, hoja] = path.split('.');
    editar((e) => {
      const grp = (e as unknown as Record<string, Record<string, string | number>>)[sec];
      if (!grp) return e;
      return { ...e, [sec]: { ...grp, [hoja]: v } };
    });
  };
  /* Tamaños según modo: estándar (14/13/12) vs compacta (12/11/11) para subs con varias tablas. */
  const thS: CSSProperties = { ...TH10, fontSize: compacta ? 10.5 : 12 };
  const lblS: CSSProperties = { ...LBL_TD, fontSize: compacta ? 12 : 14 };
  const uniS: CSSProperties = { ...UNI_TD, fontSize: compacta ? 11 : 13 };
  const ctrlS: CSSProperties = { ...CTRL, fontSize: compacta ? 12 : 14 };
  const tdS: CSSProperties = compacta ? { ...TDC, fontSize: 11 } : TDC;
  /* Tabla MUY ancha (normativa, minAncho ≥ 1600): la observación envuelve en 1 línea — el
   * scroll vertical de la pestaña se iba por las observaciones a 2 líneas (ped. usuario). */
  const obsS: CSSProperties = compacta
    ? { ...OBS_TD, fontSize: 11.5 }
    : minAncho && minAncho >= 1600
      ? { ...OBS_TD, maxWidth: undefined }
      : OBS_TD;
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: compacta ? '4px 10px' : '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: compacta ? 15 : 16,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {icono ? (
            <img src={icono} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          ) : null}
          {titulo}
          {depNota ? (
            <span title={depNota} aria-label="Dependencia de esta tabla" style={{ cursor: 'help' }}>
              <IconoDep />
            </span>
          ) : null}
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            className="tbl"
            style={{
              fontSize: compacta ? 11 : 12,
              borderCollapse: 'collapse',
              width: 'auto',
              minWidth: minAncho,
              maxWidth: '100%',
            }}
          >
            <thead>
              <tr>
                <th style={thS} title="Nombre del dato; al pasar el mouse muestra su ayuda">
                  Dato
                </th>
                <th style={thS} title="Amarillo = editable cuando activas EDITAR">
                  Valor
                </th>
                <th style={thS} title="Unidad del valor (psi, gpm, m…)">
                  Unidad
                </th>
                <th
                  style={thS}
                  title="Naturaleza del dato: Norma, Rango, Fabricante, Proyecto o Criterio"
                >
                  Tipo
                </th>
                <th style={thS} title="Ayuda del dato, siempre visible (sin pasar el mouse)">
                  Observación
                </th>
              </tr>
            </thead>
            <tbody>
              {campos.map((d) => {
                const off = d.soloLectura || (d.dep ? String(get(d.dep)) !== 'Sí' : false);
                const ayu = typeof d.ayu === 'function' ? d.ayu(R, estado) : d.ayu;
                const set = edit && !off ? setP(d.path) : undefined;
                const v = String(get(d.path) ?? '');
                /* Opciones [valor, etiqueta]: los pares tal cual, o cada opción simple como su
                 * propia etiqueta. Ej: clas.constr guarda el value corto y muestra el largo. */
                const pares: readonly (readonly [string, string])[] =
                  d.optsPar ?? (d.opts || []).map((o) => [o, o] as const);
                const claveModal = d.abreModal;
                const abrirModal =
                  claveModal && onAbrirModal ? () => onAbrirModal(claveModal) : undefined;
                /* Título del control: la ayuda + la forma compacta si el campo tiene fmtValor
                 * (p. ej. mont.dn guarda '1 1/2"' y muestra '1-1/2"'). */
                const titulo = d.fmtValor ? `${ayu} · formato: ${d.fmtValor(v)}` : ayu;
                /* Ancho del control: anchoValor tapa a 28ch — un select con valor largo
                 * (clas.constr 'Combustible obstruida…') necesita hasta 60ch para leerse. */
                const anchoCtl = `calc(${Math.min(60, Math.max(6, v.length + 2))}ch + 30px)`;
                return (
                  <Fragment key={d.path}>
                    <tr style={off ? { opacity: 0.55 } : undefined}>
                      <td style={lblS} title={ayu}>
                        {d.lbl}
                      </td>
                      <td style={tdS}>
                        {celdaEditable(
                          edit && !off,
                          d.opts || d.optsPar ? (
                            <select
                              data-campo={d.path}
                              value={v}
                              onChange={(e) => set?.(e.target.value)}
                              title={titulo}
                              style={{ ...ctrlS, width: anchoCtl }}
                            >
                              {pares.map(([val, lbl]) => (
                                <option key={val} value={val}>
                                  {val === '' ? '— / Auto' : lbl}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              data-campo={d.path}
                              /* Con rango: type="text" + inputMode decimal (misma vía que el
                               * modal de dibujo automático) — el number nativo en locale en
                               * devuelve '' para «2,5» (coma) y el valor inválido burlaba el
                               * gate a mitad de tecleo. El parseo coma→punto lo hace
                               * onChangeNum. Sin rango: number nativo como siempre. */
                              type={d.num && !d.rango ? 'number' : 'text'}
                              inputMode={d.rango ? 'decimal' : undefined}
                              step="any"
                              value={draft?.path === d.path ? draft.val : v}
                              title={titulo}
                              onChange={(e) =>
                                d.rango ? onChangeNum(d, e.target.value) : set?.(e.target.value)
                              }
                              onBlur={d.rango ? blurNum : undefined}
                              style={{
                                ...ctrlS,
                                width: anchoCtl,
                                ...(errPath === d.path
                                  ? { borderColor: 'var(--err, #F04545)' }
                                  : {}),
                              }}
                            />
                          ),
                        )}
                      </td>
                      <td style={uniS}>{d.uni || ''}</td>
                      <td style={tdS}>
                        <TagRci tag={TAGS_RCI[d.path]} />
                      </td>
                      <td style={obsS}>
                        {ayu}
                        {abrirModal ? (
                          <button type="button" onClick={abrirModal} style={BTN_OBS}>
                            ¿Qué clase elegir?
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {/* Alerta de rango (ped. usuario): valor inválido NO persistido. */}
                    {errPath === d.path ? (
                      <tr>
                        <td colSpan={5} style={{ ...tdS, color: 'var(--err, #F04545)' }}>
                          {errMsg}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
