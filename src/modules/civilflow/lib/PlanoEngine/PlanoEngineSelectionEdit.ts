import type { PlanoRamal, PlanoBajante, PlanoArea, PlanoTextAnnotation } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { getSelected } from './PlanoEngineSelection';
import { _midpoint, bumpBajanteToMaxRamal, followBajanteToMaxRamal } from './PlanoEngineDrawing';
import { recomputeDownstreamDiameters } from './drawingUtils';
import {
  diametroCambioPermitido,
  propagarSanDiametroAguasAbajo,
  sanDiametroPermitido,
} from './drawingFlow';
import { updateCrossFloorGhostFieldBySource } from '../../utils/associateBajanteAcrossFloors';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { checkVentDiameterLimits, syncVentBajanteDiameters } from './ventDiameters';

// Mutaciones de selección/edición del motor: update de tramos por engine/id, guard de diámetro
// de nodo, propagación a bajantes conectados y snaps de etiqueta. Extraído verbatim de
// PlanoEngineSelection (des-monolitización 2026-10-06).

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
  // LDESVIO de bomba (orig. usuario): su diámetro no puede superar el del bajante asociado
  // (padre = id sin 'LD_'). Alerta + bloqueo.
  const elId = (el as { id?: string }).id || '';
  if (fields.diametro !== undefined && elId.startsWith('LD_')) {
    const padre = engine.bajantes?.find((b) => b.id === elId.slice(3));
    const dPulg = (v: string) => {
      const q = parseFloat(v) || parseFloat((v || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(q) ? q : 0;
    };
    const nuevo = dPulg(String(fields.diametro));
    const tope = dPulg(padre?.dNominal || '');
    if (tope > 0 && nuevo > tope + 0.01) {
      engine.triggerAlert(
        'Diámetro no permitido',
        `El Ldesvio no puede tener un diámetro mayor al del bajante (${padre?.dNominal || '—'}).`,
      );
      engine.render();
      return;
    }
  }
  // CAJAS (orig. usuario): sin propiedades hidráulicas — diámetro/material/pendiente no se
  // escriben en el modelo, ni viniendo del panel, menú o copia. Las cajas ya están fuera de
  // tablas y cálculo (0 refs en sanitaryRows/sanAccesoriosRows).
  if (
    el &&
    ((el as { tipo?: string }).tipo === 'caja_san' || (el as { tipo?: string }).tipo === 'caja_ll')
  ) {
    const bloqueadas = ['diametro', 'material', 'pendiente', 'dNominal', 'diamPulg'].filter(
      (k) => fields[k] !== undefined,
    );
    if (bloqueadas.length) {
      const rest = { ...fields };
      for (const k of bloqueadas) delete rest[k];
      if (engine.triggerAlert)
        engine.triggerAlert(
          'Caja sin propiedades hidráulicas',
          'La caja no admite diámetro, material ni pendiente.',
        );
      if (!Object.keys(rest).length) {
        engine.render();
        return;
      }
      fields = rest;
    }
  }
  // Diámetro previo para el seguimiento del bajante (follow en ambas direcciones).
  const prevRamDiam =
    el && fields.diametro !== undefined && (el as PlanoRamal).pts
      ? (el as PlanoRamal).diametro || ''
      : '';
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    if (!guardDiametroNodo(engine, el, fields)) {
      engine.render();
      return;
    }
    // Sincronía bajante→ramal san/ll (orig. usuario): igual que updateElementById.
    if (fields.dNominal !== undefined && !(el as PlanoRamal).pts && el.id) {
      if (!pushBajanteDiameterToRamales(engine, el.id, String(fields.dNominal ?? ''))) {
        engine.render();
        return;
      }
    }
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      if (!(el as PlanoRamal).labelMoved) {
        const [mx, my] = _midpoint((el as PlanoRamal).pts);
        (el as PlanoRamal).labelX = mx;
        (el as PlanoRamal).labelY = my;
      }
    }
    // Item 2: sincronizar diámetros de bajantes de ventilación conectados al
    // mismo bajante sanitario. Si se cambia el dNominal de un bajante vent,
    // todos los demás bajantes vent que descargan en el mismo bajante sanitario
    // toman el mismo diámetro. La conexión se resuelve por descargaEnId (vent →
    // san) y por recibeDeIds del san (incluye vents que descargan en él).
    syncVentBajanteDiameters(engine, el, fields);
    // El cambio de diámetro por el panel (TramoEditor) también arrastra al bajante.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts && el.id) {
      bumpConnectedBajantes(engine, el.id, prevRamDiam, String(fields.diametro ?? ''));
      // Ítems 5+6: igual que updateElementById — receptor = max(alimentadores); san propaga.
      if ((el as PlanoRamal).net === 'san')
        propagarSanDiametroAguasAbajo(engine.ramales, el.id, engine.bajantes);
      else recomputeDownstreamDiameters(engine.ramales, el.id);
    }
    // Ítem 6/8: propagar el elemento mutado al snapshot de selección del panel derecho/ menú
    // contextual (única fuente de verdad). _emitSelect ya emite una copia superficial, así que
    // React recibe una referencia nueva y re-renderiza sin que el usuario deba re-seleccionar.
    engine._emitSelect(el);
  } else {
    return;
  }
  engine.render();
  engine._markDirty();
}

