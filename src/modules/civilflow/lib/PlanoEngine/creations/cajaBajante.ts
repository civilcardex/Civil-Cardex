// Creación de cajas (CAN/CALL) y bajantes (san/vent/ll) sobre el plano.
import { NETS } from '../PlanoState';
import type { IPlanoEngineCore } from '../PlanoState';
import { _statusMsg } from '../ramalMeasure';
import { resolveAndClampToCanal } from '../canalAssociation';
import { distToPolyline } from '../../shared/geometry';
import { maxDiametroLabel } from '../PlanoEngineDrawing';
import { angleAtHalfLength } from '../drawingAngles';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
export const BAJANTE_NETS = ['san', 'vent', 'll'];
export const MONTANTE_NETS = ['gas', 'ac', 'af'];
// Cajas de recolección (cuadrado con cuadrado interior): CAN en sanitaria, CALL en lluvias.
export const CAJA_NETS = ['san', 'll'];

/** Crea una Caja de aguas negras (san) o de aguas lluvias (ll) en el punto del clic — un solo
 *  clic la coloca (como contador). Es un nodo real de conexión: los trazos terminados sobre
 *  ella se asocian vía finishRamal→recibeDeIds (máximo 1 ramal por caja, ver bajanteRules). */
export function handleCajaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!CAJA_NETS.includes(engine.activeNet)) return;
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const codePfx = engine.activeNet === 'san' ? 'CAN' : 'CALL';
  const cnt =
    engine.bajantes.filter(
      (b) => (b.tipo === 'caja_san' || b.tipo === 'caja_ll') && b.net === engine.activeNet,
    ).length + 1;
  const cajaId = codePfx + cnt;
  engine.bajantes.push({
    id: cajaId,
    net: engine.activeNet,
    tipo: engine.activeNet === 'san' ? 'caja_san' : 'caja_ll',
    code: cajaId,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
  });
  engine.selId = cajaId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

