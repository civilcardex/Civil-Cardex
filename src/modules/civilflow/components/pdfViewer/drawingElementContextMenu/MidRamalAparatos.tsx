/** Sección "Seleccionar Aparato" del clic sobre el cuerpo de un ramal: desplegable + tarjetas de asignados con Quitar, leyendo el motor vivo (nunca el snapshot rancio del menú). Ej: clic en RAF1 → lavamanos → glifo +1 UC (Unidad de Consumo). */
import { APARATOS_DEF } from '../../../constants/engineeringDataFixtures.ts';
import { DIAM_BY_MAT } from '../../../constants';
import { loadAll } from '../../fixturesStorage.ts';
import { matchDiamOption } from '../../../utils/diamOptionMatch.ts';
import { sanDiamAllowedForApparatus } from '../../../utils/sanitaryDiamCompat.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { extremumOccupied, flowTailEnd } from './ramalMenuHelpers.ts';
import { flowEndsAt } from '../../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import {
  bumpHidroAccesorio,
  bumpAparatoCount,
  setSingleAparatoCount,
} from '../../../utils/syncExtremeAccessory.ts';
import { devError } from '../../../../../utils/devError.ts';
import { MENU_SELECT_STYLE, MENU_SECTION_LABEL_ROW_STYLE } from './context.ts';
import { ramalVivoDelPlanoCargado } from './ramalMenuHelpers.ts';
import { emitAparatosClear } from '../../../utils/fixtureEvents.ts';
import { indicePorId } from '../../../utils/indices.ts';
import {
  aparatoIdsDeRed,
  extremoPorClic,
  aparatoConConteo,
  asignadosDeConteos,
  asignadosDeCampos,
  preferirExtremo,
} from './midRamalAparatos.ts';
import type { ContextMenuState } from './context.ts';

