/** Bloque "Pisos del edificio" de la pestaña Tipologías RCI (extraído de RCITypologies por el
 *  guard de líneas): la tabla de pisos del PLANO con EDITAR en el header y los paneles «Ver
 *  ayuda» de sus columnas. El estado (edit/ph) es local; filas y setPiso llegan por props.
 *  Ej: <TablaPisos filas={filas} nota="3 piso(s)" grupos={['T1']} setPiso={setPiso} />. */
import { useState, type ReactElement, type ReactNode } from 'react';
import { EditTablaBtn, SecRci, useEditarTabla } from './RCIUI.tsx';
import { celdaEditable } from './RCIEditableCell.tsx';
import {
  AUTO_SI_NO,
  CONSTR_OPCIONES,
  RIESGOS,
  SINO,
  SISTEMAS,
  type FilaTipologia,
} from '../../utils/rci/RCIRowsModel.ts';
import { AYUDA_SALIDA } from './RCIFloorCells.tsx';
import { RciHelpModal } from './RCIHelpModal.tsx';
import { HZ } from '../../lib/rci/tables.ts';
import type { PisoRow, RciState } from '../../lib/rci/types.ts';
/** Columnas de la tabla de pisos (tooltip = ayuda resumida del HTML de referencia). Las que
 *  traen `ph` llevan el botón «Ver ayuda» (el panel del HTML, PISOS_PHELP). */
const COLS: { l: string; tip?: string; ph?: string }[] = [
  { l: 'Piso', tip: 'Nombre y NPT: llegan del PLANO (gris 🔒).' },
  { l: 'NPT (m)', tip: 'Nivel de Piso Terminado. Necesario para el perfil de presiones.' },
  { l: 'Uso', tip: 'Uso del piso (texto libre, informativo — siempre editable).' },
  {
    l: 'Riesgo NFPA 13',
    tip: 'Clasificación de riesgo (NFPA 13 cap. 4). "Sin rociadores" saca el piso del cálculo de red.',
  },
  { l: 'Sistema', tip: 'Húmedo o seco. Seco: área +30 %, C del acero 100, sin reducción QR.' },
  {
    l: 'H techo (m)',
    tip: 'Altura libre al techo del piso. > 9,14 m: requisitos de techos altos.',
  },
  {
    l: 'Techo',
    tip: 'Construcción del techo: define la cobertura máxima en riesgo leve (la misma opción de Entradas → Clasificación).',
    ph: 'constr',
  },
  {
    l: 'Pend.',
    tip: 'Techo con pendiente mayor que 2:12: área de diseño +30 % (NFPA 13 cap. 19).',
    ph: 'techoIncl',
  },
  {
    l: 'Ocultos',
    tip: 'Espacios ocultos combustibles sin rociadores: área mínima 3000 ft² (NFPA 13 cap. 19).',
    ph: 'ocultoComb',
  },
  {
    l: 'QR',
    tip: 'Rociador de respuesta rápida en toda el área: puede reducir el área de diseño.',
  },
  { l: 'K', tip: 'Factor K del rociador del piso (gpm/psi½). Vacío = la global del proyecto.' },
  {
    l: 'Pmin (psi)',
    tip: 'Presión mínima de operación del rociador del piso. Vacío = la global del proyecto (7 psi o la del listado).',
  },
  { l: 'S (m)', tip: 'Separación entre rociadores en el ramal del piso.' },
  { l: 'L (m)', tip: 'Separación entre ramales del piso.' },
  {
    l: 'Salidas',
    tip: AYUDA_SALIDA,
    ph: 'salida',
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
    l: 'Tipo',
    tip: 'Tipología que agrupa el piso (T1…). ★ = piso representativo: donde se calcula su red.',
  },
];

/** Grupos del encabezado de 2 niveles (patrón .pisos del HTML): [grupo, n.º de columnas].
 *  La fila de arriba reparte colSpan y la de abajo lista las columnas — la suma debe ser
 *  COLS.length. Ej: 'Rociador' cubre QR y K. */