// Validación de diámetros en nodos de presión (salida ≤ entrada) a nivel motor: intercepta
// CUALQUIER escritura de `diametro` sobre un ramal af/ac/gas (menú contextual, TramoEditor,
// editores) y bloquea con alerta la configuración inválida — sin reasignación automática.
// Sanitaria usa la regla inversa en AMBAS direcciones (receptor ≥ alimentador y alimentador ≤
// receptor) vía sanDiametroPermitido.

export function guardDiametroNodo(
  engine: IPlanoEngineCore,
  el: { pts?: number[][]; net?: string; id?: string },
  fields: Record<string, unknown>,
): boolean {
  if (fields.diametro === undefined) return true;
  const ram = el as PlanoRamal;
  if (!ram.pts || (ram.net !== 'af' && ram.net !== 'ac' && ram.net !== 'gas' && ram.net !== 'san'))
    return true;
  const res =
    ram.net === 'san'
      ? sanDiametroPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''))
      : diametroCambioPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''));
  if (!res.ok) {
    engine.triggerAlert('Diámetro no permitido', res.msg || '');
    return false;
  }
  return true;
}

/** Piso del bajante = máximo de sus ramales asociados: sigue al cambio en ambas direcciones
 *  (si seguía al máximo anterior adopta el nuevo; un oversize explícito mayor se conserva).
 *  Se aplica en updateElementById Y updateSelected: cambiar el diámetro por cualquier editor
 *  (menú o panel) arrastra al bajante conectado. @param engine Motor con ramales y bajantes vivos. */

export function bumpConnectedBajantes(
  engine: IPlanoEngineCore,
  ramId: string,
  oldRamD: string,
  newRamD: string,
): void {
  const changedRam = engine.ramales.find((r) => r.id === ramId);
  if (!changedRam?.pts) return;
  const lvlLabel = engine.nivelActual?.label ?? '';
  for (const b of engine.bajantes) {
    if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
    const assocRamIds = b.recibeDeIds || [];
    // ¿conectado a este ramal? (explícito por recibeDeIds o geométrico)
    let isConnected = assocRamIds.includes(ramId);
    if (!isConnected) {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      const bx = b.x + (disp.dx || 0);
      const by = b.y + (disp.dy || 0);
      const head = changedRam.pts[changedRam.pts.length - 1];
      const tail = changedRam.pts[0];
      if (
        Math.hypot(head[0] - bx, head[1] - by) < 2.0 ||
        Math.hypot(tail[0] - bx, tail[1] - by) < 2.0
      )
        isConnected = true;
    }
    if (!isConnected) continue;
    const followed = followBajanteToMaxRamal(
      engine.ramales,
      assocRamIds,
      b.dNominal || '',
      ramId,
      oldRamD,
      newRamD,
    );
    if (followed) b.dNominal = followed;
  }
}

/** Sincronía bajante↔ramal san/ll al EDITAR el dNominal del bajante/montante (orig. usuario,
 *  como las otras redes): el bajante nunca queda por debajo de sus ramales asociados
 *  (bloquea con alerta — primero debe bajarse el ramal), y al subir arrastra a los ramales
 *  con diámetro explícito menor (los vacíos no se tocan: nacen vacíos por doctrina). Los
 *  ramales empujados propagan aguas abajo como una edición propia. Escribe directo en el
 *  motor (sin snapshots); el llamador asigna el dNominal. @returns false si se bloqueó. */

