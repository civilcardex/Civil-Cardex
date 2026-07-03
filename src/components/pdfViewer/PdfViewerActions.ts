import { useCallback } from "react";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { pisoLbl, GAS, DEFAULT_PENDIENTE_PCT } from "../../constants";

export function usePdfViewerActions(params: {
  engineRef: React.MutableRefObject<any>;
  activeNet: string;
  selElement: Record<string, any> | null;
  setSelElement: React.Dispatch<React.SetStateAction<Record<string, any> | null>>;
  setConfirmState: React.Dispatch<React.SetStateAction<any>>;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setSnapOn: React.Dispatch<React.SetStateAction<boolean>>;
  pisos: any[];
  selectedNivel: number | null;
  tool: string;
  tipoTramo: string;
  snapOn: boolean;
  scaleM: string;
  mats: Record<string, any[]>;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  hiddenNets: Set<string>;
  lockedNets: Set<string>;
  autoSaveTimerRef: React.MutableRefObject<any>;
  doSave: () => void;
  scale: number;
  cwRef: React.MutableRefObject<HTMLDivElement | null>;
  setHiddenNets: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLockedNets: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const {
    engineRef, activeNet, selElement, setSelElement,
    setConfirmState, setScale, setSnapOn,
    pisos, selectedNivel, tool, tipoTramo, snapOn, scaleM,
    mats, diamSel, gasMatSel, pendSel,
    hiddenNets, lockedNets,
    autoSaveTimerRef, doSave, scale, cwRef,
    setHiddenNets, setLockedNets,
  } = params;

  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as any);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as any);
    eng.setSnap(snapOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find(p => p.n === selectedNivel);
    eng.nivelActual = floorObj ? { ...floorObj, label: pisoLbl(floorObj.n) } : null;
    eng.nptLevels = pisos.map(p => ({ label: pisoLbl(p.n), npt: p.npt }));
    const matName = activeNet === 'gas'
      ? (gasMatSel[activeNet] || GAS[0]?.mat || '')
      : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    const d = activeNet === 'gas'
      ? (diamSel[activeNet] || GAS[0]?.rows[0]?.dn || '')
      : (diamSel[activeNet] || '');
    const p = (activeNet === 'san' || activeNet === 'll') ? (pendSel[activeNet] !== undefined ? pendSel[activeNet] : DEFAULT_PENDIENTE_PCT) : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [tool, activeNet, tipoTramo, snapOn, scaleM, mats, diamSel, pendSel, selectedNivel, pisos, gasMatSel, engineRef]);

  const handleUndo = useCallback(() => {
    if (engineRef.current) engineRef.current.undoLast();
  }, [engineRef]);

  const handleFit = useCallback(() => {
    const eng = engineRef.current;
    const cw = cwRef.current;
    if (!eng || !cw || !eng.pageW || !eng.pageH) return;
    const pad = 16;
    const availW = cw.clientWidth - pad * 2;
    const availH = cw.clientHeight - pad * 2;
    const sc = Math.min(availW / eng.pageW, availH / eng.pageH);
    eng.zoom = sc;
    eng.offX = eng.pageW * (1 - sc) / 2;
    eng.offY = (cw.clientHeight - eng.pageH * sc) / 2;
    eng.render();
    const newScale = Math.max(1, Math.ceil(sc));
    if (newScale !== scale) setScale(newScale);
  }, [engineRef, cwRef, scale, setScale]);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find(n => n.id === netId)?.name || netId;
    setConfirmState({
      isOpen: true,
      title: 'Limpiar red',
      message: `¿Deseas eliminar todo el trazado de la red activa (${netName})? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        engineRef.current!.clearNet(netId);
        setSelElement(null);
        setConfirmState((prev: any) => ({...prev, isOpen: false}));
      }
    });
  }, [engineRef, activeNet, setConfirmState, setSelElement]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [autoSaveTimerRef, doSave]);

  const handleSnapToggle = useCallback(() => setSnapOn(prev => !prev), [setSnapOn]);

  const handleRotateLabel = useCallback(() => {
    if (engineRef.current) engineRef.current.rotateLabelSnap();
  }, [engineRef]);

  const handleUpdateSel = useCallback((field: string, value: any) => {
    if (!engineRef.current || !selElement) return;
    const fields = { [field]: value };
    engineRef.current.updateSelected(fields);
    setSelElement({ ...selElement, [field]: fields[field] });
    engineRef.current.render();
  }, [engineRef, selElement, setSelElement]);

  const handleToggleHidden = useCallback((id: string) => {
    const next = new Set(hiddenNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenNets(next);
    if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
  }, [hiddenNets, setHiddenNets, engineRef]);

  const handleToggleLocked = useCallback((id: string) => {
    const next = new Set(lockedNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLockedNets(next);
    if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
  }, [lockedNets, setLockedNets, engineRef]);

  return {
    syncEngine,
    handleUndo,
    handleFit,
    handleClear,
    handleSave,
    handleSnapToggle,
    handleRotateLabel,
    handleUpdateSel,
    handleToggleHidden,
    handleToggleLocked,
  };
}
