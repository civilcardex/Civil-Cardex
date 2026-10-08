// healTribPadres: sanado global de la cadena de padres de tributarios en cada _markDirty.
// Extraído verbatim de junctionAutoSplit (des-monolitización 2026-10-06).

import type { PlanoRamal, IPlanoEngineCore } from './PlanoState';
import { rootTributarioLabel, allocTributaryNumber } from './PlanoState';

/** Sanado global (cada _markDirty): cadenas rotas se anclan con el label como pista; mergesFrom hereda; renumeración sin huecos por raíz. */
export function healTribPadres(engine: IPlanoEngineCore): void {
  // 1) Cadenas rotas: el label sugiere la raíz correcta.
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
    if (r.padre != null && engine.ramales.some((x) => x.id === r.padre)) continue;
    const m = /^T\d+(.+)$/.exec(r.label || '');
    const root =
      m &&
      engine.ramales.find((x) => x.tipo !== 'tributario' && (x.label === m[1] || x.id === m[1]));
    if (root) r.padre = root.id;
  }
  // 1b) Piezas de LÍNEA GUÍA (_sinAccMedInterior): sus dobleces no llevan glifos — limpia
  // accMed persistido por versiones anteriores al flag.
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario') continue;
    if (!(r as unknown as { _sinAccMedInterior?: boolean })._sinAccMedInterior) continue;
    if (r.accMed && Object.keys(r.accMed).length > 0) r.accMed = {};
  }
  // 2) Autocreados (mergesFrom): heredan el padre del upstream que continúan y su label se
  //    alinea a esa raíz.
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
    const mf = (r as unknown as { mergesFrom?: string[] }).mergesFrom;
    if (!mf || !mf.length) continue;
    const upstream = engine.ramales.find((x) => x.id === mf[0]);
    if (!upstream || upstream.tipo !== 'tributario') continue;
    const upRoot = rootTributarioLabel(engine.ramales, upstream.id);
    if (!upRoot) continue;
    if (r.padre !== upstream.padre) r.padre = upstream.padre;
    const rootLbl = rootTributarioLabel(engine.ramales, r.id);
    if (rootLbl && !(r.label || '').endsWith(rootLbl)) {
      r.label = `T${allocTributaryNumber(engine, rootLbl)}${rootLbl}`;
    }
  }
  // 3) Cadena INTACTA manda sobre el label: un tributario cuyo padre sube limpio a un tronco
  //    se re-etiqueta con la raíz de esa cadena y el consecutivo siguiente (T1RS1 con padre
  //    RS2 → T3RS2, pedido usuario). Las piezas con cadena rota ya fueron ancladas en (1).
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
    const rootLbl = rootTributarioLabel(engine.ramales, r.id);
    if (rootLbl && !(r.label || '').endsWith(rootLbl)) {
      r.label = `T${allocTributaryNumber(engine, rootLbl)}${rootLbl}`;
    }
  }
  // 4) Renumerar SIN HUECOS (pedido usuario: "se está saltando la etiqueta de T2RS#"): los
  //    relabels intermedios queman consecutivos. Por raíz, ordenar por el número actual del
  //    label y reasignar T1..Tn seguidos. Idempotente: con la serie ya seguida no cambia nada.
  const groups = new Map<string, Array<{ r: PlanoRamal; n: number }>>();
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
    const rootLbl = rootTributarioLabel(engine.ramales, r.id);
    if (!rootLbl) continue;
    const m = /^T(\d+)/.exec(r.label || '');
    const arr = groups.get(rootLbl) || [];
    arr.push({ r, n: m ? parseInt(m[1], 10) : 9999 });
    groups.set(rootLbl, arr);
  }
  for (const [rootLbl, arr] of groups) {
    if (arr.length <= 1) continue;
    arr.sort((x, y) => x.n - y.n);
    arr.forEach((item, i) => {
      const want = `T${i + 1}${rootLbl}`;
      if (item.r.label !== want) item.r.label = want;
    });
  }
}
