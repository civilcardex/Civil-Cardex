/**
 * Sección "Dibujo automático" del menú de un ramal de rci (Red Contra Incendio): siembra
 * rociadores colgantes cada S metros y abre el modal de ramales paralelos separados L.
 * Ej: «Dibujar rociadores (S = 3 m)» pone un rociador cada 3 m desde el inicio del trazo.
 */
import { useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import {
  sembrarRociadores,
  crearRamalesParalelos,
  type LadoParalelo,
} from '../../../lib/PlanoEngine/RCIAutoDraw.ts';
import { loadRciDatos } from '../../../services/projectDataService.ts';
import { loadFromStorage, getActiveProyectoId } from '../../../services/storageService.ts';
import { RCI_ESTADO_VIVO_KEY } from '../../../constants/storage-keys.ts';
import type { NumIn } from '../../../lib/rci/types.ts';
import { type ContextMenuState } from './context.ts';
import { RciAutoDrawModal } from './RCIAutoDrawModal.tsx';

/** S y L del piso ACTIVO: manda su fila en Tipologías → Pisos del edificio; un valor vacío
 *  cae a la global del proyecto (roc.S/roc.L). null si ni la fila ni la global traen dato.
 *  Ej: Piso 2 con S 3,0 y L 2,8 → { s: '3', l: '2.8' }. */
function slDeEstado(
  est: {
    pisos?: { rows?: Array<{ planId?: string; S?: NumIn; L?: NumIn }> };
    roc?: { S?: NumIn; L?: NumIn };
  } | null,
  planId: string,
): { s: string; l: string } | null {
  const fila = planId ? est?.pisos?.rows?.find((r) => String(r.planId || '') === planId) : null;
  const s = fila?.S ?? est?.roc?.S;
  const l = fila?.L ?? est?.roc?.L;
  if (s === undefined && l === undefined) return null;
  return { s: String(s ?? ''), l: String(l ?? '') };
}

/** Sección "Dibujo automático" de un ramal rci: S/L salen SIEMPRE de la fila del piso en
 *  Tipologías → Pisos del edificio (espejo local del estado vivo + BD); el modal solo pide
 *  n.º de ramales y lado para los paralelos. Fuera de rci (o tributario) no pinta nada. */
export function RciAutoDrawSection({
  engineRef,
  ramal,
  contextMenuState,
  setContextMenuState,
}: {
  engineRef: MutableRefObject<PlanoEngine | null>;
  ramal: PlanoRamal;
  contextMenuState: ContextMenuState | null;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
}) {
  const [autoDraw, setAutoDraw] = useState(false);
  const [rciSL, setRciSL] = useState<{ s: string; l: string }>({ s: '', l: '' });
  useEffect(() => {
    setAutoDraw(false);
    /* S/L del PISO al ABRIR el menú: el espejo LOCAL manda (fresco, post-debounce de RCI); la
     * BD es FALLBACK solo si el espejo no trae nada — si la BD respondiera DESPUÉS pisaría el
     * valor fresco con el rancio (la BD puede ir detrás del debounce de guardado). */
    /* planId REAL del piso cargado (_loadedPlanId): engine.planId está declarado pero NUNCA
     * se asigna (siempre undefined) — la fila del piso no matcheaba y S/L caían a la global. */
    const planId = String(engineRef.current?._loadedPlanId ?? '');
    const vivo = loadFromStorage<{
      pisos?: { rows?: Array<{ planId?: string; S?: NumIn; L?: NumIn }> };
      roc?: { S?: NumIn; L?: NumIn };
    } | null>(RCI_ESTADO_VIVO_KEY, null);
    const sl = slDeEstado(vivo, planId);
    if (sl) {
      setRciSL(sl);
      return;
    }
    const pid = String(getActiveProyectoId() ?? '');
    if (!pid) return;
    void loadRciDatos(pid).then((st) => {
      const slBd = slDeEstado(st, planId);
      if (slBd) setRciSL(slBd);
    });
  }, [contextMenuState, engineRef]);
  const numDe = (v: string): number => parseFloat(v.replace(',', '.'));
  /** «Dibujar rociadores»: sin modal — siembra directo con el S de la tabla (éxito silencioso,
   *  ped. usuario: sin cartel). */
  const dibujarRociadores = (): void => {
    const eng = engineRef.current;
    if (!eng) return;
    const s = numDe(rciSL.s);
    if (!(s > 0)) {
      eng.triggerAlert(
        'Sin separación S',
        'Defina S en RCI → Tipologías → Pisos del edificio (columna S) y vuelva a intentarlo.',
      );
      return;
    }
    if (sembrarRociadores(eng, ramal.id, s) === 0)
      eng.triggerAlert(
        'Sin rociadores sembrados',
        'El ramal mide menos que S y su extremo inicial ya tiene accesorio. Aleje un rociador a mano o use un ramal más largo.',
      );
    setContextMenuState(null);
  };
  /** «Dibujar ramales paralelos»: abre el modal (n.º + lado); L sale de la tabla al confirmar.
   *  Verifica muros (mín 0,10 m / máx Dmuro): si viola, alerta y NO se crea ninguno. */
  const confirmarParalelos = (v: { n: number; lado: LadoParalelo }): void => {
    const eng = engineRef.current;
    if (!eng) return;
    const l = numDe(rciSL.l);
    if (!(l > 0)) {
      eng.triggerAlert(
        'Sin separación L',
        'Defina L en RCI → Tipologías → Pisos del edificio (columna L) y vuelva a intentarlo.',
      );
      return;
    }
    const res = crearRamalesParalelos(eng, ramal.id, l, v.n, v.lado, eng.dmuroRci);
    if (res.error) {
      eng.triggerAlert('Distancia a muro', res.error);
      return;
    }
    setAutoDraw(false);
    setContextMenuState(null);
  };
  /* Orientación dominante del primer segmento (ped. usuario): trazo horizontal ofrece
   * Arriba/Abajo y vertical Izquierda/Derecha — direcciones ABSOLUTAS de pantalla que el
   * motor respeta al proyectar la normal. */
  const dxP = (ramal.pts?.[1]?.[0] ?? 0) - (ramal.pts?.[0]?.[0] ?? 0);
  const dyP = (ramal.pts?.[1]?.[1] ?? 0) - (ramal.pts?.[0]?.[1] ?? 0);
  const horizontal = Math.abs(dxP) >= Math.abs(dyP);
  if (ramal.net !== 'rci' || ramal.tipo === 'tributario') return null;
  return (
    <>
      {/* Dibujo automático rci (ped. usuario, sección ARRIBA): S siembra rociadores colgantes
          desde el inicio del trazo; n+«¿En qué sentido?» crea los paralelos DE ESTE ramal
          (disponible en todos, no solo el primero). S/L NO se preguntan: salen de la fila del
          piso en Tipologías → Pisos del edificio. */}
      <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
        <div className="dcm-section-label-row">Dibujo automático</div>
        <button type="button" onClick={dibujarRociadores} className="dcm-action-btn">
          Dibujar rociadores (S = {rciSL.s || '—'} m)
        </button>
        <button
          type="button"
          onClick={() => setAutoDraw(true)}
          className="dcm-action-btn dcm-action-mt"
        >
          Dibujar ramales paralelos (L = {rciSL.l || '—'} m)
        </button>
      </div>
      {autoDraw && (
        <RciAutoDrawModal
          lTxt={rciSL.l}
          horizontal={horizontal}
          onConfirm={confirmarParalelos}
          onClose={() => setAutoDraw(false)}
        />
      )}
    </>
  );
}
