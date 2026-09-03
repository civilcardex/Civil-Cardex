import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
  PlanoDimension,
  PlanoGuideLine,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { _midpoint } from './PlanoEngineDrawing';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { pointToSegmentDist } from './HitTester';

/** Validación de diámetros de ventilación al editar un elemento: bloquea los cambios que rompan los límites de la red vent. */
export function checkVentDiameterLimits(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | PlanoDimension | PlanoGuideLine,
  fields: Record<string, unknown>,
): boolean {
  if (!el || !fields) return true;
  if (!('tipo' in el)) return true; // text annotations / areas never trigger vent-diameter checks

  const getConnectedVentRamales = (b: PlanoBajante) => {
    const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
    const connected: PlanoRamal[] = [];
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const bx = b.x + (disp ? disp.dx : 0);
    const by = b.y + (disp ? disp.dy : 0);
    for (const vr of ventRamales) {
      const isExplicit =
        b.recibeDeIds &&
        (b.recibeDeIds.includes(vr.id) || (vr.label && b.recibeDeIds.includes(vr.label)));
      let isConnected = isExplicit;
      if (!isConnected && vr.pts && vr.pts.length >= 2) {
        const d1 = Math.hypot(vr.pts[0][0] - bx, vr.pts[0][1] - by);
        const d2 = Math.hypot(vr.pts[vr.pts.length - 1][0] - bx, vr.pts[vr.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vr);
    }
    return connected;
  };

  const getConnectedVentBajantes = (r: PlanoRamal) => {
    const ventBajantes = engine.bajantes.filter((b) => b.net === 'vent');
    const connected: PlanoBajante[] = [];
    for (const vb of ventBajantes) {
      const disp = vb.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bx = vb.x + (disp ? disp.dx : 0);
      const by = vb.y + (disp ? disp.dy : 0);
      const isExplicit =
        vb.recibeDeIds &&
        (vb.recibeDeIds.includes(r.id) || (r.label && vb.recibeDeIds.includes(r.label)));
      let isConnected = isExplicit;
      if (!isConnected && r.pts && r.pts.length >= 2) {
        const d1 = Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by);
        const d2 = Math.hypot(r.pts[r.pts.length - 1][0] - bx, r.pts[r.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vb);
    }
    return connected;
  };

  const isVent = el.net === 'vent' || ('_net' in el && el._net === 'vent');
  if (isVent) {
    if (el.tipo === 'bajante' || el.tipo === 'montante') {
      let newDNom = '';
      if (fields.dNominal !== undefined) {
        newDNom = String(fields.dNominal || '');
      } else if (fields.ghostData !== undefined) {
        const lvl = engine.nivelActual?.label ?? '';
        const gd =
          (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[lvl] ||
          {};
        newDNom = String(gd.dNominal || gd.d_nominal || '');
      }
      if (newDNom) {
        const bDVal = diamPulgFromLabel(newDNom);
        if (bDVal > 0) {
          const connected = getConnectedVentRamales(el as PlanoBajante);
          for (const vr of connected) {
            const rDVal = vr.diamPulg || diamPulgFromLabel(vr.diametro);
            if (rDVal > 0 && bDVal < rDVal) {
              engine.triggerAlert(
                'Diámetro no válido',
                `El diámetro del bajante de ventilación (${newDNom}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${vr.diametro || vr.id}).`,
              );
              if (fields.dNominal !== undefined) {
                fields.dNominal = '';
              } else if (fields.ghostData !== undefined) {
                const lvl = engine.nivelActual?.label ?? '';
                const gd =
                  (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[
                    lvl
                  ] || {};
                gd.dNominal = '';
                gd.d_nominal = '';
              }
              return true;
            }
          }
        }
      }
    } else if (el.id?.startsWith('R') && fields.diametro !== undefined) {
      const newDiam = String(fields.diametro || '');
      const rDVal = diamPulgFromLabel(newDiam);
      if (rDVal > 0) {
        const connected = getConnectedVentBajantes(el as PlanoRamal);
        for (const vb of connected) {
          const lvl = engine.nivelActual?.label ?? '';
          const gd = vb.ghostData?.[lvl];
          const bNominal = gd?.dNominal || vb.dNominal || '';
          const bDVal = vb.diamPulg || diamPulgFromLabel(bNominal);
          if (bDVal > 0 && bDVal < rDVal) {
            engine.triggerAlert(
              'Diámetro no válido',
              `El diámetro del bajante de ventilación (${bNominal || vb.id}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${newDiam}).`,
            );
            fields.diametro = '';
            return true;
          }
        }
      }
    }
  }
  return true;
}

// Item 2: sincroniza el diámetro de todos los bajantes de ventilación conectados
// al mismo bajante sanitario. La conexión vent→san se identifica por:
//  - descargaEnId del vent apunta al san (formato `planId|sanBajanteIdOrCode`), o
//  - recibeDeIds del san incluye el id/code del vent.
// Cuando un vent bajante cambia de dNominal, los demás vents que comparten el
// mismo san bajante destino toman ese mismo diámetro. Esto garantiza estado
// consistente: todos los vents de un mismo san tienen el mismo diámetro.
/** Sincroniza el diámetro del bajante de ventilación con el ramal conectado según la dirección del flujo. */
export function syncVentBajanteDiameters(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | PlanoDimension | PlanoGuideLine,
  fields: Record<string, unknown>,
): void {
  if (!el || !('tipo' in el)) return;
  const b = el as PlanoBajante;
  if (b.net !== 'vent' || (b.tipo !== 'bajante' && b.tipo !== 'montante')) return;
  let newNom: string | undefined;
  if (fields.dNominal !== undefined) {
    newNom = String(fields.dNominal || '');
  } else if (fields.ghostData !== undefined) {
    const lvl = engine.nivelActual?.label ?? '';
    const gd = (fields.ghostData as Record<string, { dNominal?: string }>)[lvl];
    newNom = gd?.dNominal;
  }
  if (!newNom) return;
  // Resolver el san bajante destino de este vent: por descargaEnId, o buscando
  // un san bajante cuyo recibeDeIds lo incluya.
  const sanBajanteIdOrCode = resolveVentSanTarget(engine, b);
  if (!sanBajanteIdOrCode) return;
  // Encontrar todos los demás vent bajantes que descargan en el mismo san.
  for (const other of engine.bajantes) {
    if (other === b) continue;
    if (other.net !== 'vent') continue;
    const otherTarget = resolveVentSanTarget(engine, other);
    if (otherTarget === sanBajanteIdOrCode) {
      other.dNominal = newNom;
      other.diamPulg = diamPulgFromLabel(newNom);
      // Sincronizar también ghostData del nivel actual si existe.
      const lvl = engine.nivelActual?.label ?? '';
      if (other.ghostData?.[lvl]) {
        other.ghostData[lvl].dNominal = newNom;
      }
    }
  }
}

// Resuelve la clave (id) del bajante sanitario al que sirve un bajante de
// ventilación. La conexión puede ser:
//  1. directa: descargaEnId del vent apunta al san bajante;
//  2. por cadena (el caso real del plano): vent bajante → vent ramal(es) que
//     nacen de él (recibeDeIds o geometría) → san ramal que el vent ramal toca
//     (codo reventilado / Y) → san bajante en el que ese san ramal descarga
//     (recibeDeIds del bajante o ini/fin del ramal);
//  3. coincidencia geométrica directa con un san bajante.
// @returns id del san bajante o null.
function resolveVentSanTarget(engine: IPlanoEngineCore, ventB: PlanoBajante): string | null {
  const sanBajs = engine.bajantes.filter((b) => b.net === 'san' || b.net === 'll');
  const findSanBaj = (ref: string | null | undefined): PlanoBajante | null => {
    if (!ref) return null;
    const parts = String(ref).split('|');
    const tgt = parts[parts.length - 1];
    if (!tgt) return null;
    // Coincidencia exacta id/code, o base sin sufijo de piso ("BAN1-P2" → "BAN1").
    const base = tgt.split('-')[0];
    return (
      sanBajs.find((b) => b.id === tgt || b.code === tgt || b.id === base || b.code === base) ||
      null
    );
  };
  // 1. directa
  const direct = findSanBaj(ventB.descargaEnId);
  if (direct) return direct.id;
  // 2. cadena por ramales
  const lvlLabel = engine.nivelActual?.label ?? '';
  const disp = ventB.desplazamientos?.[lvlLabel] || {};
  const bx = ventB.x + (disp.dx || 0);
  const by = ventB.y + (disp.dy || 0);
  const ventRamalIds = new Set<string>();
  for (const r of engine.ramales) {
    if (r.net !== 'vent' || !r.pts || r.pts.length < 2) continue;
    const explicit =
      ventB.recibeDeIds?.includes(r.id) || (!!r.label && ventB.recibeDeIds?.includes(r.label));
    const head = r.pts[r.pts.length - 1];
    const geo =
      Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by) < 2.0 ||
      Math.hypot(head[0] - bx, head[1] - by) < 2.0;
    if (explicit || geo) ventRamalIds.add(r.id);
  }
  for (const vrId of ventRamalIds) {
    const vr = engine.ramales.find((r) => r.id === vrId);
    if (!vr?.pts || vr.pts.length < 2) continue;
    const eps = [vr.pts[0], vr.pts[vr.pts.length - 1]];
    for (const san of engine.ramales) {
      if (san.net !== 'san' && san.net !== 'll') continue;
      if (!san.pts || san.pts.length < 2) continue;
      let touches = false;
      for (const ep of eps) {
        for (let i = 0; i < san.pts.length - 1 && !touches; i++) {
          if (
            pointToSegmentDist(
              ep[0],
              ep[1],
              san.pts[i][0],
              san.pts[i][1],
              san.pts[i + 1][0],
              san.pts[i + 1][1],
            ) < 0.5
          )
            touches = true;
        }
      }
      if (!touches) continue;
      // san ramal → bajante en el que descarga. El bajante pudo montarse sobre el
      // CUERPO del ramal (split): las mitades resultantes no quedan en
      // recibeDeIds ni con ini/fin, así que se camina aguas abajo por la cadena
      // de ramales san hasta el bajante (geométrico o referenciado).
      const bajId = findSanBajanteDownstream(engine, san, sanBajs, findSanBaj);
      if (bajId) return bajId;
    }
  }
  // 3. coincidencia geométrica directa
  for (const s of sanBajs) {
    if (Math.hypot(s.x - ventB.x, s.y - ventB.y) < 0.5) return s.id;
  }
  return null;
}

// Camina aguas abajo desde un ramal san hasta el id del bajante en que descarga:
// recibeDeIds / fin / ini de cada ramal, o un bajante san montado geométricamente
// en su extremo de salida de flujo. Si el flujo continúa por otro ramal san (el
// caso del split por bajante en el cuerpo), salta a él. Máx 8 saltos (ciclos).
function findSanBajanteDownstream(
  engine: IPlanoEngineCore,
  start: PlanoRamal,
  sanBajs: PlanoBajante[],
  findSanBaj: (ref: string | null | undefined) => PlanoBajante | null,
): string | null {
  const lvlLabel = engine.nivelActual?.label ?? '';
  const bajAt = (pt: number[]): PlanoBajante | null => {
    for (const b of sanBajs) {
      if (Math.hypot(b.x - pt[0], b.y - pt[1]) < 2.0) return b;
      const disp = b.desplazamientos?.[lvlLabel] || {};
      if (Math.hypot(b.x + (disp.dx || 0) - pt[0], b.y + (disp.dy || 0) - pt[1]) < 2.0) return b;
    }
    return null;
  };
  const visited = new Set<string>();
  let cur: PlanoRamal | null = start;
  for (let hop = 0; hop < 8 && cur; hop++) {
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    const curId = cur.id;
    const byRecibe = sanBajs.find((b) => b.recibeDeIds?.includes(curId));
    if (byRecibe) return byRecibe.id;
    const byRef = findSanBaj(cur.fin) || findSanBaj(cur.ini);
    if (byRef) return byRef.id;
    if (!cur.pts || cur.pts.length < 2) break;
    const head = cur._tribReversed ? cur.pts[0] : cur.pts[cur.pts.length - 1];
    const gb = bajAt(head);
    if (gb) return gb.id;
    let next: PlanoRamal | null = null;
    for (const s2 of engine.ramales) {
      if (s2.id === curId || visited.has(s2.id)) continue;
      if (s2.net !== 'san' && s2.net !== 'll') continue;
      if (!s2.pts || s2.pts.length < 2) continue;
      if (s2.pts.some((p) => Math.hypot(p[0] - head[0], p[1] - head[1]) < 2.0)) {
        next = s2;
        break;
      }
    }
    cur = next;
  }
  return null;
}
