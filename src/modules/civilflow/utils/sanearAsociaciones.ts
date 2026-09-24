/**
 * Saneo de asociaciones entre pisos tras una RECALIBRACIÓN del origen de una lámina. El stamp
 * de calibración (PlanosTab.handleSaveConfig) mueve `origen` pero NO la geometría: todo
 * artefacto que codifique la posición del bajante del otro piso queda expresado en el frame
 * viejo. Como la traducción entre frames es una TRASLACIÓN pura (aFrameDe), el correcto es
 * una traslación por Δ = origen_nuevo − origen_viejo — sin releer el doc del partner:
 *   - Anillo (dx/dy) y LD pts[0] del piso INFERIOR: apuntan al superior traducido →
 *     si P es el inferior: += Δ; si P es el superior (anillo vive en el doc del partner): −= Δ.
 *   - Ghost (mirror del inferior en frame del superior): si P es el host: += Δ;
 *     si P es el inferior espejado en otro host: −= Δ.
 * Los anillos legacy (layout 1) que la migración reconstruye desde posiciones crudas se
 * sobreescriben igual en la próxima carga — trasladarlos es inocuo.
 */
import { devError } from '../../../utils/devError';
import { TRAZOS_PLAN_PREFIX } from '../constants/storage-keys';
import {
  loadData,
  saveData,
  origenDePlan,
  isLdesvioRamalId,
  type LocalGhostDrawingData,
} from './crossFloorStorage';

interface PuntoPx {
  x_px: number;
  y_px: number;
}

interface DespRing {
  dx?: number;
  dy?: number;
  Ldesvio?: string;
}

/** Recalibró el origen del plan `planId` de `prevOrigen` al actual: traslada anillos, inicios
 *  de Ldesvio y ghosts de TODA asociación que cruce ese plan (en ambos roles). Storage-only,
 *  best-effort (try/catch por piso). Sin Δ (primera calibración u origen igual) es no-op. */
export function sanearAsociacionesTrasRecalibrar(
  planId: string | number,
  prevOrigen: PuntoPx | null,
): void {
  const pid = String(planId);
  const nuevo = origenDePlan(pid);
  if (!nuevo || !prevOrigen) return;
  const dx = nuevo.x_px - prevOrigen.x_px;
  const dy = nuevo.y_px - prevOrigen.y_px;
  if (!dx && !dy) return;

  let tocado = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
      const docId = k.slice(TRAZOS_PLAN_PREFIX.length);
      const raw = localStorage.getItem(k) || '';
      // Sin anillos/LDs ni ghosts no hay nada que trasladar — no se parsea.
      if (!raw.includes('LD_') && !raw.includes('crossFloorGhosts')) continue;
      try {
        const data = loadData(docId) as LocalGhostDrawingData & {
          bajantes?: Array<{ id: string; desplazamientos?: Record<string, DespRing> }>;
        };
        let dirty = false;
        // 1) Ghosts: P host (P superior) → +Δ; P espejado en otro host (P inferior) → −Δ.
        for (const g of data.crossFloorGhosts ?? []) {
          if (g.layout !== 2) continue;
          const enP = docId === pid;
          const espejaP = g.sourcePlanId === pid;
          if (!enP && !espejaP) continue;
          const signo = enP ? 1 : -1;
          g.x = (g.x ?? 0) + signo * dx;
          g.y = (g.y ?? 0) + signo * dy;
          dirty = true;
        }
        // 2) Anillos con Ldesvio: el ROL se decide por el PUNTERO del portador
        //    (origenId/descargaEnId = 'plan|id', inequívoco) — NO por membresía de id:
        //    los ids BAN<n> se renumeran POR PISO y colisionan (falso negativo propio +
        //    falso positivo en terceros pisos de la misma cadena).
        //    P inferior (portador en P, partner afuera) → +Δ; portador ajeno con partner en
        //    P (P superior) → −Δ.
        const rolDe = (portador: {
          origenId?: string | null;
          descargaEnId?: string | null;
        }): 1 | -1 | 0 => {
          const puntero = portador.origenId || portador.descargaEnId || '';
          const planPtr = puntero.includes('|') ? puntero.split('|')[0] : '';
          if (!planPtr) return 0;
          if (docId === pid && planPtr !== pid) return 1;
          if (docId !== pid && planPtr === pid) return -1;
          return 0;
        };
        for (const b of data.bajantes ?? []) {
          const desp = b.desplazamientos;
          if (!desp) continue;
          const signo = rolDe(b as { origenId?: string | null; descargaEnId?: string | null });
          if (!signo) continue;
          for (const d of Object.values(desp)) {
            if (!d?.Ldesvio || !isLdesvioRamalId(d.Ldesvio)) continue;
            d.dx = (d.dx ?? 0) + signo * dx;
            d.dy = (d.dy ?? 0) + signo * dy;
            dirty = true;
          }
        }
        // 3) Inicio del Ldesvio (pts[0] = superior traducido): el LD pertenece a la asociación
        //    cuyo portador (bajante con anillo) lo referencia — buscar por Ldesvio.
        const portadorDe: Record<string, 1 | -1> = {};
        for (const b of data.bajantes ?? []) {
          const signo = rolDe(b as { origenId?: string | null; descargaEnId?: string | null });
          if (!signo) continue;
          for (const d of Object.values(b.desplazamientos ?? {})) {
            if (d?.Ldesvio) portadorDe[d.Ldesvio] = signo;
          }
        }
        for (const r of data.ramales ?? []) {
          if (!isLdesvioRamalId(r.id) || !r.pts?.length) continue;
          const signo = portadorDe[r.id];
          if (!signo) continue;
          r.pts[0] = [r.pts[0][0] + signo * dx, r.pts[0][1] + signo * dy];
          dirty = true;
        }
        if (dirty) {
          saveData(docId, data);
          tocado = true;
        }
      } catch (e) {
        devError('[assoc-recal] piso ilegible:', docId, e);
      }
    }
  } catch (e) {
    devError('[assoc-recal] barrido:', e);
  }
  // Un visor vivo sobre cualquiera de los pisos tocados debe recargar de storage (el autosave
  // de 1.5 s pisaría escrituras storage-only con su copia en memoria).
  if (tocado && typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
}