const GRUPOS_PISOS: [string, number][] = [
  ['Identificación', 3], // Piso · NPT (m) · Uso
  ['Clasificación NFPA 13', 6], // Riesgo · Sistema · H techo · Techo · Pend. · Ocultos
  ['Rociador', 3], // Resp. rápida (QR) · K · Pmin
  ['Separación (rociador/ramal)', 2], // S (m) · L (m)
  ['Montante', 3], // Salidas · V.reg · VRP
  ['Asignación', 1], // Tip.
];

/** Ayudas «Ver ayuda» de las columnas con panel (portadas del PHELP del HTML de referencia).
 *  Ej: abrir la de Techo muestra la tabla de coberturas por construcción. */
const PISOS_PHELP: Record<string, { t: string; h: React.ReactNode }> = {
  constr: {
    t: 'Construcción del techo',
    h: (
      <>
        <p>
          ¿El techo tiene elementos que estorban la descarga o el paso del calor hacia el rociador
          (vigas, viguetas, cerchas, paneles combustibles)?
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Opción</th>
              <th scope="col">Cuándo</th>
              <th scope="col">Cobertura máx. riesgo leve</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>No comb.</b>
              </td>
              <td>
                Losa de concreto, cubierta metálica, o combustible sin elementos que obstruyan
              </td>
              <td>225 ft² (20,9 m²)</td>
            </tr>
            <tr>
              <td>
                <b>Comb. ≥ 0,91</b>
              </td>
              <td>Combustible obstruida: vigas o viguetas expuestas a 0,91 m o más entre ejes</td>
              <td>168 ft² (15,6 m²)</td>
            </tr>
            <tr>
              <td>
                <b>Comb. &lt; 0,91</b>
              </td>
              <td>Combustible con elementos a menos de 0,91 m (3 ft) entre ejes</td>
              <td>130 ft² (12,1 m²)</td>
            </tr>
          </tbody>
        </table>
        <p className="ef">
          Efecto: solo cambia la cobertura máxima en riesgo leve (NFPA 13 cap. 10). En riesgo
          ordinario y extra no cambia.
        </p>
      </>
    ),
  },
  techoIncl: {
    t: 'Pendiente del techo > 2:12',
    h: (
      <>
        <p>
          ¿El techo sube más de <b>2 por cada 12</b> en horizontal? Equivale a más de 16,7 % o unos
          9,5°.
        </p>
        <ul>
          <li>
            <b>Sí:</b> cubiertas inclinadas, techos a dos aguas con pendiente marcada.
          </li>
          <li>
            <b>No:</b> losas planas o cubiertas con poca pendiente.
          </li>
        </ul>
        <p className="ef">
          Efecto: con Sí, el área de diseño aumenta 30 % (NFPA 13 cap. 19): en techos inclinados el
          calor corre hacia arriba y se abren más rociadores.
        </p>
      </>
    ),
  },
  ocultoComb: {
    t: 'Espacios ocultos combustibles',
    h: (
      <>
        <p>
          ¿Hay espacios cerrados <b>sin rociadores</b> construidos con materiales{' '}
          <b>combustibles</b>? Por ejemplo, sobre un cielo raso con estructura de madera, o
          entrepisos de madera.
        </p>
        <ul>
          <li>
            <b>No:</b> espacios no combustibles (concreto, metal), rellenos de aislamiento
            incombustible, o que sí tienen rociadores.
          </li>
        </ul>
        <p className="ef">
          Efecto: con Sí, el área de diseño no puede ser menor que 3000 ft² (279 m²): un fuego
          oculto puede crecer sin activar rociadores.
        </p>
      </>
    ),
  },
  salida: {
    t: 'Salidas del montante',
    h: (
      <>
        <p>Conexiones de manguera del montante en este piso:</p>
        <table>
          <thead>
            <tr>
              <th scope="col">Opción</th>
              <th scope="col">Qué es</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Ninguna</b>
              </td>
              <td>El piso no tiene salida (cubierta, sótano técnico)</td>
            </tr>
            <tr>
              <td>
                <b>2½"</b>
              </td>
              <td>Válvula para bomberos (Clase I)</td>
            </tr>
            <tr>
              <td>
                <b>1½"</b>
              </td>
              <td>Gabinete con manguera para ocupantes (Clase II)</td>
            </tr>
            <tr>
              <td>
                <b>2½" + 1½"</b>
              </td>
              <td>Las dos (Clase III)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Normalmente va en todos los pisos según la clase que exige el código; márquela donde el
          plano muestra el gabinete o la conexión.
        </p>
        <p className="ef">
          Efecto: genera el montante y su demanda (las dos salidas más altas, 250 gpm cada una en
          Clase I y III) y define dónde van las válvulas reguladoras (columna «V.reg»).
        </p>
      </>
    ),
  },
};

