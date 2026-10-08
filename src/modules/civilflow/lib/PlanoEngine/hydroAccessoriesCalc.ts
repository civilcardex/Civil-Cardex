import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import type { HidroTramoEntry } from './sanAccessoriesCalc';

export function calcHydroAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  // Recuento genérico de accMed/accesorios de extremo — aplica a todas las redes menos 'san',
  // que tiene su propia detección de uniones basada en ángulos en calcSanitaryAccessories (arriba).
  const HYDRO_NETS = ['af', 'ac', 'll', 'vent', 'gas', 'recolectora', 'rci', 'rec', 'bom'];
  const ramales = engine.ramales.filter((r) => HYDRO_NETS.includes(r.net));
  if (ramales.length === 0) return;

  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  let changed = false;

  for (const r of ramales) {
    const rKey = `${r.net}_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};
    const acc = hidroData[rKey].accesorios;

    const TEE_LADO_ALIAS = new Set(['teeTapon', 'teeLlaveTerminal', 'teeSube', 'teeBaja']);
    const counts: Record<string, number> = {};
    const bump = (acc: string | undefined) => {
      if (!acc) return;
      counts[acc] = (counts[acc] || 0) + 1;
      if (TEE_LADO_ALIAS.has(acc)) counts['teeLado'] = (counts['teeLado'] || 0) + 1;
    };
    bump(r.accesorioInicio);
    bump(r.accesorioFin);
    if (r.accMed) {
      for (const val of Object.values(r.accMed)) {
        if (!val) continue;
        bump(val);
      }
    }

    // Las bajantes de LL (aguas lluvias) funcionan igual que las de SAN — un codo90rmSube/Baja
    // se infiere según la dirección a la que esté PUESTA actualmente la bajante conectada,
    // recalculado de nuevo cada vez (como hace calcSanitaryAccessories con SAN) en lugar de un
    // único escrito que queda obsoleto si la dirección cambia después. El equivalente de montante
    // en AF/AC en cambio vuelve a sincronizar un valor escrito de accesorioInicio/Fin al cambiar
    // la dirección (BajanteDirectionSelector de bajanteMenu.tsx), ya que el codo de
    // un montante vive en un campo de glifo visual ya existente — las bajantes de LL no tienen ese
    // escrito en absoluto, así que no hay nada que sincronizar; se calcula aquí en su lugar.
    if (r.net === 'll' && !r.esCanalId) {
      // Ramal de canal EXCLUIDO (orig. usuario): su codo 90° baja vive en accesorioInicio
      // (glifo en la salida del canal) — la inferencia por recibeDeIds lo contaría DOBLE.
      for (const baj of engine.bajantes) {
        if (baj.net !== 'll' || baj.tipo !== 'bajante') continue;
        if (!baj.recibeDeIds?.includes(r.id)) continue;
        const codoId =
          baj.direccion === 'sube'
            ? 'codo90rmSube'
            : baj.direccion === 'baja'
              ? 'codo90rmBaja'
              : null;
        if (codoId) counts[codoId] = (counts[codoId] || 0) + 1;
      }
    }

    // Item 8: en AF/AC, un aparato (distinto de nevera) en un extremo implica un codo 90° sube
    // implícito — se dibuja junto al aparato y se cuenta como accesorio. La nevera queda
    // excluida porque su acometida no sube.
    if (r.net === 'af' || r.net === 'ac') {
      for (const app of [r.aparatoInicio, r.aparatoFin]) {
        if (app && app !== 'nev') {
          counts['codo90rmSube'] = (counts['codo90rmSube'] || 0) + 1;
        }
      }
    }

    const customKeys = new Set(Object.keys(counts));
    const storedKeys = new Set(Object.keys(acc));
    const allKeys = new Set([...customKeys, ...storedKeys]);
    for (const k of allKeys) {
      const desired = counts[k] || 0;
      const current = acc[k] || 0;
      if (desired !== current) {
        if (desired > 0) acc[k] = desired;
        else delete acc[k];
        changed = true;
      }
    }
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}
