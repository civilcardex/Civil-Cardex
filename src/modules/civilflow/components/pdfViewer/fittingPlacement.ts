// Colocación de un accesorio de modal (AccesorioModal) sobre un ramal del motor: localiza la
// unión por posición (insertando vértice si la tee cae a mitad de tramo), valida sifón/codos
// (polaridad sube/baja, reventilado, llave terminal), limpia accesorios conflictivos en el mismo
// punto y escribe el accesorio en el extremo o vértice correspondiente. Devuelve el ramal
// mutado, o null si la colocación se bloqueó por una validación (se levantó alerta).
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import {
  codoPolarityOk,
  codoNivelPermitidoEn,
  flowEndsAt,
} from '../../lib/PlanoEngine/PlanoEngineDrawing';
import { hasTeeAtPoint } from '../../lib/PlanoEngine/ventCodoTeeFix';

/** Coloca un accesorio del modal sobre un ramal: localiza la unión por posición, valida sifón
 *  y codos, y limpia accesorios conflictivos en el mismo punto. Devuelve el ramal mutado, o null
 *  si una validación bloqueó la colocación (se levantó alerta). */
export function applyAccesorioPlacement(
  eng: PlanoEngine,
  ramalId: string,
  point: number[],
  accId: string,
  onAlert: (title: string, msg: string) => void,
): PlanoEngine['ramales'][number] | null {
  const r = eng.ramales.find((r) => r.id === ramalId);
  if (!r || !r.pts?.length) return null;
  // Localizar la unión por POSICIÓN en el ramal objetivo (ramalId ahora siempre es el ramal
  // que ya existía antes de dibujar el conector — su arreglo pts puede no tener relación
  // alguna con el índice que tuviera el extremo del ramal que disparó la acción).
  const TOL = 0.5;
  let junctionIndex = r.pts.findIndex(([px, py]) => Math.hypot(px - point[0], py - point[1]) < TOL);
  if (junctionIndex === -1) {
    // Una tee real sobre un tramo recto no tiene vértice en la unión (el extremo del ramal
    // conector toca el medio de un segmento) — insertar uno, partiendo ese segmento, igual
    // que el patrón existente de inserción de accesorio/montante en medio del cuerpo.
    let segIdx = -1;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay] = r.pts[i],
        [bx, by] = r.pts[i + 1];
      const dx = bx - ax,
        dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) continue;
      const t = ((point[0] - ax) * dx + (point[1] - ay) * dy) / lenSq;
      if (t < 0.02 || t > 0.98) continue;
      const projX = ax + t * dx,
        projY = ay + t * dy;
      if (Math.hypot(point[0] - projX, point[1] - projY) < TOL) {
        segIdx = i;
        break;
      }
    }
    if (segIdx === -1) {
      junctionIndex = 0;
    } else {
      const newIdx = segIdx + 1;
      const newPts = [...r.pts];
      newPts.splice(newIdx, 0, [point[0], point[1]]);
      const shiftedAccMed: Record<string, string> = {};
      if (r.accMed) {
        for (const [key, val] of Object.entries(r.accMed)) {
          const m = key.match(/^accMed(\d+)$/);
          if (!m) continue;
          const idx = parseInt(m[1], 10);
          shiftedAccMed[`accMed${idx >= newIdx ? idx + 1 : idx}`] = val;
        }
      }
      r.pts = newPts;
      r.accMed = shiftedAccMed;
      junctionIndex = newIdx;
    }
  }
  const isIni = junctionIndex === 0;
  const isFin = junctionIndex === r.pts.length - 1;
  // Alerta de dirección de flujo san: en un ramal san el flujo va DESDE el extremo abierto
  // (el aparato) HACIA el extremo de la bajante. Por eso:
  //   - el sifón (anti-retorno) DEBE ir en el extremo de ENTRADA — opuesto a la bajante.
  //   - la llave terminal (fin de línea) DEBE ir en el extremo de SALIDA — junto a la bajante.
  // Si el usuario los coloca en el extremo equivocado, bloquear la colocación con una alerta.
  // sifón: solo san, debe ir en ENTRADA (inicio). llaveTerminal: cualquier red, en SALIDA (fin).
  if (accId === 'sifon' && r.net === 'san' && !isIni) {
    onAlert('Revisar ubicación del sifón', 'El sifón no puede recibir flujo.');
    return null;
  }
  // Ítems 4/5 (codo 90° sube/baja): el codo sube solo puede ENTREGAR flujo (la cola de la
  // flecha apunta al extremo P — el flujo SALE de P hacia el codo); el codo baja solo puede
  // RECIBIR flujo (la cabeza de la flecha apunta al extremo P — el flujo LLEGA a P desde el
  // codo). En el cuerpo (flujo que pasa de largo) ninguno es válido. Ítem 2 (reventilado):
  // el codo reventilado NO puede recibir flujo — si el flujo del ramal sanitario termina en
  // el punto (lo recibe), bloquear.
  const accPt = r.pts[junctionIndex];
  if (
    accPt &&
    (accId === 'codoSube' ||
      accId === 'codoBaja' ||
      accId === 'codo90rmSube' ||
      accId === 'codo90rmBaja')
  ) {
    const isVentTeeModal = r.net === 'vent' && hasTeeAtPoint(eng, accPt, r.net);
    // Ítem 5: los codos de nivel (sube/baja) solo aplican entre cuerpo y extremo — nunca en
    // una intersección entre ramales (tee de 3+ brazos).
    if (!isVentTeeModal && !codoNivelPermitidoEn(eng, r.id, accPt)) {
      onAlert(
        'Codo de nivel no permitido aquí',
        'Los codos sube/baja solo pueden ubicarse entre el cuerpo del ramal y sus extremos, no en intersecciones entre ramales.',
      );
      return null;
    }
    if (!isVentTeeModal && !codoPolarityOk(r, accPt, accId, TOL)) {
      const isSube = accId === 'codoSube' || accId === 'codo90rmSube';
      onAlert(
        'Dirección de codo incorrecta',
        isSube
          ? 'El codo 90° sube solo puede entregar flujo: la cola de la flecha debe apuntar al extremo (el flujo sale de ahí hacia el codo), no en el cuerpo.'
          : 'El codo 90° baja solo puede recibir flujo: la cabeza de la flecha debe apuntar al extremo (el flujo llega ahí desde el codo), no en el cuerpo.',
      );
      return null;
    }
  }
  if (accId === 'codoReventilado' && r.net === 'san' && accPt && flowEndsAt(r, accPt, TOL)) {
    onAlert(
      'Codo reventilado no puede recibir flujo',
      'El codo reventilado debe colocarse en el extremo desde donde fluye el ramal sanitario. Invierte la dirección del ramal.',
    );
    return null;
  }
  if (accId === 'llaveTerminal' || accId === 'teeLlaveTerminal') {
    if (isIni) {
      onAlert('Revisar ubicación llave terminal', 'La llave terminal debe recibir el flujo.');
      return null;
    }
  }
  // N9: evitar duplicados — eliminar cualquier accesorio conflictivo existente en el mismo punto antes de crear el nuevo (T+Q90, etc.)
  // Se limpia tanto codos como tees en ese punto para que solo quede el seleccionado.
  {
    const TOL2 = 0.5;
    const isCodoId = (v: string) => v.toLowerCase().includes('codo');
    for (const other of eng.ramales) {
      if (!other.pts) continue;
      // endpoint inicio
      if (
        other.accesorioInicio &&
        Math.hypot(other.pts[0][0] - accPt[0], other.pts[0][1] - accPt[1]) < TOL2
      ) {
        const isExistingCodo = isCodoId(other.accesorioInicio);
        const isNewCodo = isCodoId(accId);
        // conflicto: existente es codo y nuevo es tee, o viceversa, o ambos codos/ambos tees en mismo punto (duplicado)
        if (
          (isExistingCodo && !isNewCodo) ||
          (!isExistingCodo && isNewCodo) ||
          other.id !== r.id ||
          junctionIndex !== 0
        ) {
          if (other.id === r.id && junctionIndex === 0) continue; // el que vamos a sobreescribir
          other.accesorioInicio = '';
        }
      }
      const li = other.pts.length - 1;
      if (
        other.accesorioFin &&
        Math.hypot(other.pts[li][0] - accPt[0], other.pts[li][1] - accPt[1]) < TOL2
      ) {
        const isExistingCodo = isCodoId(other.accesorioFin);
        const isNewCodo = isCodoId(accId);
        if (
          (isExistingCodo && !isNewCodo) ||
          (!isExistingCodo && isNewCodo) ||
          other.id !== r.id ||
          junctionIndex !== li
        ) {
          if (other.id === r.id && junctionIndex === li) continue;
          other.accesorioFin = '';
        }
      }
      if (other.accMed) {
        for (const k of Object.keys(other.accMed)) {
          const m = k.match(/^accMed(\d+)$/);
          if (!m) continue;
          const p = other.pts[parseInt(m[1], 10)];
          if (!p || Math.hypot(p[0] - accPt[0], p[1] - accPt[1]) >= TOL2) continue;
          const isExistingCodo = isCodoId(other.accMed[k]);
          const isNewCodo = isCodoId(accId);
          const isSelf = other.id === r.id && parseInt(m[1], 10) === junctionIndex;
          if (isSelf) continue;
          // always remove conflicting accMed at the same point (duplicate dedup)
          void isExistingCodo;
          void isNewCodo;
          delete other.accMed[k];
        }
      }
    }
  }
  if (isIni) {
    r.accesorioInicio = accId;
  } else if (isFin) {
    r.accesorioFin = accId;
  } else {
    if (!r.accMed) r.accMed = {};
    r.accMed[`accMed${junctionIndex}`] = accId;
  }
  eng._markDirty();
  eng.render();
  return r;
}
