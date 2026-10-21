import { cntVacio, sumaCnt, type Cnt, type Ctx } from './counting.ts';
import {
  APARATOS_RESIDUO_BAK_KEY,
  BAJADAS_RECEPTORAS_KEY,
} from '../../constants/storage-keys.ts';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { isLdesvioRamalId } from '../associateBajanteAcrossFloors';

/**
 * Fase 4: manual verdadero + plegado de tributarios, en DOS fases sin mutar lo leído.
 * El manual de cada tramo = actual - libroHer - libroTrib; el plegado reparte lo que cuelga
 * de los hijos (tributarios) hacia el padre.
 */
export function calcularPlegado(ctx: Ctx): void {
  const {
    ramales,
    disk,
    libros,
    librosTrib,
    downTrib,
    transferencias,
    padresDeDown,
    ramalesPorPlano,
    cadenaTrib,
    bajadasLibro,
    bajadasDown,
  } = ctx;
  // 4) Manual verdadero + plegado de tributarios, en DOS fases sin mutar lo leído
  //    (orig. auditoría: el plegado in-place re-sumaba +1 por corrida y dependía del orden).
  //    Fase A: manual crudo = actual − libroHer − libroTrib.
  //    Fase B (hijos antes que padres): foldRecibido[K] = Σ hijos (manual + foldRecibido);
  //    manual[K] = manualCrudo[K] − foldRecibido[K]. TIRAF-n → RAF-n → salidas de la unión.
  const manualCrudoDe = new Map<string, Cnt>();
  // Carga heredada de la asociación entre pisos (el Ldesvio): no es "propio" (el Ldesvio no
  // tiene aparato) pero tampoco residuo — entra al heredado para que sobreviva y para que
  // baje aguas abajo como cualquier otra carga heredada.
  const heredadoAsocDe = new Map<string, Cnt>();
  for (const r of ramales) {
    const cur = disk[r.key] || {};
    const prev = libros[r.key] || {};
    const prevTrib = librosTrib[r.key] || {};
    const crudo: Cnt = {};
    for (const k of new Set([
      ...Object.keys(cur),
      ...Object.keys(prev),
      ...Object.keys(prevTrib),
    ])) {
      crudo[k] = Math.max(0, (cur[k] || 0) - (prev[k] || 0) - (prevTrib[k] || 0));
    }
    // SIN campo aparatoInicio/Fin NO hay aparato propio (orig. usuario dump 2026-10-15:
    // RAC2/RAC4/RAC5 arrastraban conteos fantasma de doctrinas viejas sin campo — el campo
    // que escribe la asignación es la única verdad de lo propio; el resto se limpia).
    // Los espejos de salida (cross-floor) tampoco tienen campo y tampoco son manual: caen
    // aquí de forma correcta. Solo se respalda lo que realmente se borra para recuperar
    // (ver APARATOS_RESIDUO_BAK_KEY: si la limpieza fue ilegítima, copiar su valor de vuelta
    // a `aparatos_by_tramo_v2` restaura los conteos).
    if (!r.aparatoInicio && !r.aparatoFin) {
      // EL LDESVIO no tiene aparato propio, pero su carga es REAL: viene del piso de arriba
      // (asociación entre pisos). Si se limpia como residuo, el Ldesvio y el montante de abajo
      // se quedan sin UC y la cadena de pisos pierde la carga (orig. usuario: los montantes
      // asociados entre pisos deben tomar los MISMOS aparatos). Se conserva como HEREDADA.
      if (isLdesvioRamalId(r.id)) {
        const carga = disk[r.key] || {};
        if (!cntVacio(carga)) heredadoAsocDe.set(r.key, carga);
        manualCrudoDe.set(r.key, {});
        continue;
      }
      // Mecanismo, no residuo: el down-trib y las consumidas/padres reciben carga por
      // transferencia — su "crudo" reaparece cada corrida por diseño; respaldarlo/loguearlo
      // spamearía el backup y la consola en cada propagación estable.
      const esMecanismo =
        downTrib.has(r.key) || transferencias.has(r.key) || padresDeDown.has(r.key);
      if (!cntVacio(crudo) && !esMecanismo) {
        try {
          const bak = loadFromStorage<Record<string, Cnt>>(APARATOS_RESIDUO_BAK_KEY, {}) || {};
          bak[r.key] = { ...(bak[r.key] || {}), ...crudo };
          saveToStorage(APARATOS_RESIDUO_BAK_KEY, bak);
        } catch {
          /* sin respaldo (tests sin storage real) */
        }
      }
      manualCrudoDe.set(r.key, {});
      continue;
    }
    manualCrudoDe.set(r.key, cntVacio(crudo) ? {} : crudo);
  }
  // NOTA poda-por-crudo retirada: el manual del receptor incluye lo transferido de
  // corridas previas y es indistinguible de asignación manual en disco — podar por crudo
  // desestabiliza (oscila). El fósil por borrado lo cubre la poda de ausentes de arriba;
  // el receptor con aparato manual queda documentado como lateral pendiente (el panel lo
  // bloquea vía esPropagado en la mayoría de vías).
  // Hijos tributarios por padre (mismo plano): `${id}|${pid}`.
  const hijosDe = new Map<string, string[]>();
  const porKey = new Map(ramales.map((r) => [r.key, r]));
  for (const [consumida, receptor] of transferencias) {
    if (!hijosDe.has(receptor)) hijosDe.set(receptor, []);
    if (!hijosDe.get(receptor)!.includes(consumida)) hijosDe.get(receptor)!.push(consumida);
  }
  for (const t of ramales) {
    if (t.tipo !== 'tributario' || !t.padre) continue;
    const padreKey = ramalesPorPlano.get(t.pid)?.get(t.padre || '')?.key;
    if (!padreKey) continue; // huérfano/legacy: participa en clústeres como fallback
    // Consumida por una bajada: su carga ya va al receptor (evitar doble plegado).
    if (transferencias.has(t.key)) continue;
    // Cadena: su carga viaja por las aristas de cascada — plegar sería doble conteo.
    if (cadenaTrib.has(t.key)) continue;
    // Down-trib: pliegue INVERTIDO — el PADRE es su hijo (descarga toda su carga en él,
    // 2bis); no sube al padre como un tributario normal.
    if (downTrib.has(t.key)) {
      if (!hijosDe.has(t.key)) hijosDe.set(t.key, []);
      if (!hijosDe.get(t.key)!.includes(padreKey)) hijosDe.get(t.key)!.push(padreKey);
      continue;
    }
    if (!hijosDe.has(padreKey)) hijosDe.set(padreKey, []);
    hijosDe.get(padreKey)!.push(t.key);
  }
  // Orden hijos-antes-que-padres (post-orden con corte de ciclo en links padre).
  const ordenHojasPrimero: string[] = [];
  {
    const visitado = new Set<string>();
    const enPila = new Set<string>();
    const visitar = (key: string): void => {
      if (visitado.has(key) || enPila.has(key)) return; // ciclo: corta
      enPila.add(key);
      for (const h of hijosDe.get(key) || []) visitar(h);
      enPila.delete(key);
      visitado.add(key);
      ordenHojasPrimero.push(key);
    };
    for (const r of ramales) visitar(r.key);
  }
  const manualDe = new Map<string, Cnt>(); // manual verdadero (sin plegado)
  const foldDe = new Map<string, Cnt>(); // plegado recibido de tributarios
  // Fold invertido de cada down-trib (padre + consumidas de su unión): el libro del down
  // debe registrar EXACTO lo que su disco suma (si no, fase A diverge +consumida/corrida).
  const foldNDe = new Map<string, Cnt>();
  for (const key of ordenHojasPrimero) {
    let fold: Cnt = {};
    for (const h of hijosDe.get(key) || []) {
      // Consumida transferida a esta clave: su carga llega por el DFS como heredado del
      // receptor (ver calcDe) — plegarla aquí también la duplicaría en Σ y la escondería
      // del libro `her` que lee el panel (orig. test bajada-RAC3: lavav ×2).
      if (transferencias.get(h) === key) continue;
      fold = sumaCnt(fold, sumaCnt(manualDe.get(h) || {}, foldDe.get(h) || {}));
    }
    foldDe.set(key, fold);
    const crudo = manualCrudoDe.get(key) || {};
    const dn = downTrib.get(key);
    if (dn) {
      // Down-trib: TRANSFERENCIA — todo lo que cuelga de él (su padre y las piezas
      // consumidas en la unión) pasa a su clave por el fold invertido (con libro
      // librosTrib — idempotente). Los hijos CONSERVAN lo propio (patrón tributario).
      let foldN: Cnt = {};
      for (const h of hijosDe.get(key) || []) {
        foldN = sumaCnt(foldN, sumaCnt(manualDe.get(h) || {}, foldDe.get(h) || {}));
      }
      manualDe.set(key, sumaCnt(manualCrudoDe.get(key) || {}, foldN));
      foldNDe.set(key, foldN);
      bajadasDown.add(key);
      // Persistente: sin esto el down-trib aislado (sin clúster ≥2) perdía su marca al
      // recargar y la doctrina se auto-cancelaba en la corrida 2.
      if (!bajadasLibro[key]) {
        bajadasLibro[key] = 1;
        saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
      }
      continue;
    }
    const manual: Cnt = {};
    for (const k of new Set([...Object.keys(crudo), ...Object.keys(fold)])) {
      manual[k] = Math.max(0, (crudo[k] || 0) - (fold[k] || 0));
    }
    // NOTA (transferencias bajada): la carga de las consumidas NO se suma aquí — llega por
    // el DFS como heredado del receptor (base de la consumida, ver calcDe). Sumarla aquí
    // TAMBIÉN duplicaba corrida tras corrida (orig. test bajada-RAC3: lavav ×3).
    manualDe.set(key, cntVacio(manual) ? {} : manual);
  }

  ctx.manualCrudoDe = manualCrudoDe;
  ctx.heredadoAsocDe = heredadoAsocDe;
  ctx.foldDe = foldDe;
  ctx.manualDe = manualDe;
  ctx.foldNDe = foldNDe;
  ctx.porKey = porKey;
}
