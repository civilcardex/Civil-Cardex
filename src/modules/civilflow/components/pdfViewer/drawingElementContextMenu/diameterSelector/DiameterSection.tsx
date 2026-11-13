/**
 * Sección "Diámetro" del menú del bajante en sus DOS variantes: el selector normal (fila junto a
 * "Destino", valida contra los ramales conectados y espeja tablas↔dibujo) y la variante para el
 * fantasma entrepisos (XFG), que guarda el Ø en el ghostData del piso en vez del elemento real.
 * Ej: elegir Ø100 en BAN1 reescribe el diámetro en el dibujo (writeBajantePropToDrawing).
 */
import { pisoLbl } from '../../../../constants';
import { normalizeDnLabel } from '../../../../utils/formatUtils.ts';
import { writeBajantePropToDrawing } from '../../../../utils/writeDiameterToDrawing.ts';
import { diamPulgFromLabel } from '../../../../utils/diamInchesFromLabel.ts';
import { validarDiametroEntrePisos } from '../../../../utils/drawingWrites/diameters';
import { avisarDiametroInvalido } from '../../../../utils/diameterValidation.ts';
import { opcionesDiametroElemento } from '../../../../utils/montanteDiameterOptions';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type PlanoEngine from '../../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoBajante, PlanoElement } from '../../../../lib/PlanoEngine/PlanoState.ts';
import type { PlanItem } from '../../../../context/PlansContext.tsx';
import { type ContextMenuState } from '../context.ts';

/** Bloquea el gesto si viola la regla entre pisos (alerta modal + revierte el select). plano del bajante. bajante vivo del motor (punteros más frescos que el
 * storage). evento del select (para revertir el valor visible). fuerza re-render del menú. */
function bloquearDiametroEntrePisos(
  pid: string,
  el: { id: string; dNominal?: string; descargaEnId?: string | null; origenId?: string | null },
  e: { target: { value: string } },
  refrescar: () => void,
): boolean {
  const v = validarDiametroEntrePisos(pid, el.id, e.target.value, {
    descargaEnId: el.descargaEnId,
    origenId: el.origenId,
  });
  if (v.ok) return false;
  avisarDiametroInvalido(v.mensaje, v.titulo);
  e.target.value = el.dNominal || '';
  refrescar();
  return true;
}

