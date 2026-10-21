import type { IPlanoEngineCore } from './PlanoState.ts';
import { canalOBBDe, puntoEnCanalOBB, pxPerCmDe } from './channelGeometry';

/** Memoria del enlace canal↔bajante de cada piso: qué ramales ya quedaron sellados como
 *  ramal-de-canal y qué pares quedan vetados (para no marcar dos veces lo mismo). */
export interface SelloCanalEstado {
  autoBaj: string[];
  vetoBaj: string[];
  autoRam: string[];
  vetoRam: string[];
}

function claveSelloCanal(planId: string | number | null | undefined): string {
  return `civilflow_sello_canal_${String(planId ?? '')}`;
}

function estadoSelloVacio(): SelloCanalEstado {
  return { autoBaj: [], vetoBaj: [], autoRam: [], vetoRam: [] };
}

export function leerEstadoSello(planId: string | number | null | undefined): SelloCanalEstado {
  const vacio = estadoSelloVacio();
  try {
    const raw = localStorage.getItem(claveSelloCanal(planId));
    if (!raw) return vacio;
    const p = JSON.parse(raw) as Partial<SelloCanalEstado>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return {
      autoBaj: arr(p.autoBaj),
      vetoBaj: arr(p.vetoBaj),
      autoRam: arr(p.autoRam),
      vetoRam: arr(p.vetoRam),
    };
  } catch {
    return vacio;
  }
}

export function guardarEstadoSello(
  planId: string | number | null | undefined,
  estado: SelloCanalEstado,
): void {
  try {
    const key = claveSelloCanal(planId);
    const next = JSON.stringify(estado);
    if (localStorage.getItem(key) === next) return;
    localStorage.setItem(key, next);
  } catch {
    // nunca lanza
  }
}

export function vetarSelloCanal(
  planId: string | number | null | undefined,
  tipo: 'baj' | 'ram',
  elementoId: string,
  canalId: string,
): void {
  try {
    const e = leerEstadoSello(planId);
    const key = `${elementoId}|${canalId}`;
    if (tipo === 'baj') {
      if (!e.vetoBaj.includes(key)) e.vetoBaj.push(key);
      e.autoBaj = e.autoBaj.filter((k) => k !== key);
    } else {
      if (!e.vetoRam.includes(key)) e.vetoRam.push(key);
      e.autoRam = e.autoRam.filter((k) => k !== key);
    }
    guardarEstadoSello(planId, e);
  } catch {
    // nunca lanza
  }
}

export function levantarVetoSelloCanal(
  planId: string | number | null | undefined,
  tipo: 'baj' | 'ram',
  elementoId: string,
  canalId: string,
): void {
  try {
    const e = leerEstadoSello(planId);
    const key = `${elementoId}|${canalId}`;
    if (tipo === 'baj') e.vetoBaj = e.vetoBaj.filter((k) => k !== key);
    else e.vetoRam = e.vetoRam.filter((k) => k !== key);
    guardarEstadoSello(planId, e);
  } catch {
    // nunca lanza
  }
}

/** Cuánto puede sobrar (en pixeles de plano) para que un ramal siga contando como conectado al
 *  canal o al bajante: 4 px al canal, 2 px al bajante. */
export const CANAL_PUENTE_PAD = 4;
export const BAJANTE_PUENTE_TOL = 2;

/** Marca solo, al cargar el plano, los ramales que conectan un canal con un bajante de lluvias
 *  (ll). Corre después de detectar conexiones y podar las viejas; si algo falla, se ignora en
 *  silencio (nunca rompe la carga). */
