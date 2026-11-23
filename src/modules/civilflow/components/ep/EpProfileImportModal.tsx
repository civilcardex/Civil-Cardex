/** Modal de importación del Perfil de presiones al EPC (ped. 2026-11-20, port del imp-modal
 *  del HTML de referencia): revisión TODO-O-NADA de los 7 datos. Fuente: el doc que el Perfil V32
 *  publica en localStorage 'civilflow_perfil_epc' (otra pestaña) o la tabla pegada
 *  («Copiar para Excel»). Un dato ausente, en cero o incoherente bloquea TODA la carga;
 *  las advertencias de diseño no bloquean. «Ignorar estos datos» guarda el ts del Perfil
 *  para que el aviso no vuelva hasta que cambie. */
import React, { useMemo, useState } from 'react';
import { ModalShell } from '../../../../components/shared/ModalShell.tsx';
import { apLim, apMatch } from './epAparatos.ts';

const PERFIL_KEY = 'civilflow_perfil_epc';

/** Los 7 datos que entrega el Perfil (apcrit informativo). */
const CAMPOS: Array<{ k: string; lbl: string; tipo: 'q' | 'p' | 'z' }> = [
  { k: 'qac', lbl: 'Caudal diseño AC (Qac)', tipo: 'q' },
  { k: 'hfac', lbl: 'Pérdidas red AC (Hf_ac)', tipo: 'p' },
  { k: 'pmin', lbl: 'Presión mínima punto crítico (Pmin)', tipo: 'p' },
  { k: 'pmax', lbl: 'Presión máxima sistema (Pmáx)', tipo: 'p' },
  { k: 'zbomba', lbl: 'Cota de la descarga (z_bomba)', tipo: 'z' },
  { k: 'ztop', lbl: 'Cota punto más desfavorable (z_top)', tipo: 'z' },
  { k: 'poffmax', lbl: 'P parada máxima admisible', tipo: 'p' },
];

/** Documento del Perfil de presiones publicado (localStorage): de dónde salió, cuándo (ts) y los 7 datos. Ej: {fuente:'perfil', ts:1731800000000, datos:{qac:1.8, …}}. */
export interface PerfilDoc {
  fuente: 'perfil' | 'pegado';
  ts: number;
  v: string;
  estado?: 'ok' | 'no-aplica';
  motivo?: string;
  provisional?: boolean;
  datos: Record<string, number | string>;
}

/** Lee números con coma o punto decimal (12,80 · 12.80 · 1.234,5 · 1,234.5) — auditoría V10. */
export function numES(t: string): number {
  const m = String(t)
    .replace(/\s/g, '')
    .match(/[-−]?[\d.,]*\d/);
  if (!m) return NaN;
  let x = m[0].replace('−', '-');
  const c = x.lastIndexOf(','),
    d = x.lastIndexOf('.');
  if (c >= 0 && d >= 0) x = c > d ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
  else if (c >= 0) x = x.split(',').length > 2 ? x.replace(/,/g, '') : x.replace(',', '.');
  else if (x.split('.').length > 2) x = x.replace(/\./g, '');
  return parseFloat(x);
}

/** Lee el doc publicado por el Perfil (otra pestaña del mismo navegador). */
export function leerPerfil(): PerfilDoc | null {
  try {
    const x = JSON.parse(localStorage.getItem(PERFIL_KEY) || 'null') as PerfilDoc | null;
    return x && x.datos && x.ts ? x : null;
  } catch {
    return null;
  }
}

/** Unidad escrita en la celda → factor a m.c.a. / L/s / m. null = desconocida. */
function unidadDe(t: string, tipo: 'q' | 'p' | 'z'): number | null {
  const s = String(t).toLowerCase();
  if (tipo === 'q') {
    if (/l\/s/.test(s)) return 1;
    if (/m³\/h|m3\/h/.test(s)) return 1 / 3.6;
    if (/gpm/.test(s)) return 1 / 15.85;
    return null;
  }
  if (tipo === 'p') {
    if (/m\.?\s?c\.?\s?a|mca/.test(s)) return 1;
    if (/kpa/.test(s)) return 1 / 9.80665;
    if (/psi/.test(s)) return 1 / 1.42197;
    if (/bar/.test(s)) return 1 / 0.0980665;
    return null;
  }
  if (/\bm\b|m$/.test(s.replace(/m\.?c\.?a\.?/, ''))) return 1;
  return null;
}

