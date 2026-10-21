import { cntIgual, cntVacio, limpiar, sumaCnt, type Ctx } from './counting.ts';
import { despacharStorage } from './books';
import { setUltimaDiag } from './books';
import { saveToStorage } from '../../services/storageService.ts';

/** Avisa a tablas y panel que los conteos cambiaron (tolerante si no hay window). */
import {
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
} from '../../constants/storage-keys.ts';

const APARATOS_KEY = 'aparatos_by_tramo_v2';
const HEREDADOS_KEY = APARATOS_HEREDADOS_KEY;
const HEREDADOS_TRIB_KEY = APARATOS_HEREDADOS_TRIB_KEY;

/**
 * Fase 6: delta idempotente por clave + libros nuevos. Solo escribe si algo cambió (en estado
 * estable actual = manual + fold + her y los libros coinciden -> cero escrituras).
 */
export function escribirDelta(ctx: Ctx): void {
  const {
    ramales,
    disk,
    libros,
    librosTrib,
    heredadoDe,
    heredadoAsocDe,
    foldDe,
    foldNDe,
    tribFoldDe,
    manualDe,
    bajadasDown,
    diag,
    bajes,
    transferencias,
    aristas,
  } = ctx;
  // 6) Delta idempotente por clave + libros nuevos. Solo escribe si algo cambió: en estado
  //    estable actual = manual + fold + her y los libros coinciden → cero escrituras.
  //    El fold del libro fusiona plegado + aristas-trib (ambos cuentan como propia).
  let dirty = false;
  for (const r of ramales) {
    // Heredado del DFS + el heredado de la asociación entre pisos (el Ldesvio): el primero
    // viene de las aristas de este piso, el segundo de otro piso (no hay arista que lo traiga).
    const her = limpiar(sumaCnt(heredadoDe.get(r.key) || {}, heredadoAsocDe.get(r.key) || {}));
    // Down-trib: su libro registra el fold invertido (lo mismo que su disco suma) — con el
    // foldDe general (que excluye consumidas) fase A divergía +consumida/corrida.
    const foldRecibido = bajadasDown.has(r.key)
      ? foldNDe.get(r.key) || {}
      : foldDe.get(r.key) || {};
    const fold = limpiar(sumaCnt(foldRecibido, tribFoldDe.get(r.key) || {}));
    const prev = libros[r.key] || {};
    const prevFold = librosTrib[r.key] || {};
    const cur = disk[r.key] || {};
    // Down-trib: el fold invertido ya vive dentro de su manual — la base del escritor es
    // manual MÁS lo trib-recibido por arista directa (sin él, la cascada que baja por un
    // down-trib se escribía al libro pero jamás al disco, orig. test cascada T2RAC3).
    // Contar ADEMÁS el foldDe duplicaba la transferencia (tina ×2) — ese sí queda fuera.
    // Límite conocido: trib que A LA VEZ es hijo plegado y trae arista al mismo down-padre
    // contaría doble (0 casos en la suite; el diag herTrib lo delataría).
    const base = bajadasDown.has(r.key)
      ? sumaCnt(manualDe.get(r.key) || {}, tribFoldDe.get(r.key) || {})
      : sumaCnt(manualDe.get(r.key) || {}, fold);
    const nuevo = limpiar(sumaCnt(base, her));
    if (!cntIgual(prev, her)) {
      if (cntVacio(her)) delete libros[r.key];
      else libros[r.key] = her;
      dirty = true;
    }
    if (!cntIgual(prevFold, fold)) {
      if (cntVacio(fold)) delete librosTrib[r.key];
      else librosTrib[r.key] = fold;
      dirty = true;
    }
    if (!cntIgual(cur, nuevo)) {
      if (cntVacio(nuevo)) delete disk[r.key];
      else disk[r.key] = nuevo;
      dirty = true;
    }
  }
  if (dirty) {
    saveToStorage(APARATOS_KEY, disk);
    saveToStorage(HEREDADOS_KEY, libros);
    saveToStorage(HEREDADOS_TRIB_KEY, librosTrib);
  }
  // El evento se despacha SIEMPRE (no solo si cambió algo): el panel derecho lee los conteos
  // de su estado React — sin evento tras una corrida limpia, un estado rancio (captura previa
  // a la limpieza) se quedaba pintado para siempre (orig. usuario: INO ×2 fantasma en RAF1).
  // Contrapartida consciente (auditoría #8): cada selección re-despacha aunque nada cambie;
  // los consumidores re-lean con debounce y el cálculo es barato. No revertir sin resolver
  // antes el estado rancio del panel (hallazgo #5).
  despacharStorage();
  diag.diskFinal = disk;
  diag.libros = libros;
  diag.librosTrib = librosTrib;
  diag.transferencias = [...transferencias.entries()];
  diag.aristas = aristas.map((a) => a.tipo + ':' + a.from + '→' + a.to);
  diag.bajadas = [...bajadasDown];
  // Bajantes AL FINAL: el ucAplicado refrescado por 5bis ya está aplicado.
  diag.bajantes = bajes.map((b) => ({
    id: b.id,
    code: b.code || b.id,
    tipo: b.tipo || '',
    x: b.x ?? 0,
    y: b.y ?? 0,
    alimentaIds: b.alimentaIds || [],
    recibeDeIds: b.recibeDeIds || [],
    ucAplicado: b.ucAplicado || {},
  }));
  setUltimaDiag(diag);
}
