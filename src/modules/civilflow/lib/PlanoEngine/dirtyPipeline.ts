/**
 * Pipeline de trabajo sucio del motor: recalcula conexiones de red y accesorios, guarda un
 * snapshot de historial y dispara onDirty (que es quien guarda a disco/BD), y revisa las
 * tuberías a presión avisando UNA vez por problema nuevo. Extraído verbatim de PlanoEngine.ts.
 * Ej: tras arrastrar un vértice, _markDirty re-corre toda la cadena sin romper el guardado.
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import { devError } from '../../../../utils/devError.ts';
import { chequearRed, REDES_PRESION } from './nodos';
import {
  calcSanitaryAccessories,
  calcHydroAccessories,
  autoDetectRamalConnections,
  podarReferenciasStaleDeBajantes,
  ensureRpCntRamal,
} from './PlanoEngineNetwork.ts';
import { sellarAsociacionesCanalBajante } from './channelAssociation';
import { fixVentCodoToTee } from './ventElbowTeeFix';
import { healTribPadres } from './junctionAutoSplit.ts';

/** Revisa las tuberías a presión — af (Agua Fría), ac (Agua Caliente), gas (Gas) y rci (Red Contra
 *  Incendio): cada tramo debe tener por dónde le llega el agua y por dónde sale. Avisa UNA vez por
 *  problema nuevo (el hash evita el mismo modal en cada clic). */
export function chequearPresionGlobal(engine: IPlanoEngineCore): void {
  const eng = engine as IPlanoEngineCore & { _chequeoHash: Record<string, string> };
  const nets = new Set<string>();
  for (const r of engine.ramales) if (REDES_PRESION.has(r.net || '')) nets.add(r.net);
  for (const net of nets) {
    const incs = chequearRed(engine, net);
    const errores = incs.filter((i) => i.nivel === 'error');
    const hash = errores.map((i) => `${i.tipo}:${i.ramalId}`).join('|');
    const antes = eng._chequeoHash[net];
    if (antes === hash) continue;
    eng._chequeoHash[net] = hash;
    // Primera pasada tras CARGAR un plano existente: silenciosa (no molestar al abrir).
    if (antes === undefined) continue;
    if (!hash) continue; // quedó limpio: sin alerta
    const lista = errores.map((i, ix) => `${ix + 1}. ${i.msg}`).join('\n');
    engine.triggerAlert(`Red ${net.toUpperCase()} — ${errores.length} incidencia(s)`, lista);
  }
}

/** Marca el trabajo como sucio: recalcula conexiones de red y accesorios, guarda un snapshot
 *  de historial y dispara el callback onDirty (que es quien guarda a disco/BD). */
export function markDirty(engine: IPlanoEngineCore): void {
  engine._dirty = true;
  // ponytail: los cálculos de red/contadores NO deben romper el guardado. El callback
  // _onDirtyCb (PdfViewer) es quien hace saveWork()+saveTrazosToDB(); si un cálculo lanza
  // antes, el guardado se perdía en silencio. Se aísla cada paso y siempre se notifica dirty.
  try {
    autoDetectRamalConnections(engine);
    // Poda de referencias stale (después del auto-detect: fin/ini ya saneados) — un trazo
    // recortado/borrado deja de figurar en recibeDeIds/alimentaIds de la caja/bajante.
    podarReferenciasStaleDeBajantes(engine);
    // Sello automático canal↔bajante por ramal (solo suma campos explícitos para que
    // menús/paneles lo muestren; nunca lanza).
    sellarAsociacionesCanalBajante(engine);
  } catch (e) {
    devError('PlanoEngine _markDirty autoDetect:', e);
  }
  try {
    ensureRpCntRamal(engine);
  } catch (e) {
    devError('PlanoEngine _markDirty ensureRpCnt:', e);
  }
  try {
    // ponytail: vent codo 90° that now forms T must become T, before counting
    fixVentCodoToTee(engine);
  } catch (_e) {
    void _e;
  }
  try {
    // Sanado global de padres de tributarios: el label manda (T{n}{raíz}) — cualquier
    // camino que haya asignado un padre equivocado al tramo autocreado queda corregido.
    healTribPadres(engine);
  } catch (e) {
    devError('PlanoEngine _markDirty healTribPadres:', e);
  }
  try {
    calcSanitaryAccessories(engine);
  } catch (e) {
    devError('PlanoEngine _markDirty calcSanitary:', e);
  }
  try {
    calcHydroAccessories(engine);
    chequearPresionGlobal(engine);
  } catch (e) {
    devError('PlanoEngine _markDirty calcHydro:', e);
  }
  try {
    const hist = (engine as unknown as { _history?: { saveSnapshot(): void } })._history;
    if (hist) {
      hist.saveSnapshot();
    }
  } catch (e) {
    devError('PlanoEngine _markDirty history:', e);
  }
  if (engine._onDirtyCb) engine._onDirtyCb();
}