/** Parsea la tabla pegada del Perfil (líneas Dato<TAB>Valor<TAB>…). */
export function revisarPegado(texto: string): {
  datos: Record<string, number | string>;
  errores: Record<string, string>;
  reconocidos: number;
} {
  const datos: Record<string, number | string> = {};
  const errores: Record<string, string> = {};
  let reconocidos = 0;
  for (const linea of texto.split(/\r?\n/)) {
    const c = linea.split('\t');
    if (c.length < 2) continue;
    const it = CAMPOS.find((x) => c[0].trim().startsWith(x.lbl));
    if (!it) continue;
    reconocidos++;
    const v = numES(c[1]);
    const f = unidadDe(c[1], it.tipo);
    if (isNaN(v)) errores[it.k] = 'Sin valor en el Perfil';
    else if (f == null) errores[it.k] = `Unidad no reconocida («${c[1].trim()}»)`;
    else datos[it.k] = v * f;
    if (it.k === 'pmin' && c[2]) {
      const ap = c[2].split('·')[0].trim();
      if (ap && !/^Nudo/i.test(ap)) datos.apcrit = ap;
    }
  }
  return { datos, errores, reconocidos };
}

/** Fila de la tabla de revisión todo-o-nada: valor actual vs nuevo y su estado (ok/aviso/error). */
export interface FilaRev {
  k: string;
  lbl: string;
  un: string;
  actual: string;
  nuevo: string;
  st: 'ok' | 'wa' | 'er';
  m: string;
}

/** Resultado de la revisión: las filas + conteos por estado y si la importación es segura. */
export interface RevRes {
  rows: FilaRev[];
  nEr: number;
  nWa: number;
  ok: boolean;
  msg: string;
}

/** Revisión TODO-O-NADA contra los valores actuales del formulario + reglas cruzadas. */
export function validarPerfil(
  P: PerfilDoc,
  actual: Record<string, string>,
  mrgDif: { margen: string; dif: string },
  fmt: (v: number) => string,
): RevRes {
  const rows: FilaRev[] = [];
  let nEr = 0,
    nWa = 0;
  if (P.estado && P.estado !== 'ok')
    return {
      rows,
      nEr: 1,
      nWa: 0,
      ok: false,
      msg: P.motivo || 'El Perfil no entrega datos para un EPC (fuente sin bombeo).',
    };
  const D = P.datos || {};
  for (const { k, lbl, tipo } of CAMPOS) {
    const v = D[k] as number | undefined;
    const curS = actual[k] ?? '';
    const cur = curS.trim() === '' ? null : numES(curS);
    let st: FilaRev['st'] = 'ok';
    let m = '✓';
    if (!(typeof v === 'number' && isFinite(v) && v > 0) && tipo !== 'z') {
      st = 'er';
      m = v == null ? 'No viene en el Perfil' : 'Valor cero o negativo';
    } else if (typeof v !== 'number' || !isFinite(v)) {
      st = 'er';
      m = 'No viene en el Perfil';
    }
    const un = tipo === 'q' ? 'L/s' : tipo === 'z' ? 'm' : 'm.c.a.';
    const show = (x: number | null | undefined): string =>
      x == null || !isFinite(x) ? '—' : fmt(x);
    let ch = '';
    if (
      st === 'ok' &&
      cur != null &&
      isFinite(cur) &&
      Math.abs(cur - v!) > 0.01 + 0.002 * Math.abs(v!)
    )
      ch = ` · reemplaza ${show(cur)}`;
    if (st === 'er') nEr++;
    rows.push({ k, lbl, un, actual: show(cur), nuevo: show(v), st, m: m + ch });
  }
  const g = (k: string): number => Number(D[k]) || 0;
  if (!nEr) {
    const pd = g('ztop') - g('zbomba') + g('hfac') + g('pmin');
    const need = pd + (numES(mrgDif.margen) || 0) + (numES(mrgDif.dif) || 0);
    if (D.poffmax != null && g('poffmax') < need) {
      const row = rows.find((r) => r.k === 'poffmax');
      if (row) {
        row.st = 'wa';
        row.m = `No cabe la banda del variador: P mín. descarga + margen + banda = ${fmt(need)} m.c.a.`;
        nWa++;
      }
    }
    if (D.apcrit) {
      const lim = apLim(apMatch(String(D.apcrit)));
      const row = rows.find((r) => r.k === 'pmin');
      if (lim && row && row.st === 'ok') {
        const v = g('pmin');
        if (v < lim.min - 0.05 || v > lim.max + 0.05) {
          row.st = 'er';
          row.m = `Fuera del rango de «${lim.nombre}» (${lim.min.toFixed(2)}–${lim.max.toFixed(2)} m.c.a.)`;
          nEr++;
        } else if (v < lim.confort - 0.05) {
          row.st = 'wa';
          row.m = `Por debajo del confort de «${lim.nombre}» (${lim.confort.toFixed(2)} m.c.a.): grifería de baja presión`;
          nWa++;
        }
      }
    }
  }
  const ok = nEr === 0;
  const msg = ok
    ? nWa
      ? `Se pueden cargar los ${CAMPOS.length} datos, con ${nWa} advertencia${nWa > 1 ? 's' : ''} de diseño.`
      : `Todo listo: se cargan los ${CAMPOS.length} datos.`
    : `No se puede cargar: ${nEr} dato${nEr > 1 ? 's' : ''} con error. No se carga ninguno; corrija en el Perfil, recalcule y vuelva a importar.`;
  return { rows, nEr, nWa, ok, msg };
}

