/**
 * Edificio: agrupa los pisos en tipologías (clasificar) y calcula una red por tipología
 * (edificio), generando la ruta del montante NFPA 14 (standpipe) desde la derivación de cada
 * piso hasta la brida de la bomba, más la ruta de gabinetes. Ej: los 3 pisos del ejemplo
 * comparten criterios y planta → una sola tipología T1 con representativo P3 (el más alto).
 */
import { NOM, PIPES } from './tables';
import { isSi, num, route, suggestDn } from './hydraulics';
import { criterios } from './criteria';
import { computeRed } from './network';
import type {
  CalcCtx,
  Criterios,
  Edificio,
  MontCfg,
  NumIn,
  PisoOut,
  PisoRow,
  PisoRowF,
  RciState,
  Tips,
  TipCalc,
  Tipologia,
  TuberiaRow,
} from './types';

/** Redondeo a 2 decimales para las llaves de agrupación (evita que 6.1 vs 6.100001 separe pisos). */
const r2 = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100) / 100;
};

/** Llave de criterios de un piso: riesgo, sistema, techo, QR, construcción, pendiente, ocultos,
 *  K, S, L, DMR (distancia máxima de rociador a muro) (+ planta). Pisos con la misma llave y
 *  planta comparten tipología y red. */
const critKey = (
  p: {
    riesgo: string;
    sistema: string;
    htecho: NumIn;
    qr: string;
    constr: string;
    techoIncl: string;
    ocultoComb: string;
    K: NumIn;
    S: NumIn;
    L: NumIn;
    Dmuro?: NumIn;
    planta?: string;
  },
  planta = true,
): string | null =>
  p.riesgo === 'Sin rociadores'
    ? null
    : JSON.stringify([
        p.riesgo,
        p.sistema,
        r2(p.htecho),
        p.qr,
        p.constr,
        p.techoIncl,
        p.ocultoComb,
        r2(p.K),
        r2(p.S),
        r2(p.L),
        r2(p.Dmuro),
        ...(planta
          ? [
              String(p.planta || '')
                .trim()
                .toUpperCase(),
            ]
          : []),
      ]);

/** Agrupa st.pisos.rows en tipologías: primero los pisos en "Auto" por llave de criterios,
 *  luego los forzados (tip ≠ "auto"). El representativo es, por defecto, el piso más alto. */
