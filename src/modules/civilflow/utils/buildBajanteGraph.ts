import { splitPtr } from './keys.ts';
import type { BajanteRaw } from './drawingSyncTypes.ts';
import { leerDocDePlan } from './readPlanDrawing';
import { pisoLbl } from '../constants';
import { distToPolyline } from '../lib/shared/geometry';
import type { Tramo } from '../context/tramosReducer';
import type { RawElement } from './drawingSync.ts';
import {
  adyDesdeMapa,
  componentesDeAdy,
  enlazarSeccionesBajante,
  orientarComponentes,
} from './sanGraphShared.ts';

interface PlanEntry {
  id: string | number;
  nivel: number | null;
}
interface RamalRaw extends RawElement {
  diamPulg?: number;
}

/** Grafo de vent (Ventilacion) desde planos (conexiones por cercanía + mapeo al bajante san que cubre).
 *  El otro consumidor del grafo (bajanteVentRows) calcula las UD (Unidades de Desague) aparte.
 *  @param plans - planos con id y nivel.
 *  @param tramosSan - tramos san (Sanitaria).
 *  @returns [conexiones, vMap, ventRamalDiamMap, components]. */
export function buildBajanteGraph(plans: PlanEntry[], tramosSan: Tramo[]) {
  // Sets: la pertenencia (¿ya enlazado?) era un .includes sobre un array que crece — O(n²).
  const map = new Map<string, Set<string>>();
  const vMap = new Map<string, Set<string>>();
  const anadir = (m: Map<string, Set<string>>, padre: string, hijo: string): void => {
    let set = m.get(padre);
    if (!set) {
      set = new Set<string>();
      m.set(padre, set);
    }
    set.add(hijo);
  };
  const ventRamalDiamMap: Record<string, number> = {};

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<{ ramales?: RamalRaw[]; bajantes?: BajanteRaw[] }>(plan.id);
    if (!data) continue;

    const ramales = data.ramales || [];
    const bajantes = data.bajantes || [];
    // Set de los ramales que cada bajante recibe (el .includes dentro del bucle era O(n)).
    // ANTES del bucle de ramales: checkEndpoint lo lee y vivía declarado después — TDZ
    // "Cannot access 'recibePorBajante' before initialization" en el primer ramal con bajantes.
    const recibePorBajante = new Map<string, Set<string>>();
    for (const b of bajantes) {
      if (b.id) recibePorBajante.set(b.id, new Set(b.recibeDeIds || []));
    }

    const getBajantePos = (b: BajanteRaw) => {
      const lvl = pisoLbl(plan.nivel ?? 0);
      const disp = b.desplazamientos?.[lvl] || {};
      return {
        x: (b.x || 0) + (disp.dx || 0),
        y: (b.y || 0) + (disp.dy || 0),
      };
    };

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isDischargingIntoR =
            b.descargaEnId &&
            (b.descargaEnId === `${plan.id}|${r.id}` ||
              b.descargaEnId === r.id ||
              (r.label &&
                (b.descargaEnId === `${plan.id}|${r.label}` || b.descargaEnId === r.label)));
          if (isDischargingIntoR) continue;

          const recibe = b.id ? recibePorBajante.get(b.id) : undefined;
          const isExplicit = !!recibe && (recibe.has(r.id) || (!!r.label && recibe.has(r.label)));
          const bPos = getBajantePos(b);
          const dist = Math.hypot(pt[0] - bPos.x, pt[1] - bPos.y);
          if (isExplicit) {
            // El enlace explícito no dice en qué extremo — asignarlo al extremo que esté
            // geométricamente más cerca, para que un bajante en cada extremo reclame el suyo.
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - bPos.x, otherPt[1] - bPos.y);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) {
            return { type: 'bajante' as const, id: b.id };
          }
        }
        let bestRx: RamalRaw | null = null;
        let minDist = Infinity;
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0 && dist < minDist) {
            minDist = dist;
            bestRx = rx;
          }
        }
        if (bestRx) {
          return { type: 'ramal' as const, id: bestRx.id };
        }
        return null;
      };

      // Un ramal puede tener un bajante en CADA extremo — chequear ambos extremos
      // independientemente en vez de cortocircuitar en la primera coincidencia, si no el segundo
      // bajante se descarta en silencio y sus unidades de descarga nunca se cuentan.
      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        anadir(map, targetKey, rKey);
      }
    }

    const ventBajantes = bajantes.filter((b: BajanteRaw) => b.net === 'vent');
    const ventRamales = ramales.filter((r: RamalRaw) => r.net === 'vent');
    // Los ramales/bajantes san se filtraban DENTRO del bucle de ventilación (O(n²) de filtros).
    const sanRamales = ramales.filter((r: RamalRaw) => r.net === 'san');
    const sanBajantes = bajantes.filter((b: BajanteRaw) => b.net === 'san');

    for (const vb of ventBajantes) {
      const vbKey = `${vb.id}-${plan.id}`;
      if (!vMap.has(vbKey)) vMap.set(vbKey, new Set<string>());

      for (const vr of ventRamales) {
        const recibe = vb.id ? recibePorBajante.get(vb.id) : undefined;
        const isExplicit = !!recibe && (recibe.has(vr.id) || (!!vr.label && recibe.has(vr.label)));
        let isConnected = isExplicit;
        if (!isConnected && vr.pts && vr.pts.length >= 2) {
          const vbPos = getBajantePos(vb);
          const d1 = Math.hypot(vr.pts[0][0] - vbPos.x, vr.pts[0][1] - vbPos.y);
          const d2 = Math.hypot(
            vr.pts[vr.pts.length - 1][0] - vbPos.x,
            vr.pts[vr.pts.length - 1][1] - vbPos.y,
          );
          if (d1 < 2.0 || d2 < 2.0) isConnected = true;
        }
        if (isConnected) {
          let foundSanId: string | null = null;

          if (vr.descargaEnId) {
            const parts = splitPtr(vr.descargaEnId, plan.id);
            if (parts[1] !== vb.id && parts[1] !== vb.label) {
              const sanKey = `${parts[1]}-${parts[0]}`;
              anadir(vMap, vbKey, sanKey);
              continue;
            }
          }

          if (vr.pts && vr.pts.length >= 2) {
            const pt1 = vr.pts[0];
            const pt2 = vr.pts[vr.pts.length - 1];

            for (const sb of sanBajantes) {
              const sbPos = getBajantePos(sb);
              if (
                Math.hypot(pt1[0] - sbPos.x, pt1[1] - sbPos.y) < 2.0 ||
                Math.hypot(pt2[0] - sbPos.x, pt2[1] - sbPos.y) < 2.0
              ) {
                foundSanId = sb.id;
                break;
              }
            }

            if (!foundSanId) {
              for (const sr of sanRamales) {
                if (!sr.pts || sr.pts.length < 2) continue;
                const d1 = distToPolyline(pt1, sr.pts);
                const d2 = distToPolyline(pt2, sr.pts);
                if (d1 < 2.0 || d2 < 2.0) {
                  foundSanId = sr.id;
                  break;
                }
              }
            }
          }

          if (foundSanId) {
            const sk = `${foundSanId}-${plan.id}`;
            anadir(vMap, vbKey, sk);
          }
        }
      }
    }

    // Construir mapa de diámetros de ramales de ventilación desde los datos de dibujo
    for (const vr of ventRamales) {
      const diam =
        vr.diamPulg || (vr.diametro ? parseFloat(String(vr.diametro).replace(/[^0-9.]/g, '')) : 0);
      if (diam > 0) {
        ventRamalDiamMap[`${vr.id}-${plan.id}`] = diam;
      }
    }
  }

  enlazarSeccionesBajante(tramosSan, (padre, hijo) => anadir(map, padre, hijo));
  const adj = adyDesdeMapa(tramosSan, map);
  const components = componentesDeAdy(adj);
  const tramoPorClave = new Map<string, Tramo>();
  for (const t of tramosSan) {
    if (t._key) tramoPorClave.set(t._key, t);
  }
  const orientedConexiones = orientarComponentes(components, adj, tramoPorClave);
  return [orientedConexiones, vMap, ventRamalDiamMap, components] as const;
}