export function sellarAsociacionesCanalBajante(engine: IPlanoEngineCore): void {
  try {
    let pxPerCm = 0;
    try {
      pxPerCm = pxPerCmDe(engine);
    } catch {
      return;
    }
    const planId = String(engine._loadedPlanId ?? '');
    const estado = leerEstadoSello(planId);
    let cambiado = false;
    const canales = (engine.bajantes || []).filter((b) => b.tipo === 'canal' && b.net === 'll');
    const bajantes = (engine.bajantes || []).filter((b) => b.net === 'll' && b.tipo === 'bajante');
    type Puente = { bajId: string; canalId: string; ramId: string; nace: boolean };
    const puentes: Puente[] = [];
    for (const c of canales) {
      if (c.x == null || c.y == null || c.id == null) continue;
      const obb = canalOBBDe(pxPerCm, c);
      const enCanal = (pt: number[]): boolean =>
        puntoEnCanalOBB(obb, pt[0], pt[1], CANAL_PUENTE_PAD);
      for (const r of engine.ramales || []) {
        if (r.net !== 'll' || !r.pts || r.pts.length < 2 || r.id == null) continue;
        const pS = r.pts[0];
        const pE = r.pts[r.pts.length - 1];
        const naceDelCanal = enCanal(pS);
        if (!naceDelCanal && !enCanal(pE)) continue;
        const pBaj = naceDelCanal ? pE : pS;
        const b = bajantes.find(
          (bb) =>
            bb.x != null &&
            bb.y != null &&
            Math.hypot(pBaj[0] - (bb.x as number), pBaj[1] - (bb.y as number)) < BAJANTE_PUENTE_TOL,
        );
        if (!b || b.id == null) continue;
        puentes.push({
          bajId: String(b.id),
          canalId: String(c.id),
          ramId: String(r.id),
          nace: naceDelCanal,
        });
      }
    }
    const puentesBaj = new Set(puentes.map((p) => `${p.bajId}|${p.canalId}`));
    const puentesRam = new Set(puentes.filter((p) => p.nace).map((p) => `${p.ramId}|${p.canalId}`));
    const autoBajVivos: string[] = [];
    for (const key of estado.autoBaj) {
      if (puentesBaj.has(key)) {
        autoBajVivos.push(key);
        continue;
      }
      const sep = key.lastIndexOf('|');
      const bajId = key.slice(0, sep);
      const canalPart = key.slice(sep + 1);
      const b = (engine.bajantes || []).find((bb) => String(bb.id) === bajId);
      if (b && b.canalId === canalPart) b.canalId = null;
      cambiado = true;
    }
    estado.autoBaj = autoBajVivos;
    const autoRamVivos: string[] = [];
    for (const key of estado.autoRam) {
      if (puentesRam.has(key)) {
        autoRamVivos.push(key);
        continue;
      }
      const sep = key.lastIndexOf('|');
      const ramId = key.slice(0, sep);
      const canalPart = key.slice(sep + 1);
      const r = (engine.ramales || []).find((rr) => String(rr.id) === ramId);
      const c = canales.find((cc) => String(cc.id) === canalPart);
      if (r && c && r.pts && r.pts.length >= 2 && c.x != null && c.y != null) {
        try {
          const obbC = canalOBBDe(pxPerCm, c);
          const pS = r.pts[0];
          const pE = r.pts[r.pts.length - 1];
          if (puntoEnCanalOBB(obbC, pS[0], pS[1], 4) || puntoEnCanalOBB(obbC, pE[0], pE[1], 4)) {
            autoRamVivos.push(key);
            continue;
          }
        } catch {
          // cae al limpiado normal de abajo
        }
      }
      if (r && r.esCanalId === canalPart) r.esCanalId = null;
      cambiado = true;
    }
    estado.autoRam = autoRamVivos;
    const vetoBajVivos = estado.vetoBaj.filter((k) => puentesBaj.has(k));
    if (vetoBajVivos.length !== estado.vetoBaj.length) cambiado = true;
    estado.vetoBaj = vetoBajVivos;
    const vetoRamVivos = estado.vetoRam.filter((k) => puentesRam.has(k));
    if (vetoRamVivos.length !== estado.vetoRam.length) cambiado = true;
    estado.vetoRam = vetoRamVivos;
    const setVetoBaj = new Set(estado.vetoBaj);
    const setVetoRam = new Set(estado.vetoRam);
    const setAutoBaj = new Set(estado.autoBaj);
    const setAutoRam = new Set(estado.autoRam);
    for (const p of puentes) {
      const bk = `${p.bajId}|${p.canalId}`;
      if (!setVetoBaj.has(bk)) {
        const b = (engine.bajantes || []).find((bb) => String(bb.id) === p.bajId);
        if (b) {
          if (!b.canalId) {
            b.canalId = p.canalId;
            if (!setAutoBaj.has(bk)) {
              estado.autoBaj.push(bk);
              setAutoBaj.add(bk);
              cambiado = true;
            }
          } else if (b.canalId === p.canalId && !setAutoBaj.has(bk)) {
            estado.autoBaj.push(bk);
            setAutoBaj.add(bk);
            cambiado = true;
          }
        }
      }
      if (p.nace) {
        const rk = `${p.ramId}|${p.canalId}`;
        if (!setVetoRam.has(rk)) {
          const r = (engine.ramales || []).find((rr) => String(rr.id) === p.ramId);
          if (r) {
            if (!r.esCanalId) {
              r.esCanalId = p.canalId;
              if (!setAutoRam.has(rk)) {
                estado.autoRam.push(rk);
                setAutoRam.add(rk);
                cambiado = true;
              }
            } else if (r.esCanalId === p.canalId && !setAutoRam.has(rk)) {
              estado.autoRam.push(rk);
              setAutoRam.add(rk);
              cambiado = true;
            }
          }
        }
      }
    }
    if (cambiado) guardarEstadoSello(planId, estado);
  } catch {
    return;
  }
}
