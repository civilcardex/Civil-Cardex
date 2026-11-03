/**
 * Red del piso por ramales y nudos (árbol): cada ramal es una unidad de un solo diámetro, sus
 * rociadores que fluyen se calculan nudo a nudo desde la punta y en cada nudo gobierna la mayor
 * presión requerida; los demás aportes se equilibran con su K equivalente (Q = K·√P).
 * Ej: en el nudo A del ejemplo gobierna R1 con 20.29 psi y R2 se equilibra a esa presión.
 */
import { NOM, PIPES } from './tables';
import { num, route, suggestDn } from './hydraulics';
import type {
  CalcCtx,
  Criterios,
  Inflow,
  NudoCalc,
  RamalCalc,
  Red,
  RedResult,
  RouteResult,
  TuberiaRow,
  TramoCalc,
} from './types';

/** Calcula un ramal: brazo = L (punta → conexión) − (fluyen − 1)·S, rociadores con q = K·√P y
 *  todos los accesorios del ramal en el brazo. Devuelve las filas y la ruta con su Keq. */
export function calcRamal(
  x: RamalCalc,
  ro: Criterios,
  ctx: CalcCtx,
): { rows: TuberiaRow[]; res: RouteResult } {
  const r = x.rEff || x.r,
    mat = r.mat || 'Acero SCH 40',
    S = num(r.S) || ro.S,
    n = x.fl;
  const zr = num(r.zr) || 0,
    zc = num(r.zc) ?? zr;
  /* Brazo = L del ramal (punta → conexión) − (fluyen − 1)·S. Proyectos antiguos traen el brazo directo. */
  const Lr = num(r.Lr),
    brazo = Lr !== null ? Lr - (n - 1) * S : num(r.brazo);
  x.brazo = brazo;
  const con = String(r.con || '').trim() || '?';
  const build = (dn: string) => {
    const rows: TuberiaRow[] = [];
    for (let j = 0; j < n; j++) {
      const last = j === n - 1,
        a = x.n0 + j;
      rows.push(
        last
          ? {
              ni: String(a),
              nf: con,
              roc: true,
              mat,
              dn,
              L: brazo === null ? '' : brazo,
              c45: r.c45,
              c90: r.c90,
              clr: r.clr,
              tee: r.tee,
              mar: r.mar,
              comp: r.comp,
              ret: r.ret,
              esp: r.esp,
              leqOtros: r.leqOtros,
              zi: zr,
              zf: zc,
            }
          : { ni: String(a), nf: String(a + 1), roc: true, mat, dn, L: S, zi: zr, zf: zr },
      );
    }
    return rows;
  };
  const sizes = NOM.filter((d) => PIPES[mat] && PIPES[mat][d] && PIPES[mat][d].inch >= 1);
  let dn = r.dn && r.dn !== 'auto' ? r.dn : suggestDn(n * ro.Q1 * 1.1, mat, ctx.Vmax);
  let rows = build(dn),
    res = route(rows, ro.Prem, 0, ctx, 'ramal');
  if (!r.dn || r.dn === 'auto') {
    let i = sizes.indexOf(dn);
    while (
      res.valid &&
      Math.max(...res.rows.map((o) => (o as { V?: number }).V || 0)) > ctx.Vmax + 1e-9 &&
      i < sizes.length - 1
    ) {
      dn = sizes[++i];
      rows = build(dn);
      res = route(rows, ro.Prem, 0, ctx, 'ramal');
    }
  }
  res.Keq = res.valid && res.Pend > 0 ? res.Qend / Math.sqrt(res.Pend) : 0;
  res.dn = dn;
  res.Vmax = Math.max(0, ...res.rows.map((o) => (o as { V?: number }).V || 0));
  return { rows, res };
}

/** Resuelve la red del piso: reparte los rociadores que fluyen desde el primer ramal (el más
 *  remoto), calcula ramales y tramos hasta la raíz (derivación del montante) y equilibra los
 *  aportes en cada nudo. Ej: la red "A" del ejemplo cierra en C con 128.54 gpm a 37.70 psi. */
