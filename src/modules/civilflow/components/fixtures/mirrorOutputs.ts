import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import type { InheritPoolBajante, InheritPoolRamal } from '../../utils/bajanteAssocShared.ts';
import type { PaseEspejos } from './fixtureMirrorsTypes.ts';
import { aggParaEspejoSalida, libroHeredado, syncMirrorKey } from '../fixturesStorage.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { mapUdBombaDesdeTrazos } from '../../utils/pumpAssociation';

/** Espejo de SALIDAS de bajantes del piso cargado: los ramales que nacen de un bajante
 *  (o de una bomba/caja) muestran en su clave EXACTAMENTE lo que el elemento transporta —
 *  escritura por REEMPLAZO (nunca fusión: la fusión mantenía viva inflaciones pasadas).
 *  Los montantes no espejan (son la inversa: alimentan, no reciben). */
export function espejarSalidas(p: PaseEspejos): void {
  const { eng, netId, planId, disk, pkey, agregadoBajante, exitsDeBajante, esDeEstePiso } = p;
  // Libros de herencia cross-floor por bajante (misma lectura que el display del panel:
  // TRAZOS del piso cargado) — el espejo de salidas copia lo que el bajante MUESTRA.
  let trazBooks = new Map<string, Record<string, Record<string, number>>>();
  try {
    const t = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        pisoBase?: string;
        ucAplicado?: Record<string, Record<string, number>>;
      }>;
    } | null>(TRAZOS_PREFIX + planId, null);
    // Solo las copias de ESTE piso: la proyección del piso vecino con el mismo id trae un
    // libro rancio (o `{}`) y, al ganar por "última copia", el espejo de salidas copiaba el
    // árbol entero (propio + heredado) en vez de la herencia.
    for (const b of t?.bajantes || [])
      if (b.ucAplicado && esDeEstePiso(b)) trazBooks.set(b.id, b.ucAplicado);
  } catch {
    trazBooks = new Map();
  }
  for (const baj of eng.bajantes) {
    if (baj.net !== netId || !esDeEstePiso(baj)) continue;
    // MONTANTES (orig. usuario): NO espejan sus ramales — son la inversa de un bajante (los
    // alimentan, no los reciben); sus ramales mantienen UDs propias asignables.
    if (baj.tipo === 'montante') continue;
    // BOMBA (orig. usuario): punto de transferencia — su clave SIEMPRE espeja el agregado
    // de su caja de origen (recalculado por conectividad; nunca genera UDs propias). SIN
    // `continue`: la bomba también puede sostener un enlace cross-floor (descargaEnId →
    // bajante superior), que se procesa más abajo en esta misma iteración.
    if (baj.tipo === 'bomba' && baj.cajaOrigenId) {
      // Misma fuente que BombaARDesign: trazos del piso de la caja (con fallback al agregado
      // vivo) — la clave de la bomba SIEMPRE termina valiendo lo mismo en ambos lados.
      // La bomba vive en el piso cargado: se suma el pool vivo (los trazos en disco van
      // por detrás del motor y el espejo divergía del mapa de la página).
      const desdeTrazos = mapUdBombaDesdeTrazos(String(planId), baj.id, netId, {
        bajantes: eng.bajantes as unknown as InheritPoolBajante[],
        ramales: eng.ramales as unknown as InheritPoolRamal[],
      });
      const aggBomba = Object.keys(desdeTrazos).length
        ? desdeTrazos
        : agregadoBajante(baj.cajaOrigenId);
      // Sin agregado (caja vacía o red aún en construcción): NO sobrescribir la clave con
      // {} — el espejo vacío borraba UDs legítimas (orig. usuario).
      if (!Object.keys(aggBomba).length) continue;
      if (syncMirrorKey(disk, pkey(baj.id), aggBomba, false)) p.dirty = true;
    } else {
      // Bajante asociado a BOMBA (orig. usuario): sus salidas espejan las UDs DE LA BOMBA
      // (misma lectura que el panel del bajante) — NO el agregado del árbol, que puede no
      // contener las ramales heredadas y dejaba la salida en 0 aunque el bajante mostrara
      // el total (caso RS7/BAN2). Con pool vivo si la bomba es de este piso.
      let agg = agregadoBajante(baj.id);
      if (baj.bombaEnId?.includes('|')) {
        const [pp, pi] = baj.bombaEnId.split('|');
        const engMismoPiso =
          String(eng._loadedPlanId ?? '') === pp
            ? {
                bajantes: eng.bajantes as unknown as InheritPoolBajante[],
                ramales: eng.ramales as unknown as InheritPoolRamal[],
              }
            : null;
        agg = mapUdBombaDesdeTrazos(pp, pi, netId, engMismoPiso);
      } else if (baj.origenId?.includes('|')) {
        // Asociación cross-floor: el panel del bajante muestra el LIBRO heredado, no el
        // árbol — el espejo copia lo mismo o la salida queda en 0 con el bajante lleno
        // (orig. usuario: bajante con 2 UDs, ramal de salida sin nada).
        const espejo = aggParaEspejoSalida(
          agg,
          libroHeredado({ ucAplicado: trazBooks.get(baj.id) }),
        );
        if (!espejo) continue;
        agg = espejo;
      }
      if (!Object.keys(agg).length) continue;
      for (const rid of exitsDeBajante(baj.id)) {
        const rk = pkey(rid);
        // REEMPLAZO (antes fusión): el ramal de salida es un ESPEJO de solo lectura del
        // elemento (inc/dec bloqueados) — conservar valores viejos en su clave mantenía
        // viva cualquier inflación pasada y la re-mostraba para siempre. El reemplazo la
        // sana al agregado exacto en el próximo pase (orig. usuario: caja AN duplicaba UDs).
        if (syncMirrorKey(disk, rk, agg, false)) p.dirty = true;
      }
    }
  }
}
