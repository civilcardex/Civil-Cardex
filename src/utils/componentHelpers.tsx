interface Tramo {
  id: string;
  fixtures: Record<string, number>;
  recibeDe?: string[];
}

interface UDBase {
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

export function calcUDacumulado(tramos: Tramo[], udB: UDBase[]): Record<string, number> {
  const resueltos: Record<string, number> = {};
  const maxIter = tramos.length * 2;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const t of tramos) {
      if (resueltos[t.id] !== undefined) continue;
      const parcial = calcUDparcial(t, udB);
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
    if (resueltos[t.id] === undefined) resueltos[t.id] = calcUDparcial(t, udB);
  }
  return resueltos;
}

export function calcUCparcial(tramo: Tramo, baseArr: UCBase[], field: string): number {
  return baseArr.reduce((s, d) => s + ((tramo.fixtures[d.id] || 0) * (Number(d[field]) || 0)), 0);
}

export function calcUCacumulado(tramos: Tramo[], baseArr: UCBase[], field: string): Record<string, number> {
  const resueltos: Record<string, number> = {};
  const maxIter = tramos.length * 2;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const t of tramos) {
      if (resueltos[t.id] !== undefined) continue;
      const parcial = calcUCparcial(t, baseArr, field);
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
    if (resueltos[t.id] === undefined) resueltos[t.id] = calcUCparcial(t, baseArr, field);
  }
  return resueltos;
}

export function NumIn({ val, onChange, cls = '', w = 52, step = 0.01, min = 0, inputStyle }: {
  val: number;
  onChange: (v: number) => void;
  cls?: string;
  w?: number;
  step?: number;
  min?: number;
  inputStyle?: Record<string, unknown>;
}) {
  return <input type="number" className={`ni ${cls}`} style={{ width: w, ...inputStyle }}
    value={val === 0 ? '' : val} step={step} min={min}
    onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} />;
}
