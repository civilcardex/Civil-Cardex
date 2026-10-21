import { sumaCnt, type Cnt, type Ctx } from './conteo.ts';
import { loadFromStorage, saveToStorage } from '../../services/almacenamientoServicio.ts';
import { TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';

/**
 * Fase 5bis: refresco del ucAplicado de los montantes que RECIBEN - su carga = la suma de los
 * ramales que le llegan (recibeDeIds o contacto geométrico en su cabeza).
 */
export function refrescarMontantes(ctx: Ctx): void {
  const { bajes, ramales, totalDe, net, diag } = ctx;
  // 5bis) Refresco de ucAplicado de montantes que RECIBEN (orig. usuario "+1 lavadero en
  //  MAC1"): su carga = la suma de los ramales que le llegan (recibeDeIds o contacto
  //  geométrico en su cabeza) — ANTES quedaba congelada en la asociación y se ponía rancia
  //  cuando la cadena cambiaba. Los montantes FUENTE (alimentaIds) no se tocan: su
  //  ucAplicado es la carga que ENTREGA al piso, no la que recibe.
  {
    const cambios = new Map<string, Map<string, Cnt>>();
    const macLog: string[] = [];
    // Libros HUÉRFANOS (orig. usuario MAC1: 15.5 rancio): montante FUENTE — sin origenId
    // ni bomba — con libro ramal-claveado de una era anterior (asociaciones viejas, con
    // roles incluso invertidos). Nadie lo re-escribe (5bis lo salta; el apply/espejos
    // escriben el libro del RECEPTOR) y el grupo podía mezclarlo: fuera SIEMPRE — salvo
    // la entrada anidada de 5bis (clave propia), que es su carga real.
    const huerfanos = new Map<string, Set<string>>();
    for (const b of bajes) {
      if (b.tipo !== 'montante') continue;
      if (!b.origenId && !b.bombaEnId && Object.keys(b.ucAplicado || {}).length) {
        const propiaKey = `${net}_${b.id}_${b.pid}`;
        const restos = Object.keys(b.ucAplicado || {}).filter((k) => k !== propiaKey);
        if (restos.length) {
          for (const k of restos) delete b.ucAplicado![k];
          if (!Object.keys(b.ucAplicado || {}).length) delete b.ucAplicado;
          macLog.push(
            b.code + ' libro rancio (fuente sin asociación) eliminado: ' + restos.join(','),
          );
          if (!huerfanos.has(b.pid)) huerfanos.set(b.pid, new Set());
          huerfanos.get(b.pid)!.add(b.id);
        }
      }
      if (!(b.recibeDeIds || []).length) continue;
      // Asociado entre pisos (orig. usuario: "los montantes asociados deben quedar con los
      // mismos aparatos"): su libro ucAplicado contiene el GRUPO del piso superior escrito
      // por la asociación (apply/espejos) y lo lee el panel (aggBajanteAsociado) y cargaBaj.
      // Reemplazarlo por totales locales mataba la herencia en la primera corrida posterior
      // (se dispara DENTRO de la corrida que el propio apply encadena).
      if (b.origenId && String(b.origenId).includes('|')) continue;
      const en = new Map<string, number[]>();
      if (b.pts && b.pts.length >= 2) en.set(`${b.pts[0][0]}|${b.pts[0][1]}`, b.pts[0]);
      let uc: Cnt = {};
      const vistos = new Set<string>();
      const alimenta = (p: number[] | undefined): void => {
        if (!p) return;
        for (const r of ramales) {
          if (r.pid !== b.pid || vistos.has(r.key) || !r.pts || r.pts.length < 2) continue;
          const toca =
            Math.hypot(r.pts[0][0] - p[0], r.pts[0][1] - p[1]) < 2 ||
            Math.hypot(r.pts[r.pts.length - 1][0] - p[0], r.pts[r.pts.length - 1][1] - p[1]) < 2;
          if (!toca) continue;
          vistos.add(r.key);
          uc = sumaCnt(uc, totalDe.get(r.key) || {});
        }
      };
      const rids = b.recibeDeIds || [];
      for (const rid of rids) {
        const r = ramales.find((x) => x.pid === b.pid && x.id === rid);
        if (r) {
          vistos.add(r.key);
          uc = sumaCnt(uc, totalDe.get(r.key) || {});
        }
      }
      for (const p of en.values()) alimenta(p);
      // Forma anidada por clave (la que escriben la asociación y lee upMonte).
      const ucNido = { [`${net}_${b.id}_${b.pid}`]: uc };
      const antes = JSON.stringify((b.ucAplicado || {})[`${net}_${b.id}_${b.pid}`] || {});
      if (JSON.stringify(uc) === antes) continue;
      macLog.push(b.code + ' ← ' + JSON.stringify(uc) + ' (antes ' + antes + ')');
      b.ucAplicado = ucNido;
      if (!cambios.has(b.pid)) cambios.set(b.pid, new Map());
      cambios.get(b.pid)!.set(b.id, uc);
    }
    diag.macRefresh = macLog;
    for (const [pid, monts] of cambios) {
      const raw = loadFromStorage<unknown>(`${TRAZOS_PREFIX}${pid}`, null);
      if (!raw) continue;
      let d = raw as {
        bajantes?: Array<{ id: string; ucAplicado?: Record<string, Cnt> }>;
      };
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d);
        } catch {
          continue;
        }
      }
      if (!d || !d.bajantes) continue;
      for (const b of d.bajantes) {
        const uc = monts.get(b.id);
        if (uc) b.ucAplicado = { [`${net}_${b.id}_${pid}`]: uc };
      }
      saveToStorage(`${TRAZOS_PREFIX}${pid}`, d);
    }
    // Persistir los libros huérfanos eliminados (el objeto en memoria ya está limpio — el
    // storage del piso manda para la próxima corrida y para collectSourceAgg del vecino).
    for (const [pid, ids] of huerfanos) {
      try {
        const raw = loadFromStorage<unknown>(`${TRAZOS_PREFIX}${pid}`, null);
        if (!raw) continue;
        let d = raw as { bajantes?: Array<{ id: string; ucAplicado?: Record<string, Cnt> }> };
        if (typeof d === 'string') {
          try {
            d = JSON.parse(d);
          } catch {
            continue;
          }
        }
        if (!d || !d.bajantes) continue;
        let toco = false;
        for (const b of d.bajantes) {
          // Misma regla que en memoria: fuera solo las claves rancias (ramal-claveadas);
          // la entrada anidada de 5bis (clave propia) se conserva si existe.
          if (ids.has(b.id) && b.ucAplicado) {
            const propia = `${net}_${b.id}_${pid}`;
            for (const k of Object.keys(b.ucAplicado)) {
              if (k !== propia) delete b.ucAplicado[k];
            }
            if (!Object.keys(b.ucAplicado).length) delete b.ucAplicado;
            toco = true;
          }
        }
        if (toco) saveToStorage(`${TRAZOS_PREFIX}${pid}`, d);
      } catch {
        /* best-effort */
      }
    }
  }
}
