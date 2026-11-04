/** Grupo de campos RCI (Red Contra Incendio) como tarjeta con tabla Dato/Valor/Unidad/Tipo/
 *  Observación: una fila por campo, EDITAR propio por tabla (sin EDITAR global), chip de
 *  naturaleza (TAGS_RCI: qué fija la norma y qué decide el diseñador) y la ayuda SIEMPRE
 *  visible en la columna Observación (además del title de la etiqueta). Ej:
 *  <GrupoTabla titulo="Normativa" campos={GRUPOS.normativa} estado={estado} R={R} editar={editar} grande />. */
import type { CSSProperties } from 'react';
import { EditTablaBtn, TagRci, useEditarTabla, type RciCtx } from './RCIUI.tsx';
import { anchoValor, celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';
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
  /** Forma compacta del valor para el title del control (no cambia el estado ni el value).
   *  Ej: mont.dn '1 1/2"' → title «… · formato: 1-1/2"». */
  fmtValor?: (v: string) => string;
  /** Clave de modal que la celda Observación ofrece con un botón pequeño. Ej: 'clases' →
   *  «¿Qué clase elegir?» (el modal vive en la pestaña, RciInputs). */
  abreModal?: string;
}

/* ---------------- Estilos locales ---------------- */
const TH10: CSSProperties = { ...TH, fontSize: 10 };
const TDC: CSSProperties = { ...TD, fontSize: 10.5, padding: '1px 4px' };

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
 *  puede ocupar varias líneas. Ej: tub.Vmax muestra «NFPA 13 no fija límite; 6 m/s es práctica
 *  común» sin pasar el mouse. */
const OBS_TD: CSSProperties = {
  ...TD,
  fontSize: 12,
  color: 'var(--txt2)',
  textAlign: 'left',
  whiteSpace: 'normal',
};
/** Botón chico dentro de la celda Observación: abre el modal de la clave d.abreModal. */
const BTN_OBS: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 11,
  cursor: 'pointer',
  marginLeft: 6,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};
/** Control de valor activo: caja tipo sanitario (IN_CELDA) con el tamaño de esta tabla (13);
 *  el width va por fila con anchoValor (el del valor) para que activar EDITAR no ensanche la columna. */
const CTRL: CSSProperties = {
  ...IN_CELDA,
  fontSize: 13,
  boxSizing: 'border-box',
  textAlign: 'center',
};

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
}: PropsGrupo) {
  const [edit, toggleEdit] = useEditarTabla();
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
  const thS: CSSProperties = { ...TH10, fontSize: 11 };
  const lblS: CSSProperties = { ...LBL_TD, fontSize: 13 };
  const uniS: CSSProperties = { ...UNI_TD, fontSize: 12 };
  const ctrlS: CSSProperties = { ...CTRL, fontSize: 13 };
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
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
              fontSize: 11,
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
                const off = d.dep ? String(get(d.dep)) !== 'Sí' : false;
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
                return (
                  <tr key={d.path}>
                    <td style={lblS} title={ayu}>
                      {d.lbl}
                    </td>
                    <td style={TDC}>
                      {celdaEditable(
                        edit && !off,
                        d.opts || d.optsPar ? (
                          <select
                            data-campo={d.path}
                            value={v}
                            onChange={(e) => set?.(e.target.value)}
                            title={titulo}
                            style={{ ...ctrlS, width: `calc(${anchoValor(v)} + 30px)` }}
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
                            type={d.num ? 'number' : 'text'}
                            step="any"
                            value={v}
                            title={titulo}
                            onChange={(e) => set?.(e.target.value)}
                            style={{ ...ctrlS, width: `calc(${anchoValor(v)} + 30px)` }}
                          />
                        ),
                      )}
                    </td>
                    <td style={uniS}>{d.uni || ''}</td>
                    <td style={TDC}>
                      <TagRci tag={TAGS_RCI[d.path]} />
                    </td>
                    <td style={OBS_TD}>
                      {ayu}
                      {abrirModal ? (
                        <button type="button" onClick={abrirModal} style={BTN_OBS}>
                          ¿Qué clase elegir?
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
