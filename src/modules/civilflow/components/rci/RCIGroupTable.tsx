/** Grupo de campos RCI (Red Contra Incendio) como tarjeta con tabla Dato/Valor/Unidad/Tipo/
 *  Observación: una fila por campo, EDITAR propio por tabla (sin EDITAR global), chip de
 *  naturaleza (TAGS_RCI: qué fija la norma y qué decide el diseñador) y la ayuda SIEMPRE
 *  visible en la columna Observación (además del title de la etiqueta). Ej:
 *  <GrupoTabla titulo="Normativa" campos={GRUPOS.normativa} estado={estado} R={R} editar={editar} grande />. */
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { EditTablaBtn, TagRci, useEditarTabla, type RciCtx } from './RCIUI.tsx';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
import { RciInputTableScroll } from './RCIInputTableScroll.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import type { RciResult, RciState } from '../../lib/rci/types.ts';
import { isSi } from '../../lib/rci/hydraulics.ts';

/* Naturaleza de cada dato (TAGS del HTML): qué fija la norma y qué decide el diseñador. */
export const TAGS_RCI: Record<string, string> = {
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
  'tanque.vconsumo': 'Proyecto',
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
/** Celda de observación: la ayuda del campo SIEMPRE visible (no solo el title), texto que
 *  puede ocupar varias líneas (maxWidth para envolver). Ej: tub.Vmax muestra
 *  «NFPA 13 no fija límite; 6 m/s es práctica común» sin pasar el mouse. Las subpestañas
 *  anchas la liberan (maxWidth undefined) para que absorba el excedente de la tabla a 100%. */
const OBS_TD: CSSProperties = {
  ...TD,
  fontSize: 13,
  color: 'var(--txt2)',
  textAlign: 'left',
  whiteSpace: 'normal',
  maxWidth: 520,
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

interface PropsGrupo {
  titulo: string;
  /** Ruta pública del icono decorativo del header (ej. '/iconos/montantes_nfpa14.webp'). */
  icono?: string;
  campos: DefCampo[];
  estado: RciState;
  R: RciResult;
  editar: EditarRci;
  /** Ancho mínimo de la tabla (px): estira las columnas para tablas aireadas. */
  minAncho?: number;
  /** Ajusta la tarjeta al contenido sin desbordar el área de Entradas. */
  anchoContenido?: boolean;
  /** Ancho preferido de la tarjeta (px), limitado por el espacio disponible. */
  anchoPreferido?: number;
  /** Agranda la letra de Tubería y mangueras, incluso en ventanas bajas. */
  letraGrande?: boolean;
  /** Texto del icono ⓘ junto al título: qué condición Sí/No habilita las filas bloqueadas
   *  de esta tabla. Ausente = la tabla no tiene filas dependientes. */
  depNota?: string;
  /** Modo compacto (sub Tubería y mangueras: caben 3 tablas sin scroll vertical): fuentes
   *  un paso menores en título, celdas y controles. */
  compacta?: boolean;
  /** Ventana baja (≤860 px de alto, portátil 14-15"): con `compacta` libera el tope de la
   *  Observación para que las filas queden más bajas. Sin efecto fuera del modo compacto. */
  portatil?: boolean;
  /** Abre el modal pedido por un campo con `abreModal` (la clave llega como parámetro).
   *  Ej: (clave) => clave === 'clases' && setModalClases(true). */
  onAbrirModal?: (clave: string) => void;
  extra?: ReactNode;
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
  extra,
  minAncho,
  anchoContenido,
  anchoPreferido,
  letraGrande,
  depNota,
  compacta,
  portatil,
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
    const normalized = v.trim().replace(',', '.');
    if (rg && v !== '') {
      const n = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
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
    setP(d.path)(normalized);
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
  const get = (path: string): string | number | boolean => {
    const [sec, hoja] = path.split('.');
    const grp = (estado as unknown as Record<string, Record<string, string | number | boolean>>)[
      sec
    ];
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
  const thS: CSSProperties = { ...TH10, fontSize: letraGrande ? 13 : compacta ? 10.5 : 12 };
  const lblS: CSSProperties = { ...LBL_TD, fontSize: compacta && !letraGrande ? 12 : 14 };
  const ctrlS: CSSProperties = { ...CTRL, fontSize: compacta && !letraGrande ? 12 : 14 };
  const tdS: CSSProperties = { ...TDC, fontSize: letraGrande ? 14 : compacta ? 11 : 12 };
  /* Subpestañas MUY anchas (≥1600): compacta el card para que la página
   * quepa sin el ligero scroll vertical global (ped. usuario 2026-11-13). */
  const ancha = !!minAncho && minAncho >= 1600;
  const obsS: CSSProperties = letraGrande
    ? { ...OBS_TD, fontSize: 13 }
    : anchoPreferido
      ? { ...OBS_TD, maxWidth: undefined }
      : anchoContenido
        ? { ...OBS_TD, maxWidth: 360 }
        : compacta
          ? /* Portátil (≤860 px de alto): la Observación absorbe el ancho — menos envuelto = filas
             *  más bajas = la sub cabe sin scroll. En monitor se conserva el tope de 520 (ped.
             *  2026-11-17: la columna no desborda la tarjeta). */
            { ...OBS_TD, fontSize: 11.5, maxWidth: portatil ? undefined : OBS_TD.maxWidth }
          : ancha
            ? { ...OBS_TD, maxWidth: undefined }
            : OBS_TD;
  return (
    <section
      className="card"
      style={{
        width: anchoPreferido
          ? `min(100%, ${anchoPreferido}px)`
          : anchoContenido
            ? 'fit-content'
            : '100%',
        maxWidth: '100%',
        minWidth: 0,
        ...(ancha ? { padding: '2px 6px' } : {}),
      }}
    >
      <div
        className="card-h"
        style={{ padding: ancha ? '3px 8px' : compacta ? '4px 10px' : '6px 12px' }}
      >
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
            <img
              src={icono}
              alt=""
              loading="lazy"
              style={{ width: 22, height: 22, objectFit: 'contain' }}
            />
          ) : null}
          {titulo}
          {depNota ? (
            <span title={depNota} aria-label="Dependencia de esta tabla" style={{ cursor: 'help' }}>
              <IconoDep />
            </span>
          ) : null}
        </h3>
        <div className="rci-input-actions">
          {extra}
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: ancha ? 2 : 6 }}>
        <RciInputTableScroll label={titulo}>
          <table
            className="tbl"
            style={{
              fontSize: letraGrande ? 14 : compacta ? 11 : 12,
              borderCollapse: 'collapse',
              /* Doctrina sin-scroll (2026-11-17): tabla SIEMPRE 100% fluida, sin techo —
               * comprime al estrechar y en pantallas anchas llena el card entero; el
               * excedente lo absorbe la columna Observación (obsS sin maxWidth en «ancha»).
               * minAncho ya no constricción de ancho: solo elige padding compacto (ancha). */
              width: '100%',
              minWidth: 0,
            }}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  style={thS}
                  title="Nombre del dato; al pasar el mouse muestra su ayuda"
                >
                  Dato
                </th>
                <th scope="col" style={thS} title="Amarillo = editable cuando activas EDITAR">
                  Valor
                </th>
                <th
                  scope="col"
                  style={thS}
                  title="Naturaleza del dato: Norma, Rango, Fabricante, Proyecto o Criterio"
                >
                  Tipo
                </th>
                <th
                  scope="col"
                  style={thS}
                  title="Ayuda del dato, siempre visible (sin pasar el mouse)"
                >
                  Observación
                </th>
              </tr>
            </thead>
            <tbody>
              {campos.map((d) => {
                const off = d.soloLectura || (d.dep ? !isSi(get(d.dep)) : false);
                const ayu = typeof d.ayu === 'function' ? d.ayu(R, estado) : d.ayu;
                const set = edit && !off ? setP(d.path) : undefined;
                const valor = get(d.path);
                const v = typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor ?? '');
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
                /* Ancho del control: se mide sobre la OPCIÓN más larga del desplegable (no solo
                 * el valor guardado — ped. usuario 2026-11-17: «Construcción del techo» debe
                 * verse completa). Techo 60ch; la celda cede si la tabla se aprieta. */
                const maxLbl = Math.max(v.length, ...pares.map(([, l]) => l.length), 6);
                const anchoCtl = `calc(${Math.min(60, maxLbl + 2)}ch + 30px)`;
                return (
                  <Fragment key={d.path}>
                    <tr
                      tabIndex={-1}
                      className="focus-visible:outline focus-visible:outline-current"
                      style={off ? { opacity: 0.55 } : undefined}
                    >
                      <td style={lblS} title={ayu}>
                        {d.lbl}
                      </td>
                      <td style={tdS}>
                        {celdaEditable(
                          edit && !off,
                          d.opts || d.optsPar ? (
                            <select
                              data-campo={d.path}
                              aria-label={d.lbl}
                              value={v}
                              onChange={(e) => set?.(e.target.value)}
                              title={titulo}
                              style={{ ...ctrlS, width: anchoCtl }}
                            >
                              {v && !pares.some(([value]) => value === v) ? (
                                <option value={v} disabled>
                                  {v} (guardado; revisar)
                                </option>
                              ) : null}
                              {pares.map(([val, lbl]) => (
                                <option key={val} value={val}>
                                  {val === '' ? '— / Auto' : lbl}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              data-campo={d.path}
                              aria-label={d.lbl}
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
                      <td style={tdS}>
                        <TagRci tag={TAGS_RCI[d.path]} fontSize={letraGrande ? 13 : undefined} />
                      </td>
                      <td style={obsS}>
                        {ayu}
                        {abrirModal ? (
                          <button
                            type="button"
                            onClick={abrirModal}
                            className="rci-scheme-link"
                            style={{ marginLeft: 6 }}
                          >
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
        </RciInputTableScroll>
      </div>
    </section>
  );
}