interface Props {
  ep: Record<string, string>;
  /** Margen y banda actuales del formulario (para verificar que la banda cabe en poffmax). */
  mrgDif: { margen: string; dif: string };
  cargar: (doc: PerfilDoc) => void;
  onIgnorar: () => void;
  cerrar: () => void;
}

/** Modal de importación. Ej: <EpProfileImportModal ep={ep} margen={ep.margen} dif={ep.dif}
 *  cargar={cargarPerfil} onIgnorar={…} cerrar={…}/> con el estilo .ep-imp/.ep-rev-tab. */
const fmt = (v: number): string =>
  isFinite(v)
    ? v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

export function EpProfileImportModal({
  ep,
  mrgDif,
  cargar,
  onIgnorar,
  cerrar,
}: Props): React.JSX.Element {
  const [pegado, setPegado] = useState('');
  const [docPegado, setDocPegado] = useState<PerfilDoc | null>(null);
  const perfil = leerPerfil();
  const doc: PerfilDoc | null = docPegado ?? (perfil && perfil.datos && perfil.ts ? perfil : null);

  const rev = useMemo(
    () =>
      doc
        ? validarPerfil(
            doc,
            {
              qac: ep.qac ?? '',
              hfac: ep.hfac ?? '',
              pmin: ep.pmin ?? '',
              pmax: ep.pmax ?? '',
              zbomba: ep.zbomba ?? '',
              ztop: ep.ztop ?? '',
              poffmax: ep.poffmax ?? '',
            },
            mrgDif,
            fmt,
          )
        : null,

    [doc, ep.qac, ep.hfac, ep.pmin, ep.pmax, ep.zbomba, ep.ztop, ep.poffmax, mrgDif],
  );

  const revisarTexto = (): void => {
    const r = revisarPegado(pegado);
    if (!r.reconocidos) {
      setDocPegado({
        fuente: 'pegado',
        ts: Date.now(),
        v: 'texto pegado',
        estado: 'ok',
        datos: {},
      });
      return;
    }
    setDocPegado({
      fuente: 'pegado',
      ts: Date.now(),
      v: 'texto pegado',
      estado: 'ok',
      provisional: !r.datos.apcrit,
      datos: r.datos,
    });
  };

  return (
    <ModalShell ariaLabel="Importar datos del Perfil de presiones" minWidth={640}>
      <div className="ep-imp">
        <h3 className="ep-imp-h">Datos del Perfil de presiones · revisar y cargar</h3>
        <div className={`ep-rev-src${!doc ? ' ep-rev-no' : ''}`}>
          {doc ? (
            <>
              <b>{doc.fuente === 'pegado' ? 'Texto pegado' : 'Perfil de presiones'}</b> ·{' '}
              {new Date(doc.ts).toLocaleString('es-CO')}
              {doc.datos?.apcrit ? <> · punto crítico: {String(doc.datos.apcrit)}</> : null}
            </>
          ) : (
            'No hay datos del Perfil en este navegador: abra el Perfil de presiones y calcule (Resumen). Si usa otro navegador u otro equipo, pegue la tabla abajo.'
          )}
        </div>
        {doc && rev ? (
          <>
            <table className="ep-rev-tab">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Actual</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rev.rows.map((r) => (
                  <tr key={r.k}>
                    <td>{r.lbl}</td>
                    <td className="n">{r.actual}</td>
                    <td className="n">
                      <b>{r.nuevo}</b> <span className="ep-dim">{r.un}</span>
                    </td>
                    <td className={`ep-${r.st}`}>
                      {r.st === 'ok' ? '✓' : r.st === 'wa' ? '⚠' : '✗'} {r.st !== 'ok' ? r.m : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`ep-rev-msg ep-rev-${rev.ok ? (rev.nWa ? 'wa' : 'ok') : 'er'}`}>
              {rev.msg}
            </div>
          </>
        ) : null}
        <details open={!doc}>
          <summary>
            Alternativa: pegar la tabla copiada del Perfil (otro navegador u otro equipo)
          </summary>
          <p className="ep-dim">
            En el Perfil → Resumen → «Datos para el EPC» → «Copiar para Excel», pegue aquí y pulse
            «Revisar texto pegado».
          </p>
          <textarea
            className="ep-imp-txt"
            rows={6}
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            aria-label="Tabla del Perfil pegada"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="ep-btn-lt" onClick={revisarTexto}>
              Revisar texto pegado
            </button>
          </div>
        </details>
        <div className="ep-imp-btns">
          <button type="button" className="ep-btn-lt" onClick={onIgnorar} disabled={!doc}>
            Ignorar estos datos
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="ep-btn-lt" onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="ep-btn-az"
            disabled={!doc || !rev || !rev.ok}
            onClick={() => {
              if (doc) cargar(doc);
              cerrar();
            }}
          >
            Cargar datos
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