export function pushBajanteDiameterToRamales(
  engine: IPlanoEngineCore,
  bajId: string,
  newDNominal: string,
): boolean {
  const baj = engine.bajantes.find((b) => b.id === bajId);
  if (!baj || (baj.net !== 'san' && baj.net !== 'll')) return true;
  if (baj.tipo !== 'bajante' && baj.tipo !== 'montante') return true;
  const newIn = diamPulgFromLabel(newDNominal || '');
  if (!(newIn > 0)) return true;
  const ramales = [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]
    .map((id) => engine.ramales.find((x) => x.id === id))
    .filter((r): r is PlanoRamal => !!r && !!r.diametro);
  const maxRam = ramales.reduce((m, r) => Math.max(m, diamPulgFromLabel(r.diametro || '')), 0);
  if (maxRam > newIn) {
    const top = ramales.find((r) => diamPulgFromLabel(r.diametro || '') === maxRam);
    engine.triggerAlert(
      'Diámetro no permitido',
      `El diámetro del bajante (${newDNominal}) no puede ser inferior al del ramal conectado (${top?.label || top?.id} ${top?.diametro}). Cambia primero el diámetro del ramal.`,
    );
    return false;
  }
  for (const rr of ramales) {
    if (diamPulgFromLabel(rr.diametro || '') < newIn) {
      rr.diametro = newDNominal;
      if (rr.net === 'san') propagarSanDiametroAguasAbajo(engine.ramales, rr.id, engine.bajantes);
      else recomputeDownstreamDiameters(engine.ramales, rr.id);
    }
  }
  return true;
}

/** Campos para alternar una asociación MANUAL (checkbox menú/panel, orig. usuario):
 *  recibeDeIds/alimentaIds simétricos + libro `asocManual` que exime de la poda stale
 *  (podarReferenciasStaleDeBajantes). Se mezcla en la misma llamada a updateElementById. */
export function camposAsocManual(
  b: PlanoBajante,
  ramalId: string,
  activar: boolean,
): Record<string, unknown> {
  const manual = new Set(b.asocManual || []);
  const recibe = new Set(b.recibeDeIds || []);
  const alimenta = new Set(b.alimentaIds || []);
  if (activar) {
    manual.add(ramalId);
    recibe.add(ramalId);
  } else {
    manual.delete(ramalId);
    recibe.delete(ramalId);
    alimenta.delete(ramalId);
  }
  return { recibeDeIds: [...recibe], alimentaIds: [...alimenta], asocManual: [...manual] };
}

