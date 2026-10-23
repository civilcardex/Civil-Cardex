import type { EspejosArgs } from './fixtureMirrorsTypes.ts';
import {
  refreshMontanteBooksFromUpper,
  type MontanteLinkLike,
} from './montanteInheritanceRefresh.ts';
import { espejarSalidas } from './salidasEspejo.ts';
import { heredarEntrePisos } from './herenciaCrossFloor.ts';
import {
  loadAll,
  loadHidroData,
  loadPropioSnap,
  saveAll,
  saveHidroData,
  savePropioSnap,
} from '../fixturesStorage.ts';
import { propagarHerenciaBomba } from '../../utils/pumpAssociation';

/** (3) Espejos de salidas + herencia entre pisos + bomba: el efecto grande, mantiene las
 *  claves espejo al día cada vez que algo cambia. Orquestador: arma los guards de piso y el
 *  estado del pase, corre los bloques (salidas → bomba → herencia cross-floor → montantes)
 *  y persiste UNA vez por almacén al final. */
export function correrEspejos(a: EspejosArgs): void {
  const { engineRef, loadingPlanRef, netId, planId, plans, setCounts, setHidroData } = a;
  const eng = engineRef.current;
  if (!eng) return;
  // Carrera de cambio de piso (orig. usuario): `_loadedPlanId` ya apunta al piso entrante
  // pero `eng.bajantes` aún es el piso anterior — escribir aquí estampaba claves/libros con
  // el sufijo de piso equivocado.
  if (loadingPlanRef?.current) return;
  // Piso dueño del motor. Un bajante con OTRO `pisoBase` es la PROYECCIÓN de entrepiso: sus
  // punteros `descargaEnId`/`origenId` son del piso que lo dibujó y el bajante local con el
  // MISMO id ya se procesa por su cuenta. Procesarla creaba un enlace al PROPIO piso cargado
  // (empate de nivel de `origenId`) y el grupo se volvía a sumar en cada pase — los conteos
  // san crecían al cambiar de piso (orig. usuario). Sin `pisoBase` (docs viejos) se procesa.
  const loadedLbl = eng.nivelActual?.label ?? '';
  const esDeEstePiso = (b: { pisoBase?: string }) =>
    !loadedLbl || !b.pisoBase || b.pisoBase === loadedLbl;
  const pkey = (rid: string) => (planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`);
  const pase = {
    eng,
    netId,
    planId: planId ?? '',
    disk: loadAll(),
    hdisk: loadHidroData(),
    // Foto de lo PROPIO de cada clave espejo (ver APARATOS_PROPIO_KEY): el espejo transporta
    // `propio + grupo heredado` y el libro del doc dice cuánto se heredó. Si el doc perdió esa
    // entrada, sin la foto el pase siguiente tomaba la herencia como conteo propio y la volvía
    // a sumar: los UD (Unidades de Desague) crecían a cada cambio de piso.
    propioSnap: loadPropioSnap(),
    dirty: false,
    hdirty: false,
    snapDirty: false,
    esDeEstePiso,
    pkey,
    agregadoBajante: a.agregadoBajante,
    exitsDeBajante: a.exitsDeBajante,
  };
  espejarSalidas(pase);
  // BOMBA → BAJANTE del piso superior (orig. usuario): la clave de la bomba (= agregado de
  // su caja, espejado arriba) hereda a los ramales del bajante (recibe+alimenta) vía libro
  // `ucAplicado` — MISMA mecánica de delta que la herencia hacia abajo, pero hacia ARRIBA.
  // Campo dedicado `bombaEnId`: descargaEnId/origenId dispararían la herencia invertida.
  // Una sola implementación (ver `propagarHerenciaBomba`): también la usa `asociarBomba`
  // para propagar sincrónicamente al marcar.
  if (propagarHerenciaBomba(eng, planId, netId, pase.disk)) pase.dirty = true;
  const loadedPid = planId != null ? String(planId) : '';
  // npt = NIVEL del plano (PlanItem.nivel). ANTES leía `p.npt` — campo que NO existe en
  // PlanItem → guard siempre nulo → "desconocido = procesar" dejaba al piso INFERIOR
  // escribir el enlace invertido: sumaba sus UD locales a la herencia y envenenaba el piso
  // superior (orig. usuario: 12 UD abajo → 16 al reentrar; trinquete que nunca baja).
  // Ahora, sin nivel conocido NO se procesa (el efecto re-corre cuando `plans` llega — ya
  // está en sus deps).
  // Índice id→plan: el .find por cada puntero entre pisos era O(plans) por puntero.
  const planPorId = new Map<string, { nivel?: number | null }>(
    plans.map((p) => [String(p.id), p] as const),
  );
  const nptOf = (pid: string): number | null => {
    const n = planPorId.get(pid)?.nivel;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };
  const loadedNpt = loadedPid ? nptOf(loadedPid) : null;
  heredarEntrePisos(pase, planPorId, loadedPid, loadedNpt, nptOf);
  // PARIDAD CON BAJANTES (orig. usuario): el montante ASOCIADO del piso abierto re-computa su
  // libro leyendo el storage del piso de arriba (detalle y doctrina en el helper).
  if (
    refreshMontanteBooksFromUpper({
      bajantes: eng.bajantes as unknown as MontanteLinkLike[],
      loadedPid,
      loadedNpt,
      nptOf,
      disk: pase.disk,
      hdisk: pase.hdisk,
    })
  )
    pase.dirty = true;
  if (pase.dirty) {
    saveAll(pase.disk);
    setCounts(pase.disk);
    // Tablas y paneles que leen claves (InfTab, diseño, validación) deben reconstruirse al
    // momento — sin estos eventos el bajante asociado a bomba quedaba con el valor viejo
    // hasta tocar algo a mano (orig. usuario, problema de sincronización 2).
    try {
      window.dispatchEvent(new CustomEvent('aparatos-clear'));
      window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
      window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
    } catch {
      /* sin window (tests) */
    }
  }
  if (pase.hdirty) {
    saveHidroData(pase.hdisk);
    setHidroData(pase.hdisk);
  }
  // La foto de lo propio se guarda aunque no haya nada que re-renderizar: es la memoria que
  // impide que un doc atrasado haga crecer los conteos en el próximo pase.
  if (pase.snapDirty) savePropioSnap(pase.propioSnap);
}

/** Grupo de efectos de espejos del panel (se disparan con los mismos datos que los efectos originales). */
