import type { PlanoRamal, PlanoBajante, PlanoArea, PlanoTextAnnotation } from './PlanoEstado.ts';
import type { IPlanoEngineCore } from './PlanoEstado.ts';
import { getSelected } from './PlanoMotorSeleccion.ts';
import { _midpoint, bumpBajanteToMaxRamal, followBajanteToMaxRamal } from './PlanoMotorDibujo.ts';
import { recomputeDownstreamDiameters } from './dibujoUtiles.ts';
import {
  convergirDiametroNodoPresion,
  propagarSanDiametroAguasAbajo,
  sanDiametroPermitido,
} from './dibujoFlujo.ts';
import { updateCrossFloorGhostFieldBySource } from '../../utils/associateBajanteAcrossFloors';
import { diamPulgFromLabel } from '../../utils/diamPulgFromEtiqueta.ts';
import { checkVentDiameterLimits, syncVentBajanteDiameters } from './ventDiameters';

// Mutaciones de selección/edición del motor: update de tramos por engine/id, guard de diámetro
// de nodo, propagación a bajantes conectados y snaps de etiqueta. Extraído verbatim de
// PlanoEngineSelection (des-monolitización 2026-10-06).

/** Aplica unos cambios al elemento seleccionado (diámetro, material, etiqueta…): valida lo que la
 *  red no permite, escribe, repinta y avisa a la interfaz.
 *  Ej: al cambiar el diámetro de un ramal, este es el camino que también se lo pasa al bajante
 *  conectado si el nuevo valor es mayor. */
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
      // Presión: los vecinos de la conexión suben al mayor (sin bloqueo — orig. usuario).
      convergirDiametroNodoPresion(engine.ramales, el.id);
      bumpConnectedBajantes(
        engine.ramales,
        engine.bajantes,
        engine.nivelActual?.label ?? '',
        el.id,
        prevRamDiam,
        String(fields.diametro ?? ''),
      );
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

// Validación de diámetros a nivel motor: SOLO sanitaria (receptor ≥ alimentador, ambas
// direcciones, vía sanDiametroPermitido). Redes de presión af/ac/gas/rci SIN bloqueo
// (orig. usuario: la regla salida/entrada y su alerta se retiraron) — la convergencia al
// MAYOR en la conexión corre en los bloques de escritura vía convergirDiametroNodoPresion.

/** Revisa que un cambio de diámetro respete la red y devuelve true si se puede escribir. Se usa
 *  sobre todo en sanitaria (Red Contra Incendio aparte): si el tramo quedó por debajo del que
 *  alimenta, se avisa y se bloquea el cambio.
 *  Ej: un inodoro no puede quedarse en 2" si su tramo de feeding es de 4". */
export function guardDiametroNodo(
  engine: IPlanoEngineCore,
  el: { pts?: number[][]; net?: string; id?: string },
  fields: Record<string, unknown>,
): boolean {
  if (fields.diametro === undefined) return true;
  const ram = el as PlanoRamal;
  if (!ram.pts || ram.net !== 'san') return true;
  const res = sanDiametroPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''));
  if (!res.ok) {
    engine.triggerAlert('Diámetro no permitido', res.msg || '');
    return false;
  }
  return true;
}

/** Cuando cambias el diámetro de un ramal, ajusta los bajantes/montantes que le llegan: se quedan
 *  con el tubo más ancho conectado y nunca bajan de eso (dentro de 2 px de tolerancia). */

export function bumpConnectedBajantes(
  ramales: Array<{ id: string; pts?: number[][]; diametro?: string }>,
  bajantes: Array<{
    tipo?: string;
    dNominal?: string;
    recibeDeIds?: string[];
    alimentaIds?: string[];
    x?: number;
    y?: number;
    desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  }>,
  lvlLabel: string,
  ramId: string,
  oldRamD: string,
  newRamD: string,
): void {
  const changedRam = ramales.find((r) => r.id === ramId);
  if (!changedRam?.pts) return;
  for (const b of bajantes) {
    if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
    // Ambos sentidos de la asociación explícita: el bajante recibe (recibeDeIds) y el
    // montante alimenta (alimentaIds) — el diámetro sigue al ramal conectado en ambos.
    const assocRamIds = [...(b.recibeDeIds || []), ...(b.alimentaIds || [])];
    // ¿conectado a este ramal? (explícito por recibeDeIds o geométrico)
    let isConnected = assocRamIds.includes(ramId);
    if (!isConnected) {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      const bx = (b.x ?? 0) + (disp.dx || 0);
      const by = (b.y ?? 0) + (disp.dy || 0);
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
      ramales,
      assocRamIds,
      b.dNominal || '',
      ramId,
      oldRamD,
      newRamD,
    );
    if (followed) b.dNominal = followed;
  }
}