/** Crea un bajante nuevo en las coordenadas dadas, auto-asociándolo con extremos de ramal
 *  cercanos y auto-rellenando sus campos ini/fin. @param engine Instancia del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleBajanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!BAJANTE_NETS.includes(engine.activeNet)) {
    engine._emitStatus('Bajante no disponible para esta red');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const ASSOC_THRESH = 30 / engine.zoom;
  const assocRamales: string[] = [];
  // Un bajante recién creado NO tiene dirección todavía (el usuario elige Sube/Baja/Continua
  // después) — así que no hay nada que proteger aquí al crearlo. Solo se asocia con el extremo
  // de ramal cercano (inicio o fin) más próximo; la guardia de dirección de flujo
  // (flowDirection.ts) re-valida correctamente una vez que el usuario fija "Baja" en este
  // bajante, contra los ramales que estén conectados para entonces.
  for (const r of engine.ramales) {
    if (r.net !== engine.activeNet || !r.pts?.length) continue;
    // Tributarios ni llegan ni salen de un bajante (orig. usuario) — solo ramales se asocian.
    if (r.tipo === 'tributario') continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (endDist < ASSOC_THRESH && endDist <= startDist) {
      px = r.pts[li][0];
      py = r.pts[li][1];
      if (assocRamales.length >= 2) {
        engine.triggerAlert(
          'Bajante completo',
          'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
        );
      } else assocRamales.push(r.id);
    } else if (startDist < ASSOC_THRESH) {
      px = r.pts[0][0];
      py = r.pts[0][1];
      if (assocRamales.length >= 2) {
        engine.triggerAlert(
          'Bajante completo',
          'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
        );
      } else assocRamales.push(r.id);
    }
  }
  // Regla de negocio: dentro de un canal recolectora solo caben bajantes de aguas lluvias (ll).
  // Si se intenta crear un bajante de otra red dentro de un canal, se aborta la creación con
  // una alerta modal — el canal es una canaleta de aguas lluvias y las otras redes no se pueden
  // hacer pasar por dentro. Se revisa DESPUÉS de la asociación con ramales porque ella puede
  // desplazar el punto final del bajante hacia el extremo de un ramal.
  if (engine.activeNet !== 'll') {
    const inside = resolveAndClampToCanal(engine, px, py);
    if (inside.canalId) {
      engine.triggerAlert(
        'Bajante dentro de canal',
        `Los bajantes dentro de un canal recolectora deben ser de aguas lluvias (ll). El bajante de la red ${engine.activeNet.toUpperCase()} no se puede crear dentro del canal.`,
      );
      return;
    }
  }
  // (orig. usuario) YA NO hay auto-asociación canal↔bajante al soltar: la asociación vive en
  // los ramales que el usuario dibuja del canal al bajante. El bajante queda donde cae.
  const canalId: string | null = null;
  const net = NETS.find((n) => n.id === engine.activeNet);
  const netPfx = net ? net.bmPfx : 'BAJ';
  // PUNTO 9 (orig. usuario): MENOR NÚMERO LIBRE sobre ids existentes — borrar BAN-2 de
  // {1,2,3} reutiliza el 2 (antes count+1 generaba huecos y duplicados tras borrar).
  const usedNums = new Set<number>(
    engine.bajantes
      .filter((b) => b.tipo === 'bajante' && b.net === engine.activeNet)
      .map((b) => {
        const mm = /(\d+)\s*$/.exec(b.id || '');
        return mm ? parseInt(mm[1], 10) : NaN;
      })
      .filter((n) => Number.isFinite(n)),
  );
  let cnt = 1;
  while (usedNums.has(cnt)) cnt++;
  const bajId = netPfx + cnt;
  // Ítem: el bajante toma por defecto el diámetro del ramal conectado (el mayor de los
  // asociados) y no puede bajarse de ahí — ver la validación en bajanteMenu.tsx.
  // Soltado sobre el CUERPO de un ramal (lejos de sus extremos) también adopta su diámetro
  // (orig. usuario: "viceversa según como se dibuje") — sin asociación, solo diámetro.
  let defDNominal = '';
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r && r.diametro) defDNominal = maxDiametroLabel(defDNominal, r.diametro);
  }
  if (!defDNominal) {
    for (const r of engine.ramales) {
      if (r.net !== engine.activeNet || r.tipo === 'tributario') continue;
      if (!r.pts || r.pts.length < 2 || !r.diametro) continue;
      if (distToPolyline([px, py], r.pts) < ASSOC_THRESH) {
        defDNominal = r.diametro;
        break;
      }
    }
  }
  // Item 3: bajante de ventilación nuevo → 2" por defecto si no hay ramal que lo defina.
  if (engine.activeNet === 'vent' && !defDNominal) defDNominal = '2"';
  engine.bajantes.push({
    id: bajId,
    net: engine.activeNet,
    tipo: 'bajante',
    code: bajId,
    // Sin dirección por defecto — el usuario debe elegir Sube/Baja/Continua explícitamente
    // para este bajante; ver los botones BajanteDirectionSelector.
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: defDNominal,
    recibeDeIds: assocRamales,
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
    canalId,
  });
  // Auto-rellenar ini/fin en los ramales asociados
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const distStart = Math.hypot(r.pts[0][0] - px, r.pts[0][1] - py);
    const lastIdx = r.pts.length - 1;
    const distEnd = Math.hypot(r.pts[lastIdx][0] - px, r.pts[lastIdx][1] - py);
    const epIdx: 0 | number = distStart <= distEnd ? 0 : lastIdx;
    if (epIdx === 0) {
      r.ini = bajId;
    } else {
      r.fin = bajId;
    }
    // PUNTO 6 (orig. usuario): la etiqueta del ramal queda PARALELA al trazo — el ángulo se
    // fija a la mitad de longitud (el default 0 lo dejaba horizontal en ramales diagonales).
    if (!r.labelMoved) {
      r.labelAngle = angleAtHalfLength(r.pts);
      const mid = r.pts[Math.floor(r.pts.length / 2)];
      r.labelX = r.labelX || mid[0];
      r.labelY = r.labelY || mid[1];
    }
    // Bloquear el ramal para que este bajante recién pegado no pueda arrastrarse por separado
    r.bloqueado = true;
  }
  engine.selId = bajId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}
