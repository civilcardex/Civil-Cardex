import type { Tramo } from '../context/TramosContext';
const componentHelpers_S1: React.CSSProperties = { color: 'var(--ok)', background: 'rgba(47, 248, 1, 0.08)', border: '1px solid rgba(47, 248, 1, 0.15)', padding: '1px 5px', borderRadius: '3px', fontWeight: 600, fontSize: '9px', fontFamily: 'var(--mono)', display: 'inline-block' };
const componentHelpers_S2: React.CSSProperties = { color: 'var(--err)', background: 'rgba(255, 180, 171, 0.08)', border: '1px solid rgba(255, 180, 171, 0.15)', padding: '1px 5px', borderRadius: '3px', fontWeight: 600, fontSize: '9px', fontFamily: 'var(--mono)', display: 'inline-block', whiteSpace: 'nowrap' };


export interface UDBase {
  id: string;
  ud: number;
}

interface UCBase {
  id: string;
  [key: string]: unknown;
}

export function calcUDparcial(tramo: Tramo, udB: UDBase[]): number {
  return udB.reduce((s, d) => s + ((tramo.fixtures[d.id] || 0) * d.ud), 0);
}

export function calcUCparcial(tramo: Tramo, baseArr: UCBase[], field: string): number {
  return baseArr.reduce((s, d) => s + ((tramo.fixtures[d.id] || 0) * (Number(d[field]) || 0)), 0);
}

function calcAcumulado(tramos: Tramo[], calcParcial: (t: Tramo) => number): Record<string, number> {
  const resueltos: Record<string, number> = {};
  const maxIter = tramos.length * 2;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const t of tramos) {
      if (resueltos[t.id] !== undefined) continue;
      const parcial = calcParcial(t);
      if ((t.recibeDe || []).length === 0) {
        resueltos[t.id] = parcial;
        changed = true;
      } else {
        const deps = t.recibeDe || [];
        if (deps.every(d => resueltos[d] !== undefined)) {
          const otros = deps.reduce((s, d) => s + (resueltos[d] || 0), 0);
          resueltos[t.id] = parcial + otros;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const t of tramos) {
    if (resueltos[t.id] === undefined) resueltos[t.id] = calcParcial(t);
  }
  return resueltos;
}

export function calcUCacumulado(tramos: Tramo[], baseArr: UCBase[], field: string): Record<string, number> {
  return calcAcumulado(tramos, (t) => calcUCparcial(t, baseArr, field));
}

export function renderStatus(val: string) {
  const ok = val === 'O.K.' || val === 'Ok' || val === 'OK';
  const fail = val === 'NO CUMPLE' || val === 'No cumple' || val === 'NO';
  if (ok) {
    return (
      <span style={componentHelpers_S1}>
        {val}
      </span>
    );
  }
  if (fail) {
    return (
      <span style={componentHelpers_S2}>
        {val}
      </span>
    );
  }
  return <span style={{ color: 'var(--txt3)' }}>{val}</span>;
}

