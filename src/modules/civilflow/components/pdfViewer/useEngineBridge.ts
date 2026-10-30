import { useCallback } from 'react';
import type React from 'react';
import PlanoEngine, { type ToolType, type TramoType } from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';
import type { MaterialItem } from '../../context/ProjectContext.tsx';
import { pisoLbl, DEFAULT_PENDIENTE_PCT } from '../../constants';
import { limpiarStoresDeBorrado } from './aparatosDeleteSweep.ts';
import { emitAparatosClear } from '../../utils/fixtureEvents.ts';
import type { ProbedElement } from './tramoEditor/context.ts';

/**
 * Puente motor↔React: los callbacks que el visor registra en PlanoEngine (onDelete, onSelect,
 * onAlert) y syncEngine, que empuja a cada cambio relevante las elecciones de la UI
 * (herramienta, red, diámetro, material, nivel) hacia el motor. Extraído de PdfViewer verbatim;
 * el REGISTRO en el motor sigue ocurriendo en usePdfViewerEngine y en los efectos del
 * orquestador (mismos puntos que antes).
 *
 * Ejemplo: el usuario elige 4" en el panel → cambia diamSel → syncEngine corre (efecto del
 * orquestador) → eng.setRamalDefaults hace que el PRÓXIMO ramal nazca con ese diámetro.
 */
export function useEngineBridge(args: {
  engineRef: React.RefObject<PlanoEngine | null>;
  syncDrawings: () => void;
  suprimirPorBorrado: (ids: string[]) => void;
  setSelElement: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  tool: string;
  activeNet: string;
  tipoTramo: string;
  snapOn: boolean;
  gridOn: boolean;
  scaleM: string;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
  mats: Record<string, MaterialItem[]>;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  selectedNivel: number | null;
  pisos: Piso[];
}) {
  const {
    engineRef,
    syncDrawings,
    suprimirPorBorrado,
    setSelElement,
    tool,
    activeNet,
    tipoTramo,
    snapOn,
    gridOn,
    scaleM,
    setScaleM,
    mats,
    diamSel,
    gasMatSel,
    selectedNivel,
    pisos,
  } = args;

  const onDeleteHandler = useCallback(
    (ids: string[]) => {
      // Ventana anti-alerta durante el borrado + limpieza del dedupe (el renumerado
      // reutiliza ids y no debe heredar la supresión del ramal borrado).
      suprimirPorBorrado(ids);
      // [] = solo abre la ventana anti-alerta (borrador en vacío): sin fan-out — un clic sin
      // nada borrado no es un cambio (no emite aparatos-clear ni re-sincroniza dibujos).
      if (ids.length === 0) return;
      limpiarStoresDeBorrado(engineRef.current, ids);
      emitAparatosClear({ ids });
      syncDrawings();
    },
    // engineRef añadido: ref estable (identidad fija) — sin cambio de conducta.
    [syncDrawings, suprimirPorBorrado, engineRef],
  );

  const noopStatus = useCallback(() => {}, []);
  // Setter estable (identidad fija por contrato de React): listarlo no añade corridas.
  const onSelectHandler = useCallback(
    (el: Record<string, unknown> | null) => {
      setSelElement(el as ProbedElement | null);
    },
    [setSelElement],
  );
  const onAlertHandler = useCallback((title: string, msg: string) => {
    window.dispatchEvent(
      new CustomEvent('civilflow_diametro_validation', { detail: { title, message: msg } }),
    );
  }, []);

  // ── Acciones en línea ──
  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as ToolType);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as TramoType);
    eng.setSnap(snapOn);
    eng.setGridMode(gridOn);
    // La escala del MOTOR manda cuando el piso tiene dibujo: el doc define el espacio de
    // los píxeles y su escala es la que interpretan las cotas. Si el estado de React se
    // diferenció (un refresco de planos lo pisa), se adopta la del motor en vez de deformar
    // el dibujo (orig. usuario: al reingresar, las cotas leían menos y los elementos
    // aparecían desplazados).
    const smEstado = Number(scaleM);
    const conDibujo =
      eng.ramales.length +
        eng.bajantes.length +
        eng.areas.length +
        eng.dims.length +
        eng.textAnnots.length >
      0;
    if (
      conDibujo &&
      Number.isFinite(smEstado) &&
      eng.scaleM > 0 &&
      Math.abs(smEstado - eng.scaleM) > 1e-9
    ) {
      setScaleM(String(eng.scaleM));
    } else {
      eng.setScaleM(scaleM);
    }
    const floorObj = pisos.find((p) => p.n === selectedNivel);
    eng.nivelActual = floorObj
      ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) }
      : null;
    eng.nptLevels = pisos.map((p) => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));
    // Gas tiene varias opciones reales de material (según MATERIALES_POR_RED) — a diferencia de
    // las redes de un solo material, NO debe pre-rellenar un default silenciosamente; el usuario
    // tiene que elegir uno activamente, igual que haría cualquier otra red multimaterial si
    // tuviera más de una opción canónica.
    const matName =
      activeNet === 'gas'
        ? gasMatSel[activeNet] || ''
        : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    // Fix issue #3: tributario no hereda diámetro 4" por defecto — solo inodoro lo requiere
    const dRaw = activeNet === 'gas' ? diamSel[activeNet] || '' : diamSel[activeNet] || '';
    const d = tipoTramo === 'tributario' ? '' : dRaw;
    const p = activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
    // setScaleM añadido a deps: setter de useState (identidad estable) — sin cambio de conducta.
  }, [
    tool,
    activeNet,
    tipoTramo,
    snapOn,
    gridOn,
    scaleM,
    mats,
    diamSel,
    selectedNivel,
    pisos,
    gasMatSel,
    setScaleM,
    engineRef,
  ]);

  return { onDeleteHandler, noopStatus, onSelectHandler, onAlertHandler, syncEngine };
}