/** La escritura (applyAparato) respeta extremo libre, reglas de diámetro (inodoro 4", resto 2") y coexistencia de aparatos (sifón + inodoro). */
export function MidRamalAparatos({
  element,
  midRamalHit,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: PlanoRamal;
  midRamalHit: { segmentIdx: number; x: number; y: number };
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const aparatoIds = aparatoIdsDeRed(element.net);
  // Índice id→def (el PRIMERO gana, como el .find que reemplaza): sin búsquedas lineales
  // dentro de los .map del render (guard G8).
  const aparatosPorId = indicePorId(APARATOS_DEF, (a) => a.id);
  const aparatoOptions = aparatoIds
    .map((id) => aparatosPorId.get(id))
    .filter((a): a is (typeof APARATOS_DEF)[number] => !!a);
  const fieldApp = extremoPorClic(element.pts, midRamalHit.x, midRamalHit.y);
  let currentApp: string = element[fieldApp] || '';
  // LDesvio: el desplegable SIEMPRE vacío (orig. usuario) — sus UDs son la herencia
  // del fantasma/bajante superior, no un aparato asignado al tramo.
  if (element.id?.startsWith('LD_')) currentApp = '';
  else if (element.net === 'af' || element.net === 'ac' || element.net === 'gas') {
    // af/ac/gas: leer del MOTOR VIVO (orig. usuario) — el snapshot del menú llega
    // rancio si el aparato se asignó desde el panel derecho. Prefiere el extremo
    // clicado; cae al otro si el asignado vive allí.
    const vivo = ramalVivoDelPlanoCargado(engineRef.current, element.id);
    currentApp = preferirExtremo(
      fieldApp,
      String(vivo?.aparatoInicio || ''),
      String(vivo?.aparatoFin || ''),
    );
  } else if (element.net === 'san' || element.net === 'll') {
    // Para sanitaria/lluvias el aparato del cuerpo se guarda en el conteo de fixtures (sidebar),
    // no en aparatoInicio/Fin; mostrar el que tenga conteo >0 para este ramal.
    try {
      const planIdForCur =
        (engineRef.current as unknown as { _loadedPlanId?: string })?._loadedPlanId ?? '';
      const keyCur = `san_${element.id}_${planIdForCur || ''}`;
      const curMap = loadAll()[keyCur] || {};
      const found = aparatoConConteo(curMap);
      if (found) currentApp = found;
    } catch (e) {
      // Libro ilegible: el desplegable cae a vacío, pero el dato perdido queda rastreado.
      devError('[midRamal] conteo de aparatos ilegible:', e);
    }
  }
  // Asignados COEXISTEN (orig. usuario: sifón + inodoro): una tarjeta por aparato con
  // su propio Quitar por id — san/ll desde el mapa de conteos; af/ac/gas por campos.
  const asignados: Array<{ id: string; n: number }> = (() => {
    if (element.id?.startsWith('LD_')) return [];
    if (element.net === 'san' || element.net === 'll') {
      try {
        const planIdForCur =
          (engineRef.current as unknown as { _loadedPlanId?: string })?._loadedPlanId ?? '';
        const curMap = loadAll()[`san_${element.id}_${planIdForCur || ''}`] || {};
        return asignadosDeConteos(aparatoIds, curMap);
      } catch (e) {
        devError('[midRamal] libro de aparatos ilegible: sin asignados', e);
        return [];
      }
    }
    // Vivo (orig. usuario): mismo criterio que el desplegable — el snapshot llega
    // rancio si el aparato se asignó desde el panel derecho.
    return asignadosDeCampos(element, ramalVivoDelPlanoCargado(engineRef.current, element.id));
  })();

  const applyAparato = (val: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    const fresh = ramalVivoDelPlanoCargado(eng, element.id);
    if (!fresh || !fresh.pts || fresh.pts.length < 2) return;
    // Item 1 (regla global): un extremo está OCUPADO si está entrelazado con
    // la red (otro ramal/bajante/tee). Los glifos de codo/sifón NO cuentan como
    // ocupación — el aparato los reemplaza (su propio glifo es un codo). Si
    // AMBOS extremos están ocupados: no crear símbolo, no modificar existentes,
    // SIN alerta. Aplica a todas las redes.
    const blocked0 = val ? extremumOccupied(eng, fresh, fresh.pts[0]) : false;
    const blocked1 = val ? extremumOccupied(eng, fresh, fresh.pts[fresh.pts.length - 1]) : false;
    if (val && blocked0 && blocked1) {
      setContextMenuState((prev) => (prev ? { ...prev, visible: false } : prev));
      eng.triggerAlert(
        'Extremos ocupados',
        'Ambos extremos del ramal están conectados a la red. Libera una punta o invierte la dirección del ramal antes de asignar el aparato.',
      );
      return;
    }
    if (fresh.net === 'san' || fresh.net === 'll') {
      const fStart = Math.hypot(fresh.pts[0][0] - midRamalHit.x, fresh.pts[0][1] - midRamalHit.y);
      const fEnd = Math.hypot(
        fresh.pts[fresh.pts.length - 1][0] - midRamalHit.x,
        fresh.pts[fresh.pts.length - 1][1] - midRamalHit.y,
      );
      // ponytail: fixture goes to the FREE end (flow ends there, not occupied by bajante/union).
      // nearStart (click proximity) put it at the wrong end when a bajante is at the other side.
      const p0 = fresh.pts[0];
      const p1 = fresh.pts[fresh.pts.length - 1];
      const occ0 = blocked0;
      const occ1 = blocked1;
      let nearStart: boolean;
      if (occ0 !== occ1) {
        nearStart = occ1;
      } else if (!occ0 && !occ1) {
        // Trazo aislado (orig. usuario): el codo sube va del lado de la COLA de
        // la flecha de flujo (el sube entrega) — no de la cabeza ni por
        // proximidad del clic. Cola en p0 → true; cola en p1 → false.
        const end0 = flowEndsAt(fresh, p0, 0.5);
        const end1 = flowEndsAt(fresh, p1, 0.5);
        const tail = flowTailEnd(end0, end1);
        nearStart = tail === -1 ? fStart <= fEnd : tail === 0;
      } else {
        const end0 = flowEndsAt(fresh, p0, 0.5);
        const end1 = flowEndsAt(fresh, p1, 0.5);
        nearStart = end0 && !end1 ? true : end1 && !end0 ? false : fStart <= fEnd;
      }
      const fieldAcc: 'accesorioInicio' | 'accesorioFin' = nearStart
        ? 'accesorioInicio'
        : 'accesorioFin';
      if (val) {
        // Un glifo de codo/sifón en el extremo NO bloquea al aparato — el aparato
        // lo reemplaza (su propio glifo es un codo 90°/sifón). Solo una conexión
        // real (tee/yee) bloquea la asignación en ese extremo.
        const accHere = fresh[fieldAcc] || '';
        if (accHere.startsWith('tee') || accHere.startsWith('yee')) {
          eng.triggerAlert(
            'Accesorio existente',
            'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
          );
          return;
        }
        // Ítem 6/7/8: regla central (inodoro → 4" mínimo; otros → relleno 2" si vacío) + switch
        const isInodoro = val === 'san';
        // Ítem 1: una asignación de aparato = un snapshot (pausa durante los pasos).
        eng.pauseHistory();
        // Detect previous aparato for this ramal to handle switch quantity & diam
        const planIdForSwitch = eng._loadedPlanId ?? '';
        const switchKey = `san_${element.id}_${planIdForSwitch || ''}`;
        let prevAparato: string | null = null;
        try {
          const prevCounts = loadAll();
          const prevMap = prevCounts[switchKey] || {};
          const foundPrev = Object.keys(prevMap).find((k) => (prevMap[k] || 0) > 0 && k !== val);
          if (foundPrev) prevAparato = foundPrev;
        } catch (e) {
          devError('[midRamal] conteo previo ilegible (cambio de aparato):', e);
        }
        if (isInodoro) {
          // ponytail: inodoro must be >=4" even when ramal has NO diameter (0 returns "allowed")
          const curDiamPulg = fresh.diametro ? diamPulgFromLabel(fresh.diametro) : 0;
          if (curDiamPulg < 4 || !sanDiamAllowedForApparatus(curDiamPulg, 'san')) {
            eng.updateElementById(element.id, { diametro: '4"' });
            if (selElement?.id === element.id)
              setSelElement({ ...selElement, diametro: '4"' } as PlanoRamal);
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, diametro: '4"' } } : null,
            );
          }
        } else {
          // Otros aparatos: si venimos de inodoro (prev 4") o sin diam, ajustar a 2"
          const shouldSet2 = !fresh.diametro || prevAparato === 'san';
          if (shouldSet2) {
            eng.updateElementById(element.id, { diametro: '2"' });
            if (selElement?.id === element.id)
              setSelElement({ ...selElement, diametro: '2"' } as PlanoRamal);
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, diametro: '2"' } } : null,
            );
          }
        }
        // Sifón (aparato 'sif') dibuja el glifo sifón, no codo 90°; conteo sigue sumando codo90.
        const isSif = val === 'sif';
        const accType = isSif ? 'sifon' : 'codo90rmSube';
        // UN SOLO aparato por ramal (orig. usuario): el nuevo REEMPLAZA al anterior —
        // el glifo viejo del extremo opuesto se libera junto con la escritura.
        const otherAcc: 'accesorioInicio' | 'accesorioFin' =
          fieldAcc === 'accesorioInicio' ? 'accesorioFin' : 'accesorioInicio';
        const otherDiamF = otherAcc === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin';
        const otherVal = String((fresh as unknown as Record<string, unknown>)[otherAcc] || '');
        const updates: Record<string, unknown> = { [fieldAcc]: accType };
        if (otherVal === 'sifon' || otherVal === 'codo90rmSube') {
          updates[otherAcc] = '';
          updates[otherDiamF] = '';
        }
        const diamListSan = DIAM_BY_MAT['PVC-S'] || [];
        // sifón: siempre 2" (fix bug 3" arbitrario)
        const diamValRaw = isInodoro
          ? '4"'
          : isSif
            ? '2"'
            : fresh.diametro
              ? matchDiamOption(diamListSan, fresh.diametro)
              : '2"';
        const diamVal = matchDiamOption(diamListSan, diamValRaw);
        if (diamVal)
          (updates as Record<string, unknown>)[nearStart ? 'diametroInicio' : 'diametroFin'] =
            diamVal;
        eng.updateElementById(element.id, updates);
        if (selElement?.id === element.id)
          setSelElement({ ...selElement, ...updates } as PlanoRamal);
        setContextMenuState((prev) =>
          prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
        );
        eng.render();
        // Conteo directo por clave de plano (sin gate de planosCtx: con el contexto aún
        // cargando el menú escribía el símbolo pero no el conteo y el primer clic
        // "no hacía nada"). Aparatos COEXISTEN (+1 sin limpiar los demás — orig.
        // usuario: sifón + inodoro a la vez; Quitar es por id).
        {
          const planId = eng._loadedPlanId ?? '';
          // UN SOLO aparato por ramal: el nuevo REEMPLAZA los conteos anteriores
          // (max-1) — misma semántica del panel derecho (orig. usuario).
          setSingleAparatoCount('san', element.id, planId, val);
          // bump solo si accesorio no existía antes (evita doble conteo al cambiar de aparato con mismo codo)
          const hadAccBefore = !!fresh[fieldAcc];
          if (!hadAccBefore) bumpHidroAccesorio('san', 'codo90rmSube', 1, element.id, planId);
          if (typeof window !== 'undefined') emitAparatosClear();
        }
        // Ítem 1: un snapshot para toda la asignación (geometría + conteos).
        eng.resumeHistory();
        eng._markDirty();
        return;
      } else {
        // QUITAR = VACIAR toda la asignación de aparatos del ramal (orig. usuario:
        // tras un switch sifón→inodoro, el botón debe dejar el ramal SIN NINGÚN
        // aparato — glifos, campos y conteo —, no reasignar el anterior).
        eng.pauseHistory();
        const updates: Record<string, unknown> = {};
        let codosBorrados = 0;
        for (const [f, dF] of [
          ['accesorioInicio', 'diametroInicio'],
          ['accesorioFin', 'diametroFin'],
        ] as const) {
          const v = (fresh as unknown as Record<string, unknown>)[f];
          if (v === 'sifon' || v === 'codo90rmSube') {
            updates[f] = '';
            updates[dF] = '';
            if (v === 'codo90rmSube') codosBorrados++;
          }
        }
        if (fresh.aparatoInicio) updates.aparatoInicio = '';
        if (fresh.aparatoFin) updates.aparatoFin = '';
        if (Object.keys(updates).length) eng.updateElementById(element.id, updates);
        // La copia `fixtures` del ramal se escribió al CARGAR y nada la actualiza al
        // quitar: invalidarla aquí (el re-ancla del sync leería la copia del trazo y
        // resucitaría el conteo recién borrado — orig. usuario Quitar sin efecto).
        fresh.fixtures = undefined;
        // Refresco desde el motor vivo (no del snapshot): el menú muestra el estado
        // real aunque el prop element llegara stale.
        const liveAfter = ramalVivoDelPlanoCargado(engineRef.current, element.id) || null;
        if (selElement?.id === element.id)
          setSelElement({ ...((liveAfter ?? selElement) as PlanoRamal), ...updates });
        setContextMenuState((prev) =>
          prev
            ? {
                ...prev,
                element: { ...((liveAfter ?? prev.element) as PlanoRamal), ...updates },
              }
            : null,
        );
        eng.render();
        const planId = eng._loadedPlanId ?? '';
        if (codosBorrados > 0)
          bumpHidroAccesorio('san', 'codo90rmSube', -codosBorrados, element.id, planId);
        // Conteo: se VACÍA COMPLETO (todos los aparatos del ramal, incluidos
        // residuos de switches anteriores).
        {
          const cur = loadAll()[`san_${element.id}_${planId}`] || {};
          for (const [k, n] of Object.entries(cur)) {
            const cnt = Number(n) || 0;
            if (cnt > 0) bumpAparatoCount('san', element.id, planId, k, -cnt);
          }
        }
        if (typeof window !== 'undefined') emitAparatosClear();
        // Ítem 1: un snapshot para toda la desasignación (geometría + conteos).
        eng.resumeHistory();
        eng._markDirty();
        return;
      }
    }
    const fStart = Math.hypot(fresh.pts[0][0] - midRamalHit.x, fresh.pts[0][1] - midRamalHit.y);
    const fEnd = Math.hypot(
      fresh.pts[fresh.pts.length - 1][0] - midRamalHit.x,
      fresh.pts[fresh.pts.length - 1][1] - midRamalHit.y,
    );
    // Item 6/2: con un extremo ocupado y otro libre, usar SIEMPRE el libre
    // (la proximidad del clic no debe mandar el aparato a un extremo con
    // accesorio/conexión); si ambos libres, decidir por proximidad.
    const nearStart = blocked0 !== blocked1 ? !blocked0 : fStart <= fEnd;
    const field: 'aparatoInicio' | 'aparatoFin' = nearStart ? 'aparatoInicio' : 'aparatoFin';
    const fieldAcc: 'accesorioInicio' | 'accesorioFin' = nearStart
      ? 'accesorioInicio'
      : 'accesorioFin';
    const targetPt: number[] = nearStart ? fresh.pts[0] : fresh.pts[fresh.pts.length - 1];
    if (val) {
      if (fresh[fieldAcc]) {
        eng.triggerAlert(
          'Accesorio existente',
          'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
        );
        return;
      }
      const existingBm = eng.bajantes.find(
        (b) =>
          Math.abs(b.x - targetPt[0]) < 0.5 &&
          Math.abs(b.y - targetPt[1]) < 0.5 &&
          b.net === element.net,
      );
      if (existingBm) {
        eng.triggerAlert(
          'Elemento existente',
          `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un aparato.`,
        );
        return;
      }
      if (extremumOccupied(eng, fresh, targetPt) || !flowEndsAt(fresh, targetPt, 0.5)) {
        setContextMenuState((prev) => (prev ? { ...prev, visible: false } : prev));
        eng.triggerAlert(
          'Aparato no permitido',
          'El aparato solo se dibuja en el extremo libre hacia el que apunta el flujo del ramal. Este extremo está conectado a la red (T/Y/bajante) o el flujo va en su contra (apunta a la conexión). Invierte la dirección del ramal o asigna el aparato en el extremo correcto.',
        );
        return;
      }
    }
    if (!val) {
      // QUITAR = VACIAR toda la asignación del ramal (ambos campos aparato) — el menú
      // debe quedar "sin asignar" siempre (orig. usuario).
      eng.pauseHistory();
      const actualUpdates: Record<string, unknown> = {};
      if (fresh.aparatoInicio) actualUpdates.aparatoInicio = null;
      if (fresh.aparatoFin) actualUpdates.aparatoFin = null;
      if (Object.keys(actualUpdates).length) {
        eng.updateElementById(element.id, actualUpdates);
      }
      // Misma invalidación de la copia `fixtures` que en la rama san/ll (anti-resurrección).
      fresh.fixtures = undefined;
      // Refresco desde el motor vivo (no del snapshot): garantiza que el menú
      // muestre "sin asignar" aunque el prop element llegara stale.
      const liveAfter2 = ramalVivoDelPlanoCargado(engineRef.current, element.id) || null;
      setContextMenuState((prev) =>
        prev
          ? {
              ...prev,
              element: {
                ...((liveAfter2 ?? prev.element) as PlanoRamal),
                ...actualUpdates,
              },
            }
          : null,
      );
      if (selElement?.id === element.id) {
        setSelElement({
          ...((liveAfter2 ?? selElement) as PlanoRamal),
          ...actualUpdates,
        } as PlanoRamal);
      }
      eng.render();
      // Conteo: se VACÍA COMPLETO (todos los aparatos del ramal).
      {
        const pid = eng._loadedPlanId ?? '';
        const cur = loadAll()[`${element.net}_${element.id}_${pid}`] || {};
        for (const [k, n] of Object.entries(cur)) {
          const cnt = Number(n) || 0;
          if (cnt > 0) bumpAparatoCount(element.net, element.id, pid, k, -cnt);
        }
      }
      if (typeof window !== 'undefined') emitAparatosClear();
      eng.resumeHistory();
      eng._markDirty();
      return;
    }
    // Ítem 1: ver rama desasignar (pausa hasta el snapshot final).
    eng.pauseHistory();
    const oldApp = fresh[field] || '';
    const updates: Record<string, unknown> = { [field]: val || null };
    eng.updateElementById(element.id, updates);
    setContextMenuState((prev) =>
      prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
    );
    if (selElement?.id === element.id) {
      setSelElement({ ...selElement, ...updates } as PlanoRamal);
    }
    eng.render();
    // Conteo directo por clave de plano (sin gate de planosCtx — ver rama san).
    {
      const pid = eng._loadedPlanId ?? '';
      if (oldApp) bumpAparatoCount(element.net, element.id, pid, oldApp, -1);
      if (val) bumpAparatoCount(element.net, element.id, pid, val || '', +1);
      if (typeof window !== 'undefined') emitAparatosClear();
    }
    eng.resumeHistory();
    eng._markDirty();
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Seleccionar Aparato</div>
      <select
        value={currentApp}
        aria-label="Seleccionar Aparato"
        onChange={(e) => {
          e.target.blur();
          applyAparato(e.target.value);
        }}
        style={MENU_SELECT_STYLE}
      >
        <option value="">Ninguno</option>
        {aparatoOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
      {/* Ítem 7: aparato asignado visible con cantidad = 1 (la misma de la sidebar
          derecha) y remoción bidireccional — Quitar limpia el campo del ramal, la
          sidebar decrementa el conteo y el glifo de codo implícito desaparece (ambos
          se derivan de aparatoInicio/Fin). */}
      {asignados.map((asig) => {
        const asigDef = aparatosPorId.get(asig.id);
        return (
          <div
            key={asig.id}
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              background: 'rgba(0,220,229,0.06)',
              border: '1px solid rgba(0,220,229,0.25)',
              borderRadius: 3,
              padding: '4px 6px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#e2e2e8',
                fontFamily: "'Geist',monospace",
                whiteSpace: 'normal',
              }}
            >
              ✓ {asigDef?.nombre || asig.id} × {asig.n}
            </span>
            <button
              type="button"
              onClick={() => applyAparato('')}
              aria-label={`Quitar ${asigDef?.nombre || asig.id}`}
              style={{
                flexShrink: 0,
                padding: '2px 8px',
                background: 'transparent',
                border: '1px solid #3a494a',
                borderRadius: 3,
                color: '#ffb4ab',
                fontSize: 10,
                fontFamily: "'Geist',monospace",
                cursor: 'pointer',
              }}
            >
              Quitar
            </button>
          </div>
        );
      })}
    </div>
  );
}
