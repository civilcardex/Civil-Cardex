import { codoPolarityOk, codoNivelPermitidoEn } from '../../../lib/PlanoEngine/PlanoEngineDrawing';
// BajanteDirectionSelector: dirección sube/baja/continua con reglas por red y nivel.
// Extraído verbatim de bajanteMenu (des-monolitización 2026-10-06).
import { pisoLbl } from '../../../constants';
import { direccionBajaPermitida } from '../../../lib/PlanoEngine/directionRules';
import { hasTeeAtPoint } from '../../../lib/PlanoEngine/ventCodoTeeFix';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import {
  MENU_DIR_BTN_STYLE,
  MENU_FANTASMA_BTN_STYLE,
  MENU_SECTION_LABEL_STYLE,
  type ContextMenuState,
} from './context';

/** Selector de dirección de flujo del bajante/montante (Sube/Baja/Continua) con validaciones
 *  de coherencia contra los ramales conectados, y botón para activar o quitar el desplazamiento
 *  fantasma. */
export function BajanteDirectionSelector({
  element,
  isGhostClick = false,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = element.ghostData?.[currentGhostLabel];
  const oppositeParentDir =
    element.direccion === 'sube'
      ? 'baja'
      : element.direccion === 'baja'
        ? 'sube'
        : element.direccion;
  const ghostDir = isGhostClick
    ? gd && gd.direccion !== undefined
      ? gd.direccion
      : oppositeParentDir
    : element.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div style={MENU_SECTION_LABEL_STYLE}>Dirección de flujo</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 3,
          padding: '0 6px 4px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {['Sube', 'Baja', 'Continua'].map((opt) => {
          const isActive = ghostDir === opt.toLowerCase();
          return (
            <button
              type="button"
              key={opt}
              onClick={() => {
                if (!engineRef.current) return;
                if (isGhostClick) {
                  updateGhostField('direccion', opt.toLowerCase());
                  engineRef.current?.render();
                  return;
                }
                const currentNpt = pisos.find((p) => p.n === selectedNivel)?.npt || 0;
                const allNpts = pisos.map((p) => p.npt).sort((a, b) => Number(a) - Number(b));
                const maxNpt = allNpts[allNpts.length - 1] || 0;
                const minNpt = allNpts[0] || 0;
                let updates: Record<string, unknown> = {};

                if (opt === 'Sube') {
                  // PUNTO 8: el bajante ORIGINAL del piso inferior de una asociación (origenId)
                  // solo admite baja/continua — el flujo le llega desde arriba, nunca sube.
                  if (element.origenId) {
                    engineRef.current?.triggerAlert(
                      'Dirección no permitida',
                      'Este bajante es el original de una asociación entre pisos: solo admite "Baja" o "Continua".',
                    );
                    return;
                  }
                  // Ventilación: sin validación de dirección de flujo (usuario pide desactivarla).
                  // Bajantes asociados entre pisos: tampoco — el Ldesvio llega al padre original,
                  // la dirección la manda la asociación.
                  const isAsociado = !!(element.origenId || element.descargaEnId);
                  if (element.net !== 'vent' && !isAsociado) {
                    const bajCode = element.code || element.id;
                    const arrivingRamal = (element.recibeDeIds || [])
                      .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                      .find((ram) => ram && ram.net === element.net && ram.fin === bajCode);
                    if (arrivingRamal) {
                      engineRef.current?.triggerAlert(
                        'Dirección de flujo inconsistente',
                        `El ramal ${arrivingRamal.label || arrivingRamal.id} llega a este bajante (está conectado por su extremo final). Un bajante con dirección "sube" solo puede entregar flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                      );
                      return;
                    }
                  }
                  updates = {
                    direccion: 'sube',
                    nptBase: currentNpt,
                    nptCima: maxNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Baja') {
                  // PUNTO 9: 'baja' exige un piso debajo — bloqueada en el último nivel inferior.
                  if (!direccionBajaPermitida(engineRef.current, element)) {
                    engineRef.current?.triggerAlert(
                      'Dirección no permitida',
                      'Este es el último nivel del proyecto: no hay un piso inferior hacia el cual continuar el flujo. Pon otra dirección de flujo al elemento',
                    );
                    return;
                  }
                  // Asociados entre pisos sin validación: el Ldesvio llega al padre original y
                  // la dirección la manda la asociación (orig. usuario).
                  const isAsociadoBaja = !!(element.origenId || element.descargaEnId);
                  if (element.net !== 'vent' && !isAsociadoBaja) {
                    const bajCode = element.code || element.id;
                    const emittingRamal = (element.recibeDeIds || [])
                      .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                      .find((ram) => ram && ram.net === element.net && ram.ini === bajCode);
                    if (emittingRamal) {
                      engineRef.current?.triggerAlert(
                        'Dirección de flujo inconsistente',
                        `El ramal ${emittingRamal.label || emittingRamal.id} sale de este bajante (está conectado por su extremo inicial). Un bajante con dirección "baja" solo puede recibir flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                      );
                      return;
                    }
                  }
                  updates = {
                    direccion: 'baja',
                    nptBase: minNpt,
                    nptCima: currentNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Continua') {
                  updates = {
                    direccion: 'continua',
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                }
                if (Object.keys(updates).length > 0) {
                  engineRef.current?.updateElementById(element.id, updates);
                  // El accesorio de un montante (codo90rmSube/Baja en extremo de ramal, o
                  // teeSube/Baja en división a mitad de cuerpo) se escribió una sola vez al
                  // crearse y nunca se resincronizó al cambiar la dirección después — siempre se
                  // quedaba con el valor inicial. Aquí se recalcula a partir de la dirección
                  // ACTUAL, localizando el punto exacto por posición (extremo → codo, vértice
                  // interior → tee) en lugar de asumir que siempre es un extremo.
                  if (
                    element.tipo === 'montante' &&
                    (updates.direccion === 'sube' || updates.direccion === 'baja')
                  ) {
                    const isSube = updates.direccion === 'sube';
                    const codoId = isSube ? 'codo90rmSube' : 'codo90rmBaja';
                    const teeId = isSube ? 'teeSube' : 'teeBaja';
                    const TOL = 0.5;
                    // Ítems 12/13: validar la polaridad del codo contra el flujo del ramal ANTES
                    // de escribir — codoSube exige que el flujo LLEGUE al punto, codoBaja que
                    // SALGA. Sin esto, cambiar la dirección del montante podía escribir un codo
                    // contradictorio con la flecha del ramal.
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      const pt = ram.pts[idx];
                      if (idx === 0 || idx === ram.pts.length - 1) {
                        // Ítem 5: codos de nivel prohibidos en intersecciones entre ramales (tee)
                        const isVentTeeBaj =
                          ram.net === 'vent' && hasTeeAtPoint(engineRef.current!, pt, ram.net);
                        if (
                          !isVentTeeBaj &&
                          engineRef.current &&
                          !codoNivelPermitidoEn(engineRef.current, ram.id, pt)
                        ) {
                          engineRef.current?.triggerAlert(
                            'Codo de nivel no permitido aquí',
                            'Los codos sube/baja solo pueden ubicarse entre el cuerpo del ramal y sus extremos, no en intersecciones entre ramales.',
                          );
                          return;
                        }
                        if (!isVentTeeBaj && !codoPolarityOk(ram, pt, codoId, TOL)) {
                          engineRef.current?.triggerAlert(
                            'Polaridad de codo incorrecta',
                            isSube
                              ? 'El codo 90° sube exige que la cola de la flecha apunte a este punto (el flujo debe salir de aquí hacia el codo). Invierte la dirección del ramal o usa "baja".'
                              : 'El codo 90° baja exige que la cabeza de la flecha apunte a este punto (el flujo debe llegar aquí desde el codo). Invierte la dirección del ramal o usa "sube".',
                          );
                          return;
                        }
                      }
                    }
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      if (idx === 0)
                        engineRef.current?.updateElementById(ram.id, { accesorioInicio: codoId });
                      else if (idx === ram.pts.length - 1)
                        engineRef.current?.updateElementById(ram.id, { accesorioFin: codoId });
                      else
                        engineRef.current?.updateElementById(ram.id, {
                          accMed: { ...(ram.accMed || {}), [`accMed${idx}`]: teeId },
                        });
                    }
                  }
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  }
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                }
              }}
              style={{
                ...MENU_DIR_BTN_STYLE,
                background: isActive ? 'rgba(37,99,235,0.15)' : '#1e2024',
                border: `1px solid ${isActive ? '#2563eb' : '#3a494a'}`,
                color: isActive ? '#3b82f6' : '#e2e2e8',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#2563eb33';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = '#1e2024';
              }}
            >
              <div
                style={{
                  color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B',
                  flexShrink: 0,
                }}
              >
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : '\u279C'}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
      {!isGhostClick && (
        <button
          type="button"
          onClick={() => {
            if (!engineRef.current) return;
            const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
            const isFantasma = element.isFantasma;
            // Un bajante que ya tiene un ramal/tributario conectado no puede convertirse en
            // fantasma — el desplazamiento lo separaría visualmente de lo que realmente está
            // alimentando, así que se bloquea la activación con una advertencia explícita.
            if (!isFantasma && (element.recibeDeIds?.length ?? 0) > 0) {
              engineRef.current.triggerAlert(
                'No se puede activar fantasma',
                'Este bajante ya tiene un ramal o tributario conectado. Desconéctalo antes de activar el desplazamiento.',
              );
              return;
            }
            const updates: Record<string, unknown> = { isFantasma: !isFantasma };
            if (!isFantasma && lvl) {
              const currentDesp = { ...(element.desplazamientos || {}) };
              if (!currentDesp[lvl]) {
                currentDesp[lvl] = { dx: 2, dy: 0 };
                updates.desplazamientos = currentDesp;
              }
            }
            engineRef.current?.updateElementById(element.id, updates);
            setTimeout(() => {
              const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
              if (fresh) {
                setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
                if (selElement?.id === element.id) {
                  setSelElement({ ...selElement, ...updates });
                }
              }
            }, 50);
            engineRef.current?.render();
          }}
          style={{
            ...MENU_FANTASMA_BTN_STYLE,
            background: element.isFantasma ? 'rgba(245,166,35,0.12)' : 'transparent',
            color: element.isFantasma ? '#F5A623' : '#e2e2e8',
          }}
          onMouseEnter={(e) => {
            if (!element.isFantasma) e.currentTarget.style.background = '#2563eb33';
          }}
          onMouseLeave={(e) => {
            if (!element.isFantasma)
              e.currentTarget.style.background = element.isFantasma
                ? 'rgba(245,166,35,0.12)'
                : 'transparent';
          }}
        >
          {element.isFantasma
            ? 'Desactivar desplazamiento del bajante'
            : 'Activar desplazamiento del bajante'}
        </button>
      )}
    </>
  );
}
