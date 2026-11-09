/** Bloque "Tipologías" de la pestaña Tipologías RCI (extraído de RCITypologies por el guard de
 *  líneas): una fila por tipología con rango de pisos, representativo y chip del estado de su
 *  red. Markup + handlers por props — el estado vive en el padre.
 *  Ej: <TablaTipologias grupos={tips.groups} rows={estado.pisos.rows} typ={R.edif.typ} onRep={setRep} />. */
import type { CSSProperties } from 'react';
import { ChipEstado, SecRci } from './RCIUI.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import { rangoTipologia } from '../../utils/rci/RCIRowsModelExtras.ts';
import { colorTip } from './RCISvgSchemas.tsx';
import { CELDA12 } from './RCIEditableCell.tsx';
import type { PisoRow, TipCalc, Tipologia } from '../../lib/rci/types.ts';
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
/** Chip "Red" de una tipología desde R.edif.typ: sin entrada → '—', ok → Calculada,
 *  pend → Sin red (la planta no tiene trazos), resto → Incompleta (cerró con errores).
 *  Los colores son los del ChipEstado (CUMPLE/REVISAR/NO CUMPLE) con palabra propia. */
function ChipRed({ t, planta }: { t: TipCalc | undefined; planta: string }) {
  if (!t) return <span style={{ ...CHIP, color: 'var(--txt3)' }}>—</span>;
  const st = t.ok ? 'CUMPLE' : t.pend ? 'REVISAR' : 'NO CUMPLE';
  return (
    <ChipEstado
      st={st}
      label={t.ok ? 'Calculada' : t.pend ? 'Sin red' : 'Incompleta'}
      title={t.pend ? `La planta ${planta} no tiene red todavía` : undefined}
    />
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
  onRep,
}: {
  grupos: Tipologia[];
  rows: PisoRow[];
  typ: Record<string, TipCalc>;
  /** Fija el piso representativo de una tipología (el rep select del HTML). */
  onRep: (tipId: string, nombre: string) => void;
}) {
  /* Columnas del HTML de referencia (buildTipos): 12 datos + acción. N.º y Nivel sobran
     (Pisos ya los muestra); faltaban Riesgo·sistema, H techo, S×L, Densidad, Área,
     Rociadores, Q teórico y NPT rep. */
  const COLS_T = [
    'Tipología',
    'Pisos',
    'Riesgo · sistema',
    'H techo',
    'S × L (m)',
    'Densidad',
    'Área de diseño',
    'Rociadores',
    'Q teórico',
    'Representativo',
    'NPT rep.',
    'Red',
    '',
  ];
  return (
    <SecRci id="tipos" titulo="Tipologías" icono="/iconos/tipologias.webp">
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 980 }}>
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
              {COLS_T.map((l) => (
                <th key={l} scope="col" style={{ ...TH, fontSize: 12 }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const rep = rows[g.rep];
              const htsDistintas = new Set(g.hts).size > 1;
              const o = g.roc;
              const t = typ[g.id];
              const nptRep = rows[g.rep] ? Number(rows[g.rep].npt) : null;
              return (
                <tr key={g.id}>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    <span style={{ ...TCHIP, background: colorTip(g.id) }}>{g.id}</span>
                  </td>
                  <td style={{ ...TD, fontSize: 13 }}>{rangoTipologia(g, rows)}</td>
                  <td
                    className="c"
                    style={{ ...TD, fontSize: 13, textAlign: 'left' }}
                    title="Criterios de los pisos en Auto de esta tipología"
                  >
                    {rep ? `${rep.riesgo} · ${rep.sistema}` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {Number(o.HtFt) / 3.28084 ? (Number(o.HtFt) / 3.28084).toFixed(2) : '—'} m
                    {htsDistintas ? ' *' : ''}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {Number(o.S) ? `${Number(o.S).toFixed(2)} × ${Number(o.L).toFixed(2)}` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {o.hz.d ? `${o.hz.d.toFixed(2)} gpm/ft²` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {o.Adis ? `${(o.Adis * 0.092903).toFixed(1)} m²` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {o.Nreq || '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {o.Qteo ? `${o.Qteo.toFixed(0)} gpm` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    <select
                      value={rep ? String(rep.nombre || '') : ''}
                      onChange={(e) => onRep(g.id, e.target.value)}
                      aria-label={`Representativo de ${g.id}`}
                      style={{ ...CELDA12, width: 120 }}
                    >
                      {[...g.pisos].reverse().map((i) => (
                        <option key={i} value={String(rows[i].nombre || '')}>
                          {rows[i].nombre || '(sin nombre)'}
                          {i === g.highest ? ' (más alto)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {nptRep !== null && !isNaN(nptRep) ? `${nptRep.toFixed(2)} m` : '—'}
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    <ChipRed t={t} planta={g.planta} />
                  </td>
                  <td className="c" style={{ ...TD, fontSize: 13 }}>
                    {g.enEntradas ? (
                      <span
                        title="Los criterios de Entradas coinciden con esta tipología: el cálculo actual corresponde a ella"
                        style={{ color: 'var(--succ, #5DBB83)', fontWeight: 700, fontSize: 11 }}
                      >
                        En cálculo
                      </span>
                    ) : (
                      <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {grupos.length === 0 && (
              <tr>
                <td colSpan={13} style={{ ...TD, fontSize: 13, color: 'var(--txt3)' }}>
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
export { TablaTipologias };