export function computeRed(
  red: Red | undefined,
  root: string,
  ro: Criterios,
  ctx: CalcCtx,
): RedResult {
  red = red || { ramales: [], tramos: [] };
  const errs: string[] = [];
  root = String(root || '').trim();
  /* Cotas por nudo (modelo actual): una cota por nudo y una cota común de los ramales; los proyectos antiguos traen cotas por fila */
  const porNudo = !!red.nodos,
    zRam = num(red.zRam) ?? 0;
  const zNode = (nm: string): number => {
    const v = red!.nodos && red!.nodos[nm] ? num(red!.nodos[nm].z) : null;
    return v !== null ? v : nm === root && num(ctx.hD) !== null ? (num(ctx.hD) as number) : zRam;
  };
  /* Rociadores que fluyen: los indicados, o automáticamente desde el primer ramal (el más remoto) hasta completar el área */
  let rem = ro.Nreq;
  const rams: RamalCalc[] = red.ramales.map((r, i) => {
    const dib = num(r.dib);
    let fl = num(r.fluyen);
    const auto = fl === null;
    if (auto)
      fl = Math.max(0, Math.min(Math.max(ro.Nramal, 1), dib === null ? Infinity : dib, rem));
    fl = Math.max(0, Math.round(fl as number));
    rem -= fl;
    return {
      r,
      i,
      id: 'RM' + (i + 1),
      nombre: r.nombre || `Ramal ${i + 1}`,
      dib,
      fl,
      auto,
      n0: 0,
      n1: 0,
      brazo: null,
    };
  });
  let k = 0;
  rams.forEach((x) => {
    x.n0 = k + 1;
    k += x.fl;
    x.n1 = k;
  });
  const nodes: Record<string, NudoCalc> = {},
    node = (nm: string): NudoCalc =>
      (nodes[nm] = nodes[nm] || { nombre: nm, inflows: [], out: null });
  rams.forEach((x) => {
    if (x.fl <= 0) return;
    if (porNudo) {
      const zr = num(x.r.zr) ?? zRam;
      x.rEff = Object.assign({}, x.r, {
        mat: x.r.mat || red!.mat || 'Acero SCH 40',
        zr,
        zc: zNode(String(x.r.con || '').trim()),
      });
    }
    const c = calcRamal(x, ro, ctx);
    x.rows = c.rows;
    x.res = c.res;
    const con = String(x.r.con || '').trim();
    if (!con) {
      errs.push(`${x.nombre}: falta el nudo de conexión.`);
      return;
    }
    if (x.brazo !== null && x.brazo < 0) {
      errs.push(
        `${x.nombre}: la L del ramal (${num(x.r.Lr)} m) no alcanza para ${x.fl} rociadores con flujo a ${(num(x.r.S) || ro.S).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m. Revise la longitud o los rociadores que fluyen.`,
      );
      x.res!.valid = false;
      return;
    }
    if (x.res!.valid) node(con).inflows.push({ tipo: 'ramal', x, P: x.res!.Pend, Q: x.res!.Qend });
    else {
      let bad: { err?: string } | undefined;
      for (const o of x.res!.rows) {
        if (!o.ok) {
          bad = o;
          break;
        }
      }
      errs.push(`${x.nombre}: datos incompletos (${(bad || {}).err || 'revise'}).`);
    }
  });
  const tramos: TramoCalc[] = (red.tramos || []).map((t, i) => ({
    t,
    i,
    de: String(t.de || '').trim(),
    a: String(t.a || '').trim(),
  }));
  tramos.forEach((y) => {
    if (!y.de || !y.a) errs.push(`Tramo ${y.i + 1}: indique el nudo inicial y el final.`);
    else {
      if (node(y.de).out)
        errs.push(
          `El nudo ${y.de} tiene más de un tramo de salida: la red debe ser ramificada (un solo camino a la bomba).`,
        );
      node(y.de).out = y;
      node(y.a);
    }
  });
  const solve = (nd: NudoCalc): boolean => {
    if (!nd.inflows.length) return false;
    nd.P = Math.max(...nd.inflows.map((f) => f.P));
    nd.inflows.forEach((f) => {
      f.Qb = f.Q * Math.sqrt(nd.P! / f.P);
    });
    nd.Q = nd.inflows.reduce((a, f) => a + (f.Qb as number), 0);
    nd.gov = nd.inflows.reduce((a, f) => (f.P > a.P ? f : a));
    nd.solved = true;
    return true;
  };
  const pend = new Set(tramos.filter((y) => y.de && y.a));
  let prog = true;
  while (prog && pend.size) {
    prog = false;
    for (const y of [...pend]) {
      /* ¿Hay otro tramo pendiente que descargue en y.de? Primer match, como el .some del HTML. */
      let waiting = false;
      for (const z of tramos) {
        if (pend.has(z) && z !== y && z.a === y.de) {
          waiting = true;
          break;
        }
      }
      if (waiting) continue;
      const nd = node(y.de);
      pend.delete(y);
      prog = true;
      if (!solve(nd)) {
        errs.push(`Al nudo ${y.de} no llega ningún ramal con flujo.`);
        y.res = null;
        continue;
      }
      const row: TuberiaRow = Object.assign(
        {},
        y.t,
        { ni: y.de, nf: y.a },
        porNudo ? { zi: zNode(y.de), zf: zNode(y.a) } : {},
      );
      y.res = route([row], nd.P!, nd.Q!, ctx, 'alim');
      y.row = row;
      if (y.res.valid) node(y.a).inflows.push({ tipo: 'tramo', y, P: y.res.Pend, Q: nd.Q! });
      else
        errs.push(
          `Tramo ${y.de} → ${y.a}: ${((y.res.rows[0] || {}) as { err?: string }).err || 'datos incompletos'}.`,
        );
    }
  }
  if (pend.size)
    errs.push(
      `Tramos sin resolver (${[...pend].map((y) => y.de + '→' + y.a).join(', ')}): revise que no haya ciclos.`,
    );
  if (!root) errs.push('Falta el nudo final de la red del piso.');
  Object.values(nodes).forEach((nd) => {
    if (nd.nombre !== root && !nd.out && nd.inflows.length)
      errs.push(
        `El nudo ${nd.nombre} no tiene salida: conéctelo con un tramo hacia ${root || 'el nudo de alimentación'}.`,
      );
  });
  const rt = root ? node(root) : null;
  if (rt && rt.out)
    errs.push(
      `La derivación ${root} tiene un tramo de salida (${root} → ${rt.out.a}): la red del piso termina en ${root}. Elimine ese tramo o elija otra derivación.`,
    );
  if (rt && !solve(rt)) errs.push(`Ningún ramal llega al nudo ${root}.`);
  /* Equilibrio: presión real en cada nudo y caudal real de cada aporte */
  const push = (nd: NudoCalc, P: number): void => {
    nd.Peq = P;
    nd.inflows.forEach((f: Inflow) => {
      const fac = Math.sqrt(P / f.P);
      if (f.tipo === 'ramal') {
        f.x.Qeq = f.Q * fac;
        f.x.Peq = P;
      } else {
        f.y.Qeq = f.Q * fac;
        const up = node(f.y.de);
        if (up.solved) push(up, up.P! * fac * fac);
      }
    });
  };
  if (rt && rt.solved) push(rt, rt.P!);
  const conn = rams.filter((x) => x.res && x.Qeq !== undefined);
  return {
    rams,
    tramos,
    nodes,
    root,
    rt,
    errs,
    Nop: conn.reduce((a, x) => a + x.fl, 0),
    dibTot: rams.reduce((a, x) => a + (x.dib || 0), 0),
    flTot: rams.reduce((a, x) => a + x.fl, 0),
    desc: `${rams.filter((x) => x.fl > 0).length} ramales con flujo (${rams
      .filter((x) => x.fl > 0)
      .map((x) => x.fl)
      .join(' + ')}) hacia el nudo ${root || '?'}`,
  };
}