/** Ayuda corta por opción del desplegable Techo (title de cada option). */
const CONSTR_AYU: Record<string, string> = {
  [CONSTR_OPCIONES[0]]:
    'Losa de concreto, cubierta metálica, o combustible sin elementos que obstruyan — cobertura máx. riesgo leve 225 ft² (20,9 m²)',
  [CONSTR_OPCIONES[1]]:
    'Combustible obstruida: vigas o viguetas expuestas a 0,91 m o más entre ejes — cobertura máx. riesgo leve 168 ft² (15,6 m²)',
  [CONSTR_OPCIONES[2]]:
    'Combustible con elementos a menos de 0,91 m (3 ft) entre ejes — cobertura máx. riesgo leve 130 ft² (12,1 m²)',
};

/** Opciones de Salidas (NFPA 14, el catálogo SALIDAS del HTML). */
const SALIDAS: string[] = ['Ninguna', '2½"', '1½"', '2½" + 1½"'];

/** Construcción del techo (NFPA 13): el valor es el de CONSTR_OPCIONES (el mismo de Entradas →
 *  Clasificación) y la etiqueta es la corta del HTML (.pisos) para que el select quepa en 84 px.
 *  Ej: 'Combustible obstruida' se muestra 'Comb. ≥ 0,91'. */
const CONSTR_CORTO: [string, string][] = [
  [CONSTR_OPCIONES[0], 'No comb.'],
  [CONSTR_OPCIONES[1], 'Comb. ≥ 0,91'],
  [CONSTR_OPCIONES[2], 'Comb. < 0,91'],
];
/** Bloque "Pisos del edificio" (ancla rci-tipologias del «Ir al dato»): la tabla de pisos del
 *  PLANO con su botón EDITAR en el header del card. Ej: el select de riesgo mueve el piso de
 *  tipología al vuelo (clasificar reagrupa por criterios). */