export function clasificar(st: RciState): Tips {
  const P = st.pisos,
    rows = P.rows;
  const nv = (i: number): number => {
    const n = num(rows[i].npt);
    return n === null ? 1e9 : n;
  };
  const idx = rows.map((_, i) => i).sort((a, b) => nv(a) - nv(b));
  const groups: Tipologia[] = [],
    byKey: Record<string, Tipologia> = {},
    tipOf: (string | null)[] = rows.map(() => null);
  /* Índice id → tipología: mismo papel del groups.find del HTML (los ids son únicos T1..Tn). */
  const porId = new Map<string, Tipologia>();
  const newGroup = (k: string | null): Tipologia => {
    const g: Tipologia = {
      id: 'T' + (groups.length + 1),
      key: k,
      pisos: [],
      mixed: [],
      base: 0,
      auto: true,
      highest: 0,
      rep: 0,
      roc: null as unknown as Criterios,
      hts: [],
      enEntradas: false,
      planta: 'A',
      riesgo: '',
    };
    groups.push(g);
    porId.set(g.id, g);
    if (k) byKey[k] = byKey[k] || g;
    return g;
  };
  idx.forEach((i) => {
    const p = rows[i],
      k = critKey(p);
    if (k === null || (p.tip && p.tip !== 'auto')) return;
    (byKey[k] || newGroup(k)).pisos.push(i);
  });
  idx.forEach((i) => {
    const p = rows[i],
      k = critKey(p);
    if (k === null || !p.tip || p.tip === 'auto') return;
    const g = (p.tip ? porId.get(p.tip) : undefined) || byKey[k] || newGroup(k);
    g.pisos.push(i);
  });
  groups.forEach((g) => {
    g.pisos.sort((a, b) => nv(a) - nv(b));
    g.pisos.forEach((i) => (tipOf[i] = g.id));
    /* Criterios de la tipología: los de sus pisos en "Auto" (o los del primer piso, si todos fueron forzados).
       Una sola pasada arma mixed (difieren de la llave) y base (coinciden), cada lista en el orden de pisos. */
    g.mixed = [];
    const base: number[] = [];
    g.pisos.forEach((i) => {
      if (critKey(rows[i]) !== g.key) g.mixed.push(i);
      else base.push(i);
    });
    g.base = base[base.length - 1];
    const repName = (P.rep || {})[g.id];
    let repI: number | undefined;
    for (const i of g.pisos) {
      if (rows[i].nombre && rows[i].nombre === repName) {
        repI = i;
        break;
      }
    }
    g.auto = repI === undefined;
    g.highest = g.pisos[g.pisos.length - 1];
    g.rep = g.auto ? g.highest : repI!;
    const rp = rows[g.base];
    g.roc = criterios(
      {
        riesgo: rp.riesgo,
        sistema: rp.sistema,
        htecho: rp.htecho,
        qr: rp.qr,
        constr: rp.constr,
        techoIncl: rp.techoIncl,
        ocultoComb: rp.ocultoComb,
      },
      {
        K: rp.K,
        /* Pmin por piso (vacío = la global roc.Pmin), igual que S/L/K. */
        Pmin: rp.Pmin === undefined || rp.Pmin === '' ? st.roc.Pmin : rp.Pmin,
        S: rp.S,
        L: rp.L,
        /* DMR vacío = la global (roc.Dmuro), igual que el resto de defaults del proyecto. */
        Dmuro: rp.Dmuro === undefined || rp.Dmuro === '' ? st.roc.Dmuro : rp.Dmuro,
      },
    );
    g.hts = [...new Set(g.pisos.map((i) => r2(rows[i].htecho)))];
    /* La llave compara el DMR EFECTIVO (vacío = la global, igual que la línea del criterio de
     * arriba): si comparara el crudo, una fila sin DMR no matchearía Entradas aunque el
     * criterio con el que se calcula sea idéntico. */
    g.enEntradas =
      critKey(
        { ...rp, Dmuro: rp.Dmuro === undefined || rp.Dmuro === '' ? st.roc.Dmuro : rp.Dmuro },
        false,
      ) ===
      critKey(
        {
          riesgo: st.clas.riesgo,
          sistema: st.clas.sistema,
          htecho: st.clas.htecho,
          qr: st.clas.qr,
          constr: st.clas.constr,
          techoIncl: st.clas.techoIncl,
          ocultoComb: st.clas.ocultoComb,
          K: st.roc.K,
          S: st.roc.S,
          L: st.roc.L,
          Dmuro: st.roc.Dmuro,
        },
        false,
      );
    g.planta =
      String(rows[g.base].planta || '')
        .trim()
        .toUpperCase() || 'A';
    g.sistema = rows[g.base].sistema;
    g.riesgo = rp.riesgo;
  });
  /* Si varias tipologías tienen los mismos criterios (difieren solo en la planta), "En cálculo" es la que se cargó */
  const match = groups.filter((g) => g.enEntradas);
  if (match.length > 1 && match.some((g) => g.id === P.activa))
    match.forEach((g) => {
      g.enEntradas = g.id === P.activa;
    });
  /* activeId replica el activeTipId() del HTML: la tipología activa de la UI o la primera */
  const activeId = (groups.find((x) => x.id === P.activa) || groups[0] || { id: 'T1' }).id;
  return { groups, tipOf, idx, activeId };
}

/** Calcula el edificio completo: una red por tipología en su planta, la ruta del montante por
 *  piso (derivación → base → cuarto de bombas) y la ruta de gabinetes del montante. Mutates
 *  nothing outside its result; the caller attaches it to R.edif. */