/** Revisa la tubería vertical antes de cambiarle el diámetro: no puede quedar MÁS ANGOSTA que los
 *  ramales que le llegan (en san (Sanitaria), ll (Lluvias) y en montantes de af (Agua Fría), ac
 *  (Agua Caliente) y gas (Gas)). false = el cambio no se permite. */

export function pushBajanteDiameterToRamales(
  engine: IPlanoEngineCore,
  bajId: string,
  newDNominal: string,
): boolean {
  const baj = engine.bajantes.find((b) => b.id === bajId);
  if (!baj || (baj.tipo !== 'bajante' && baj.tipo !== 'montante')) return true;
  // san/ll siempre; af/ac/gas SOLO montantes (orig. usuario: el montante nunca queda por
  // debajo del ramal conectado — misma verificación que bajantes/ramales sanitarios).
  const esFamiliaSan = baj.net === 'san' || baj.net === 'll';
  // REDES_PRESION completa (af/ac/gas/rci): un montante rci sin sincronía quedaba por
  // debajo de su ramal sin aviso (auditoría M-5a).
  const esMontePresion =
    (baj.net === 'af' || baj.net === 'ac' || baj.net === 'gas' || baj.net === 'rci') &&
    baj.tipo === 'montante';
  if (!esFamiliaSan && !esMontePresion) return true;
  const newIn = diamPulgFromLabel(newDNominal || '');
  if (!(newIn > 0)) return true;
  const ramales = [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]
    .map((id) => engine.ramales.find((x) => x.id === id))
    .filter((r): r is PlanoRamal => !!r && !!r.diametro);
  const maxRam = ramales.reduce((m, r) => Math.max(m, diamPulgFromLabel(r.diametro || '')), 0);
  if (maxRam > newIn) {
    const top = ramales.find((r) => diamPulgFromLabel(r.diametro || '') === maxRam);
    const sust = baj.tipo === 'montante' ? 'montante' : 'bajante';
    engine.triggerAlert(
      'Diámetro no permitido',
      `El diámetro del ${sust} (${newDNominal}) no puede ser inferior al del ramal conectado (${top?.label || top?.id} ${top?.diametro}). Cambia primero el diámetro del ramal.`,
    );
    return false;
  }
  // Doctrina "aguas arriba jamás" (misma de convergirDiametroNodoPresion): en presión el
  // push SOLO arrastra los ramales que el montante ALIMENTA (alimentaIds — nacen en él).
  // Los de recibeDeIds LLEGAN al montante (aguas arriba) y conservan su diámetro; el guard
  // de arriba sí mira ambas direcciones (el montante nunca queda por debajo de NINGÚN
  // conectado). san/ll sin cambio: el arrastre bidireccional es doctrina sanitaria.
  const alimentados = esMontePresion
    ? baj.alimentaIds || []
    : [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])];
  for (const id of alimentados) {
    const rr = engine.ramales.find((x) => x.id === id);
    if (!rr || !rr.diametro) continue;
    if (diamPulgFromLabel(rr.diametro || '') < newIn) {
      rr.diametro = newDNominal;
      if (rr.net === 'san') propagarSanDiametroAguasAbajo(engine.ramales, rr.id, engine.bajantes);
      else recomputeDownstreamDiameters(engine.ramales, rr.id);
    }
  }
  return true;
}

/** Prepara los campos del enlace manual por casilla: recibeDeIds (los ramales que LLEGAN al
 *  bajante) y alimentaIds (los que SALEN de él).
 *  @param b bajante; @param ramalId ramal; @param activar asocia o quita; @returns campos a escribir. */
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

/** Aplica unos cambios a un elemento por su id, aunque no esté seleccionado (el menú y las tablas
 *  de diseño entran por aquí). No roba la selección si el elemento editado es otro.
 *  Ej: cambiar el diámetro de BAN1 desde la tabla de aguas negras. */
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
      // Presión: los vecinos de la conexión suben al mayor (sin bloqueo — orig. usuario).
      convergirDiametroNodoPresion(engine.ramales, id);
      bumpConnectedBajantes(
        engine.ramales,
        engine.bajantes,
        engine.nivelActual?.label ?? '',
        id,
        prevRamDiam,
        String(fields.diametro ?? ''),
      );
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

/** Gira la etiqueta del elemento seleccionado al ángulo de regla más cercano (0°, 45° o 90°) y la
 *  deja marcada como movida a mano, para que el des-tapado automático ya no la mueva.
 *  Ej: una etiqueta a 40° se deja en 45°. */
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

/** Devuelve la etiqueta del elemento seleccionado a su posición automática (la que el motor
 *  calcula al lado del símbolo) y le quita la marca de movida a mano.
 *  Ej: el botón "Restablecer etiqueta" del menú. */
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