function TablaPisos({
  filas,
  nota,
  grupos,
  setPiso,
  globalEstado,
}: {
  filas: FilaTipologia[];
  /** Nota del header: cuántos pisos y tipologías hay. */
  nota: string;
  /** Ids de tipología existentes (T1…): opciones del desplegable de Asignación. */
  grupos: string[];
  setPiso: (i: number, k: keyof PisoRow) => (v: string) => void;
  /** Estado completo del proyecto (para los placeholders de la global). */
  globalEstado?: RciState | null;
}) {
  const [edit, toggleEdit] = useEditarTabla();
  /* Panel «Ver ayuda» de las columnas (el phelp del HTML): una clave a la vez. */
  const [ph, setPh] = useState<string | null>(null);
  /* Chequeo de RANGOS en S/L/DMR (mismo gesto que GrupoTabla: inválido se ve rojo pero NO se
   * guarda; al salir del input la celda vuelve al valor persistido). Límites por RIESGO del
   * piso: S 1,8–S máx · L 1,8–L máx · DMR ≤ S máx/2 (NFPA 13, mismos de Verificaciones). */
  const [borrador, setBorrador] = useState<{ i: number; k: string; val: string } | null>(null);
  const [err, setErr] = useState<{ i: number; k: string; msg: string } | null>(null);
  const hzDe = (riesgo: string): (typeof HZ)[string] => HZ[riesgo] || HZ['Riesgo leve'];
  /** Valor GLOBAL del proyecto para un campo (placeholder de K/Pmin/S/L cuando la fila está vacía). */
  const sProy = (k: 'K' | 'Pmin' | 'S' | 'L' | 'Dmuro'): string => {
    const v = globalEstado?.roc?.[k];
    return v === undefined || v === null || v === '' ? '' : String(v);
  };
  const rangoDe = (k: 'S' | 'L', riesgo: string): { min?: number; max?: number } => {
    const hz = hzDe(riesgo);
    return k === 'S' ? { min: 1.8, max: hz.s } : { min: 1.8, max: hz.l };
  };
  const txtRango = (rg: { min?: number; max?: number }): string => {
    const partes: string[] = [];
    if (rg.min !== undefined) partes.push(`mínimo ${rg.min}`);
    if (rg.max !== undefined) partes.push(`máximo ${rg.max}`);
    return partes.join(' y ');
  };
  /** Cambio de S/L/DMR con rango: valida y solo persiste lo válido (vacío siempre pasa: DMR
   *  vacía = hereda la global). Ej: S=6 en riesgo leve (máx 4,6) → rojo y sin guardar. */
  const onChangeNum = (f: FilaTipologia, k: 'S' | 'L', v: string): void => {
    if (v === '') {
      setBorrador(null);
      setErr(null);
      setPiso(f.i, k)('');
      return;
    }
    const rg = rangoDe(k, f.riesgo);
    const n = parseFloat(v.replace(',', '.'));
    const fuera =
      isNaN(n) || (rg.min !== undefined && n < rg.min) || (rg.max !== undefined && n > rg.max);
    if (fuera) {
      setBorrador({ i: f.i, k, val: v });
      setErr({ i: f.i, k, msg: `Fuera de rango: ${txtRango(rg)} — no se guarda.` });
      return;
    }
    setBorrador(null);
    setErr(null);
    setPiso(f.i, k)(v);
  };
  const numCel = (f: FilaTipologia, k: 'S' | 'L'): ReactElement => (
    <input
      type="number"
      step="any"
      value={borrador && borrador.i === f.i && borrador.k === k ? borrador.val : String(f[k] ?? '')}
      onChange={(e) => onChangeNum(f, k, e.target.value)}
      onBlur={() => {
        setBorrador(null);
        setErr(null);
      }}
      title={err && err.i === f.i && err.k === k ? err.msg : undefined}
      className={`ds-celda12 ds-px-60${err && err.i === f.i && err.k === k ? ' ds-err-border' : ''}`}
    />
  );
  const ayudaDe = (c: { l: string; ph?: string }): ReactNode =>
    c.ph ? (
      <button
        type="button"
        onClick={() => setPh(c.ph ?? null)}
        aria-expanded={ph === c.ph}
        title="Ver ayuda"
        className="rci-help-btn"
      >
        Ver ayuda
      </button>
    ) : null;
  /* La cubierta no participa en la tabla ni en el desplegable: sin rociadores, no tiene red
   * que calcular. Match EXACTO del nombre («Cubierta técnica» sigue siendo piso editable).
   * Se filtra SOLO la vista — los datos quedan intactos para el motor. */
  return (
    <SecRci
      id="tipologias"
      titulo="Pisos del edificio"
      nota={nota}
      icono="/iconos/pisos_edificio.webp"
      extra={<EditTablaBtn on={edit} onToggle={toggleEdit} />}
    >
      <div className="ds-scroll-x">
        <table className="ds-tbl-12 tbl">
          <caption className="sr-only">Pisos y tipologías</caption>
          <thead>
            <tr>
              {GRUPOS_PISOS.map(([g, n]) => (
                <th key={g} colSpan={n} scope="colgroup" className="ds-th">
                  {g}
                </th>
              ))}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.l} scope="col" title={c.tip} className="ds-th">
                  {c.l}
                  {ayudaDe(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.i}>
                <td className="ds-td-13 ds-td-bg3 c" title="Del plano (no editable aquí)">
                  {f.nombre}{' '}
                  {f.esRep ? <span title="Piso representativo de su tipología">★</span> : null}
                </td>
                <td className="ds-td-13 ds-td-bg3 c">{f.npt}</td>
                <td className="ds-td-13 c">
                  {/* Uso: dato del proyecto SIEMPRE editable (sin EDITAR, ped. usuario). */}
                  {celdaEditable(
                    true,
                    <input
                      value={f.uso}
                      onChange={(e) => setPiso(f.i, 'uso')(e.target.value)}
                      className="ds-celda12 ds-px-84"
                    />,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.riesgo}
                      onChange={(e) => setPiso(f.i, 'riesgo')(e.target.value)}
                      className="ds-celda12 ds-px-116"
                    >
                      {RIESGOS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.sistema}
                      onChange={(e) => setPiso(f.i, 'sistema')(e.target.value)}
                      className="ds-celda12 ds-px-84"
                    >
                      {SISTEMAS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.htecho}
                      onChange={(e) => setPiso(f.i, 'htecho')(e.target.value)}
                      className="ds-celda12 ds-px-60"
                    />,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.constr}
                      onChange={(e) => setPiso(f.i, 'constr')(e.target.value)}
                      title={CONSTR_AYU[f.constr] || f.constr}
                      className="ds-celda12 ds-px-84"
                    >
                      {CONSTR_CORTO.map(([v, l]) => (
                        <option key={v} value={v} title={CONSTR_AYU[v]}>
                          {l}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.techoIncl}
                      onChange={(e) => setPiso(f.i, 'techoIncl')(e.target.value)}
                      className="ds-celda12 ds-px-58"
                    >
                      {SINO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.ocultoComb}
                      onChange={(e) => setPiso(f.i, 'ocultoComb')(e.target.value)}
                      className="ds-celda12 ds-px-58"
                    >
                      {SINO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.qr}
                      onChange={(e) => setPiso(f.i, 'qr')(e.target.value)}
                      className="ds-celda12 ds-px-58"
                    >
                      {SINO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.K}
                      onChange={(e) => setPiso(f.i, 'K')(e.target.value)}
                      className="ds-celda12 ds-px-60"
                    />,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <input
                      type="number"
                      step="any"
                      value={f.Pmin ?? ''}
                      placeholder={sProy('Pmin') || ''}
                      onChange={(e) => setPiso(f.i, 'Pmin')(e.target.value)}
                      aria-label="Presión mínima del piso"
                      className="ds-celda12 ds-px-60"
                    />,
                  )}
                </td>
                <td className="ds-td-13 c">{celdaEditable(edit, numCel(f, 'S'))}</td>
                <td className="ds-td-13 c">{celdaEditable(edit, numCel(f, 'L'))}</td>

                <td className="ds-td-13 ds-td-nowrap c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.salida}
                      onChange={(e) => setPiso(f.i, 'salida')(e.target.value)}
                      className="ds-celda12 ds-px-96"
                    >
                      {SALIDAS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.vreg}
                      onChange={(e) => setPiso(f.i, 'vreg')(e.target.value)}
                      className="ds-celda12 ds-px-60"
                    >
                      {AUTO_SI_NO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 c">
                  {celdaEditable(
                    edit,
                    <select
                      value={f.vrp}
                      onChange={(e) => setPiso(f.i, 'vrp')(e.target.value)}
                      className="ds-celda12 ds-px-60"
                    >
                      {AUTO_SI_NO.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
                <td className="ds-td-13 ds-td-nowrap c">
                  {/* Asignación DESPLEGABLE (ped. usuario): Auto agrupa por criterios; forzar
                     un T$n clava el piso dentro de esa tipología (p.tip del HTML). */}
                  {celdaEditable(
                    edit,
                    <select
                      value={f.tip || 'auto'}
                      onChange={(e) => setPiso(f.i, 'tip')(e.target.value)}
                      className="ds-celda12 ds-px-76"
                    >
                      <option value="auto">Auto</option>
                      {grupos.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>,
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="ds-td-13 ds-td-txt3">
                  Sin pisos: confirme planos en el proyecto para registrarlos aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Alerta de rango (misma frase que GrupoTabla): la celda inválida se ve roja y el valor
       *  NO se guarda — al salir del input vuelve al valor persistido. */}
      {err ? (
        <p role="alert" className="rci-err-note">
          {filas.find((f) => f.i === err.i)?.nombre || `Piso ${err.i + 1}`}: {err.msg}
        </p>
      ) : null}
      {/* Panel «Ver ayuda» (el phelp del HTML): tarjeta compartida con la ayuda de la columna. */}
      {ph && PISOS_PHELP[ph] ? (
        <RciHelpModal titulo={PISOS_PHELP[ph].t} onClose={() => setPh(null)}>
          {PISOS_PHELP[ph].h}
        </RciHelpModal>
      ) : null}
    </SecRci>
  );
}
export { TablaPisos };