export function edificio(
  st: RciState,
  roc: Criterios,
  ctx: CalcCtx,
  tips: Tips | undefined,
  QreqSP: number,
): Edificio {
  const M: MontCfg = Object.assign(
    { mat: 'Acero SCH 10', dn: 'auto', hS: 1.2, hD: 2.5, zBase: 0, holgura: 0, cuarto: [] },
    st.mont || {},
  );
  const P = st.pisos || {
      zBomba: 0,
      activa: '',
      rep: {},
      estado: {},
      gen: { sot: 0, pis: 10, h: 3, hs: 3, z1: 0 },
      rows: [],
    },
    zB = num(P.zBomba) ?? 0;
  const hasRows = P.rows.length > 0 && tips && tips.groups;
  const spOn = isSi(st.local.exigeSP);
  const baseRows: (PisoRow | Pick<PisoRow, 'nombre' | 'npt' | 'salida'>)[] = P.rows.length
    ? P.rows
    : [
        {
          nombre: 'Piso',
          npt: 0,
          salida: spOn
            ? st.sp.clase === 'Clase II'
              ? '1½"'
              : st.sp.clase === 'Clase I'
                ? '2½"'
                : '2½" + 1½"'
            : 'Ninguna',
        },
      ];
  const floors: PisoRowF[] = baseRows.map((p, i) => ({
    i,
    nombre: String(p.nombre || `Piso ${i + 1}`),
    npt: num(p.npt),
    salida: (p as PisoRow).salida || 'Ninguna',
    sinRoc: (p as PisoRow).riesgo === 'Sin rociadores',
    vreg: (p as PisoRow).vreg || 'auto',
    vrp: (p as PisoRow).vrp || 'auto',
  }));
  const groups: Tipologia[] = hasRows
    ? tips!.groups
    : [
        {
          id: 'T1',
          key: null,
          pisos: [0],
          mixed: [],
          base: 0,
          auto: true,
          highest: 0,
          rep: 0,
          roc,
          hts: [],
          enEntradas: true,
          planta: 'A',
          sistema: st.clas.sistema,
          riesgo: st.clas.riesgo,
        },
      ];
  const activeId = (
    groups.find((g) => g.id === (tips && tips.activeId)) ||
    groups[0] || { id: 'T1' }
  ).id;
  const typ: Record<string, TipCalc> = {};
  groups.forEach((g) => {
    const red = (st.redes || {})[g.planta];
    const act = g.id === activeId,
      rocT = act ? roc : g.roc || roc,
      riesgo = act ? st.clas.riesgo : g.riesgo || st.clas.riesgo;
    if (!red) {
      typ[g.id] = { g, pend: true, ok: false, roc: rocT, riesgo };
      return;
    }
    const cx: CalcCtx = Object.assign({}, ctx, {
      hD: num(M.hD) ?? 2.5,
      K: rocT.K,
      Pmin: rocT.Pmin,
      sistema: act ? ctx.sistema : g.sistema || ctx.sistema,
      branches: {},
    });
    const raiz = String(red.raiz || 'D').trim() || 'D';
    const rd = computeRed(red, raiz, rocT, cx);
    /* Tramo y ramal que aterrizan en la derivación: primer match, como el .find del HTML. */
    let tin: TuberiaRow | undefined, rin: TuberiaRow | undefined;
    for (const t of red.tramos || []) {
      if (String(t.a || '').trim() === raiz) {
        tin = t;
        break;
      }
    }
    for (const r of red.ramales || []) {
      if (String(r.con || '').trim() === raiz) {
        rin = r;
        break;
      }
    }
    const hD = red.nodos
      ? (num((red.nodos[raiz] || {}).z) ?? null)
      : tin
        ? num(tin.zf)
        : rin
          ? (num(rin.zc) ?? num(rin.zr))
          : null;
    const ok = !!(rd.rt && rd.rt.solved && !rd.errs.length);
    typ[g.id] = {
      g,
      rd,
      ok,
      P: ok ? (rd.rt!.P as number) : null,
      Q: ok ? (rd.rt!.Q as number) : null,
      hD,
      roc: rocT,
      riesgo,
    };
  });
  const tipOf: Record<number, string | undefined> = {};
  groups.forEach((g) =>
    (g.pisos || []).forEach((i) => {
      tipOf[i] = g.id;
    }),
  );
  const zBase = num(M.zBase) ?? 0,
    hS = num(M.hS) ?? 1.2,
    hDdef = num(M.hD) ?? 2.5;
  const qMax = Math.max(
    1,
    ...Object.values(typ)
      .filter((t) => t.ok)
      .map((t) => t.Q || 0),
    spOn ? QreqSP : 0,
  );
  let dnM = M.dn && M.dn !== 'auto' ? M.dn : suggestDn(qMax, M.mat, ctx.Vmax);
  if ((!M.dn || M.dn === 'auto') && spOn) {
    const minIn = num(st.sp.diam) || 4;
    const i0 = NOM.findIndex(
      (n) => PIPES[M.mat] && PIPES[M.mat][n] && PIPES[M.mat][n].inch >= minIn - 1e-9,
    );
    if (i0 >= 0 && PIPES[M.mat] && PIPES[M.mat][dnM] && PIPES[M.mat][dnM].inch < minIn)
      dnM = NOM[i0];
  }
  const cuarto: TuberiaRow[] = (M.cuarto || []).map((r) => Object.assign({}, r));
  const pf: PisoOut[] = floors.map((f) => {
    const tId = tipOf[f.i],
      t = tId ? typ[tId] : null;
    const base = f.npt === null ? null : f.npt - zB;
    const hD = t && t.hD !== null && t.hD !== undefined ? t.hD : hDdef;
    const o: PisoOut = {
      f,
      tId,
      t,
      zT: base === null ? null : base + hD,
      zS: base === null ? null : base + hS,
    };
    if (t && t.ok && o.zT !== null) {
      o.rows = [
        {
          ni: 'D ' + f.nombre,
          nf: 'Base',
          mat: M.mat,
          dn: dnM,
          L: Math.abs(o.zT - zBase),
          zi: o.zT,
          zf: zBase,
        },
        ...cuarto,
      ];
      o.res = route(o.rows, t.P as number, t.Q as number, ctx, 'alim');
      o.Preq = t.P as number;
      o.Q = t.Q as number;
    }
    return o;
  });
  let gabRows: TuberiaRow[] = [];
  /* Outlets: el piso con SALIDA marcada — el desplegable de Tipologías es editable de nuevo
     (ped. usuario) y el extractor la propone 'Sí' donde hay GAB dibujado. Cota de salida =
     npt − zB + hS, como siempre. Sin salidas → tabla vacía, nada fabricado. */
  const outs = pf
    .filter((o) => o.f.salida && o.f.salida !== 'Ninguna' && o.zS !== null)
    .sort((a, b) => (b.zS as number) - (a.zS as number));
  if (outs.length) {
    const cl2 = st.sp.clase === 'Clase II',
      qo = cl2 ? 100 : 250,
      nfl = cl2 ? 1 : 2;
    outs.forEach((o, k) => {
      const nx = outs[k + 1],
        zf = nx ? nx.zS : zBase;
      gabRows.push({
        ni: 'Gab ' + o.f.nombre,
        nf: nx ? 'Gab ' + nx.f.nombre : 'Base',
        salida: k < nfl,
        qFijo: k < nfl ? qo : '',
        mat: M.mat,
        dn: dnM,
        L: Math.abs((o.zS as number) - (zf as number)),
        zi: o.zS as number,
        zf: zf as number,
      });
    });
    const extra = Math.max(0, QreqSP - Math.min(nfl, outs.length) * qo);
    gabRows = gabRows.concat(
      cuarto.map((r, k) =>
        Object.assign({}, r, {
          salida: false,
          qFijo: '',
          qExtra: k === 0 && extra > 0 ? extra : 0,
        }),
      ),
    );
  }
  const qRocMax = Math.max(0, ...pf.filter((o) => o.res && o.res.valid).map((o) => o.Q || 0));
  /* Montantes: estructura preparada para varios (llegarán desde PLANO). Hoy se calcula una sola ruta, la del primero;
     los adicionales solo suman caudal (sp.num, 250 gpm c/u). */
  const montantes =
    st.montantes && st.montantes.length
      ? st.montantes
      : [{ id: 'M1', nombre: 'Montante 1', pisos: [] }];
  return {
    M,
    zB,
    zBase,
    hS,
    floors,
    groups,
    typ,
    activeId,
    active: typ[activeId],
    pf,
    outs,
    gabRows,
    dnM,
    qMax,
    qRocMax,
    cuarto,
    montantes,
    mont: montantes[0],
  };
}

/** Número EFECTIVO de montantes (ped. usuario: lo manda el dibujo): códigos distintos de los
 *  montantes rci extraídos (st.montantes, un código por montante vertical aunque cruce pisos);
 *  sin dibujo cae al amarillo sp.num. Ej: 2 montantes dibujados → 2 (500+250 gpm de demanda). */
export function numMontantesDibujados(st: RciState): number {
  const codigos = new Set<string>();
  for (const m of st.montantes || []) codigos.add(m.nombre || m.id);
  return codigos.size || num(st.sp.num) || 1;
}
