/** Cabecera compartida de la tipología activa para Criterios, Rectángulo de fuego y
 *  Hidráulica: un solo selector (Tipologías · rango de pisos) con el representativo, la cota
 *  y el estado de la red. `modo="header"` es la versión compacta que va DENTRO del encabezado
 *  de «Ramales del piso», en lugar del texto «tipología T1». Cambiar aquí NO cambia el plano
 *  abierto en Dibujo. Ej: T1 · P1 → «Pisos del edificio» enfoca el piso base. */
import type { CSSProperties } from 'react';
import { ChipEstado, useNavRci, type RciCtx } from './RCIUI.tsx';
import { rangoTipologia } from '../../utils/rci/RCIRowsModelExtras.ts';
import { fmtEs as f1 } from '../../lib/rci/fmtEs.ts';

const BARRA: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
  padding: '6px 10px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 6,
};
/** Versión inline para el header de la tabla: sin caja, sin rótulo «PISO DE CÁLCULO». */
const EN_HEADER: CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  fontWeight: 400,
};
const ETIQUETA: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '.04em',
  color: 'var(--txt3)',
  fontFamily: 'var(--mono)',
};
const ENLACE: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg4)',
  color: 'var(--txt2)',
  borderRadius: 5,
  fontSize: 11.5,
  padding: '3px 9px',
  cursor: 'pointer',
};
const SELECT: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 5,
  padding: '2px 7px',
  fontSize: 11.5,
  fontFamily: 'var(--body)',
  color: 'var(--txt)',
  background: 'var(--bg2)',
};

/** Chip de estado de la red de la tipología (Calculada / Sin red / Incompleta). */
function EstadoRed({ ctx, tipId }: { ctx: RciCtx; tipId: string }) {
  const t = ctx.R.edif.typ[tipId];
  if (!t) return <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Sin red</span>;
  return (
    <ChipEstado
      st={t.ok ? 'CUMPLE' : t.pend ? 'REVISAR' : 'NO CUMPLE'}
      label={t.ok ? 'Red calculada' : t.pend ? 'Sin red' : 'Red incompleta'}
    />
  );
}

export function TipologyHeader({
  ctx,
  modo = 'tipologia',
}: {
  ctx: RciCtx;
  /** 'header' = versión compacta dentro del encabezado de Ramales del piso. */
  modo?: 'tipologia' | 'hidraulica' | 'header';
}) {
  const { irA } = useNavRci();
  const compacto = modo === 'header';
  const rows = ctx.estado.pisos.rows;
  const grupos = ctx.tips.groups;
  const g = ctx.R.edif.active?.g ?? grupos.find((x) => x.id === ctx.tips.activeId) ?? null;
  const hayPisos = rows.length > 0;
  const sinRociadores = hayPisos && grupos.length === 0;
  const rep = g && rows[g.rep] ? rows[g.rep] : null;
  const style = compacto ? EN_HEADER : BARRA;
  const rotulo = modo === 'hidraulica' ? 'PISO DE CÁLCULO' : compacto ? null : 'TIPOLOGÍA';

  if (sinRociadores) {
    return (
      <div style={style}>
        {rotulo ? <span style={ETIQUETA}>{rotulo}</span> : null}
        <b style={{ fontSize: 12.5, color: 'var(--txt)' }}>Sin pisos con rociadores</b>
        {compacto ? null : (
          <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
            Marque al menos un piso con riesgo NFPA 13 (no «Sin rociadores»).
          </span>
        )}
      </div>
    );
  }

  if (!g) {
    return (
      <div style={style}>
        {rotulo ? <span style={ETIQUETA}>{rotulo}</span> : null}
        <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
          {hayPisos ? 'Sin tipología calculada.' : 'Sin pisos registrados: confirme planos.'}
        </span>
      </div>
    );
  }

  const elegir = (id: string): void => {
    if (id === g.id) return;
    /* Con el callback del padre se cambia ADEMÁS el piso activo del visor: ambos desplegables
       coinciden siempre. Sin él (usos aislados) al menos se cambia la tipología. */
    if (ctx.seleccionarTipologia) ctx.seleccionarTipologia(id);
    else ctx.editar((e) => ({ ...e, pisos: { ...e.pisos, activa: id } }));
  };
  const irAlBase = (): void => irA('tipologias', 'pisos', `piso:${g.base}:riesgo`);

  return (
    <div style={style}>
      {rotulo ? <span style={ETIQUETA}>{rotulo}</span> : null}
      {grupos.length > 1 ? (
        <select
          value={g.id}
          onChange={(e) => elegir(e.target.value)}
          aria-label="Tipología activa"
          style={compacto ? SELECT : { ...SELECT, fontSize: 12, padding: '3px 8px' }}
        >
          {grupos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id} · {rangoTipologia(x, rows)}
            </option>
          ))}
        </select>
      ) : (
        <b style={{ fontSize: 12.5, color: 'var(--txt)' }}>
          {g.id} · {rangoTipologia(g, rows)}
        </b>
      )}
      <button type="button" onClick={irAlBase} style={ENLACE}>
        Pisos del edificio
      </button>
      {modo !== 'tipologia' ? (
        <>
          <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
            Representativo <b style={{ color: 'var(--txt2)' }}>{rep?.nombre || '—'}</b>
            {rep && rep.npt !== '' && rep.npt != null ? ` · NPT ${f1(Number(rep.npt), 2)} m` : ''}
          </span>
          <EstadoRed ctx={ctx} tipId={g.id} />
        </>
      ) : null}
      {modo === 'tipologia' ? (
        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
          Datos del piso base {rows[g.base]?.nombre || ''} · editables en Pisos del edificio
        </span>
      ) : null}
    </div>
  );
}
