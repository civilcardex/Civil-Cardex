import { writeHidroDrawingSync } from './hydroDrawingSync';
import { writeSanDrawingSync } from './sanitaryDrawingSync';
import { safeParse } from './parseUtils';

const TRAZOS_PREFIX = 'civilflow_trazos_';
const HIDRO_FAMILIES = new Set(['af', 'ac']);
const SAN_FAMILIES = new Set(['san', 'll']);

export function deleteRamalFromDrawing(ramalId, net, planos) {
  if (!ramalId || !net || !planos) return;
  const isHidro = HIDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  for (const plano of planos) {
    if (!plano || plano.status !== 'confirmed') continue;
    const key = TRAZOS_PREFIX + plano.id;
    const raw = safeParse(localStorage.getItem(key), null);
    if (!raw) continue;
    const data = typeof raw === 'string' ? safeParse(raw, {}) : raw;

    const before = (data.ramales || []).length;
    data.ramales = (data.ramales || []).filter(r => !(r.id === ramalId && r.net === net));
    if ((data.ramales || []).length < before) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  if (isHidro) writeHidroDrawingSync(planos);
  if (isSan) writeSanDrawingSync(planos);
}

export function writeDiametroToDrawing(ramalId, net, newDiamLabel, planos) {
  if (!ramalId || !net || !planos) return;
  const isHidro = HIDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  for (const plano of planos) {
    if (!plano || plano.status !== 'confirmed') continue;
    const key = TRAZOS_PREFIX + plano.id;
    const raw = safeParse(localStorage.getItem(key), null);
    if (!raw) continue;
    const data = typeof raw === 'string' ? safeParse(raw, {}) : raw;
    let changed = false;

    for (const r of (data.ramales || [])) {
      if (r.id === ramalId && r.net === net) {
        r.diametro = newDiamLabel;
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  if (isHidro) {
    writeHidroDrawingSync(planos);
  }
  if (isSan) {
    writeSanDrawingSync(planos);
  }
}