export function updateElementById(
  engine: IPlanoEngineCore,
  id: string,
  fields: Record<string, unknown>,
): void {
  const el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
    engine.ramales.find((r) => r.id === id) ||
    engine.bajantes.find((b) => b.id === id) ||
    engine.textAnnots.find((t) => t.id === id) ||
    engine.areas.find((a) => a.id === id);
  // Diámetro previo para el seguimiento del bajante (follow en ambas direcciones).
  const prevRamDiam =
    el && fields.diametro !== undefined && (el as PlanoRamal).pts
      ? (el as PlanoRamal).diametro || ''
      : '';
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    if (!guardDiametroNodo(engine, el, fields)) {
      engine.render();
      return;
    }
    // Sincronía bajante→ramal san/ll (orig. usuario): editar el dNominal arrastra a los
    // ramales asociados (o se bloquea si quedaría por debajo). Antes de asignar.
    if (fields.dNominal !== undefined && !(el as PlanoRamal).pts) {
      if (!pushBajanteDiameterToRamales(engine, id, String(fields.dNominal ?? ''))) {
        engine.render();
        return;
      }
    }
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      if (!(el as PlanoRamal).labelMoved) {
        const [mx, my] = _midpoint((el as PlanoRamal).pts);
        (el as PlanoRamal).labelX = mx;
        (el as PlanoRamal).labelY = my;
      }
    }
    // Item 2: sincronizar diámetros de bajantes de ventilación conectados al
    // mismo bajante sanitario. updateElementById es el camino real del cambio
    // de dNominal del bajante (bajanteMenu.tsx usa este método).
    syncVentBajanteDiameters(engine, el, fields);
    // Item 2: el bajante/montante toma por defecto el diámetro del trazo al que se
    // conecta; si son varios, el MAYOR de todos. Cuando un ramal cambia de diámetro,
    // recalcular el floor del bajante = max de todos los ramales asociados — nunca
    // queda por debajo. Si el bajante no tenía diámetro, se le asigna este.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts) {
      bumpConnectedBajantes(engine, id, prevRamDiam, String(fields.diametro ?? ''));
    }
    // Al ASOCIAR ramales a un bajante/montante (recibeDeIds), su diámetro sube al mayor de
    // los asociados — nunca queda por debajo (misma regla que al crear el bajante y que el
    // piso por cambio de diámetro de ramal de arriba). Solo sube, nunca baja.
    if (fields.recibeDeIds !== undefined && !(el as PlanoRamal).pts) {
      const b = el as PlanoBajante;
      if (b.tipo === 'bajante' || b.tipo === 'montante') {
        const bumped = bumpBajanteToMaxRamal(engine.ramales, b.recibeDeIds, b.dNominal || '');
        if (bumped) b.dNominal = bumped;
      }
    }
    // Ítems 5+6: cada cambio de diámetro re-dispara el cálculo aguas abajo (suba o baje) —
    // receptor = max(alimentadores) desde la topología actual. Mutación directa (un solo
    // snapshot para toda la operación, el _markDirty de abajo). Cubre menú, panel y aparatos.
    // Sanitaria: cambiar el diámetro desde un ALIMENTADOR no alerta — se ACEPTA y el receptor
    // (y la cadena aguas abajo) sube automáticamente al mayor de los que llegan (nunca baja).
    if (fields.diametro !== undefined && (el as PlanoRamal).pts) {
      if ((el as PlanoRamal).net === 'san')
        propagarSanDiametroAguasAbajo(engine.ramales, id, engine.bajantes);
      else recomputeDownstreamDiameters(engine.ramales, id);
    }
  }
  // Refleja los cambios de propiedad del bajante (dNominal, dirección) a todo fantasma entre
  // pisos que apunte a este bajante, para que la etiqueta de línea punteada del piso destino se
  // mantenga sincronizada sin requerir una acción separada del usuario.
  if (el && (el as PlanoBajante).tipo) {
    if (fields.dNominal !== undefined) {
      updateCrossFloorGhostFieldBySource(
        engine._loadedPlanId ?? '',
        id,
        'dNominal',
        String(fields.dNominal ?? ''),
      );
    }
    if (fields.direccion !== undefined) {
      const dirVal = String(fields.direccion ?? '');
      if (dirVal === 'sube' || dirVal === 'baja') {
        updateCrossFloorGhostFieldBySource(
          engine._loadedPlanId ?? '',
          id,
          'parentDireccion',
          dirVal,
        );
      }
    }
  }
  // Ítem 6/8: propagar el elemento mutado al snapshot de selección (panel derecho / menú
  // contextual) — única fuente de verdad, sin requerir re-selección. SOLO si el editado ES el
  // seleccionado: al editar OTRO elemento desde un menú (asociar bajante/montante desde el
  // menú del ramal, canalId desde el menú del canal), el emit robaba la selección — el menú
  // cambiaba de elemento y el checkbox quedaba rancio (orig. usuario).
  if (el) {
    const sel = getSelected(engine);
    if (sel && sel.id === el.id) engine._emitSelect(el);
  }
  engine.render();
  engine._markDirty();
}

export function rotateLabelSnap(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  const ANGLES = [0, 45, 90, -90, -45];
  if (el.id?.startsWith('T') && (el as PlanoTextAnnotation).text !== undefined) {
    const cur = (el as PlanoTextAnnotation).textAngle || 0;
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
  } else {
    const elLabeled = el as PlanoRamal | PlanoBajante | PlanoArea;
    const cur = elLabeled.labelAngle || 0;
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    elLabeled.labelAngle = ANGLES[(idx + 1) % ANGLES.length];
  }
  engine._emitSelect(el);
  engine.render();
  // Ítem 1: rotar la etiqueta modifica el estado → snapshot para Ctrl+Z.
  engine._markDirty();
}

export function resetLabel(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  if ((el as PlanoRamal).pts) {
    const [mx, my] = _midpoint((el as PlanoRamal).pts);
    const elRamal = el as PlanoRamal;
    elRamal.labelX = mx;
    elRamal.labelY = my;
    elRamal.labelAngle = 0;
  } else {
    // Los bajantes/áreas tienen su propio labelX/Y; los textos se posicionan con x/y — este cast
    // refleja esa forma realmente mezclada, no incertidumbre de tipos.
    const elPositionable = el as {
      labelX?: number;
      labelY?: number;
      labelAngle?: number;
      x?: number;
      y?: number;
    };
    elPositionable.labelX = elPositionable.x;
    elPositionable.labelY = elPositionable.y;
    elPositionable.labelAngle = 0;
  }
  engine.render();
  // Ítem 1: restablecer la etiqueta modifica el estado → snapshot para Ctrl+Z.
  engine._markDirty();
}