/** Selector "Diámetro" del bajante real: valida contra los ramales conectados y la regla entre pisos. */
export function DiameterSelect({
  element,
  selectedNivel,
  isGhostClick,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  planosCtx,
  updateGhostField,
}: {
  element: PlanoBajante;
  selectedNivel: number | null;
  isGhostClick: boolean;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
  planosCtx: { plans: PlanItem[] };
  updateGhostField: (field: string, val: string) => void;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="dcm-section-label-row">Diámetro</div>
      <select
        value={(() => {
          const gd = element.ghostData?.[currentGhostLabel];
          return isGhostClick
            ? gd && gd.dNominal !== undefined
              ? gd.dNominal
              : element.dNominal || ''
            : element.dNominal || '';
        })()}
        aria-label="Diámetro"
        onChange={(e) => {
          const val = e.target.value;
          if (isGhostClick) {
            updateGhostField('dNominal', val);
          } else {
            // Validación: el diámetro del bajante/montante no puede ser menor que el
            // de los ramales conectados. El montante mira AMBOS sentidos (recibe y
            // alimenta — espejo de la regla de bajanteEditor af/ac).
            const esMonte = element.tipo === 'montante';
            const ramalesConectados = [
              ...(element.recibeDeIds || []),
              ...(esMonte ? element.alimentaIds || [] : []),
            ];
            const sustDiam = esMonte ? 'montante' : 'bajante';
            if (val && ramalesConectados.length && engineRef.current) {
              const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
              if (bajIn > 0) {
                for (const rid of ramalesConectados) {
                  const ram = engineRef.current.ramales.find((r) => r.id === rid);
                  if (!ram || !ram.diametro) continue;
                  const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                  if (ramIn > 0 && ramIn > bajIn) {
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      `Diámetro del ${sustDiam} no puede ser menor al del ramal conectado (${ram.diametro})`,
                    );
                    e.target.value = element.dNominal || '';
                    // Select controlado: sin re-render, el DOM seguía mostrando el
                    // valor rechazado (React no sabía del cambio directo).
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...prev.element } } : null,
                    );
                    return;
                  }
                }
              }
            }
            // Regla entre pisos: el inferior no puede quedar con menor diámetro.
            if (
              val &&
              engineRef.current &&
              bloquearDiametroEntrePisos(
                String(engineRef.current._loadedPlanId ?? ''),
                element,
                e,
                () =>
                  setContextMenuState((prev) =>
                    prev ? { ...prev, element: { ...prev.element } } : null,
                  ),
              )
            )
              return;
            const fields = { dNominal: val };
            engineRef.current?.updateElementById(element.id, fields);
            // Espejo entre pisos (tablas↔dibujo no divergen): persiste y espeja.
            if (val && engineRef.current) {
              writeBajantePropToDrawing(
                `${element.id}-${String(engineRef.current._loadedPlanId ?? '')}`,
                element.net || 'san',
                'dNominal',
                val,
                planosCtx.plans,
              );
            }
            const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
            if (fresh) {
              setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
              if (selElement?.id === element.id) {
                setSelElement({ ...selElement, dNominal: fields.dNominal });
              }
            }
          }
        }}
        className="dcm-select"
      >
        <option value="">—</option>
        {opcionesDiametroElemento(element).map((d) => (
          <option key={`${d.pulg}-${d.nom}`} value={d.nom}>
            {normalizeDnLabel(d.nom)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Selector "Diámetro" del fantasma entrepisos (XFG): escribe el Ø en el ghostData del piso destino. */
export function GhostDiameterSection({
  element,
  selectedNivel,
  isGhostClick,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  planosCtx,
  updateGhostField,
}: {
  element: PlanoBajante;
  selectedNivel: number | null;
  isGhostClick: boolean;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
  planosCtx: { plans: PlanItem[] };
  updateGhostField: (field: string, val: string) => void;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  return (
    <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div className="dcm-section-label-row">Diámetro</div>
      <select
        value={(() => {
          const gd = element.ghostData?.[currentGhostLabel];
          return isGhostClick
            ? gd && gd.dNominal !== undefined
              ? gd.dNominal
              : element.dNominal || ''
            : element.dNominal || '';
        })()}
        aria-label="Diámetro"
        onChange={(e) => {
          const val = e.target.value;
          if (engineRef.current) {
            if (isGhostClick) {
              updateGhostField('dNominal', val);
            } else {
              // Validación: el diámetro del bajante no puede ser menor que el de los
              // ramales conectados
              if (val && element.recibeDeIds?.length) {
                const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                if (bajIn > 0) {
                  for (const rid of element.recibeDeIds) {
                    const ram = engineRef.current.ramales.find((r) => r.id === rid);
                    if (!ram || !ram.diametro) continue;
                    const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                    if (ramIn > 0 && ramIn > bajIn) {
                      engineRef.current?.triggerAlert(
                        'Diámetro no permitido',
                        `Diámetro del bajante no puede ser menor al del ramal conectado (${ram.diametro})`,
                      );
                      e.target.value = element.dNominal || '';
                      // Select controlado: sin re-render, el DOM seguía mostrando el
                      // valor rechazado (React no sabía del cambio directo).
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...prev.element } } : null,
                      );
                      return;
                    }
                  }
                }
              }
              // Regla entre pisos: el inferior no puede quedar con menor diámetro.
              if (
                val &&
                engineRef.current &&
                bloquearDiametroEntrePisos(
                  String(engineRef.current._loadedPlanId ?? ''),
                  element,
                  e,
                  () =>
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...prev.element } } : null,
                    ),
                )
              )
                return;
              const fields = { dNominal: val };
              engineRef.current?.updateElementById(element.id, fields);
              // Espejo entre pisos (tablas↔dibujo no divergen): persiste y espeja.
              if (val && engineRef.current) {
                writeBajantePropToDrawing(
                  `${element.id}-${String(engineRef.current._loadedPlanId ?? '')}`,
                  element.net || 'san',
                  'dNominal',
                  val,
                  planosCtx.plans,
                );
              }
              const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
              if (fresh) {
                setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
                if (selElement?.id === element.id) {
                  setSelElement({ ...selElement, dNominal: fields.dNominal });
                }
              }
            }
          }
        }}
        className="dcm-select"
      >
        <option value="">—</option>
        {opcionesDiametroElemento(element).map((d) => (
          <option key={`${d.pulg}-${d.nom}`} value={d.nom}>
            {normalizeDnLabel(d.nom)}
          </option>
        ))}
      </select>
    </div>
  );
}
