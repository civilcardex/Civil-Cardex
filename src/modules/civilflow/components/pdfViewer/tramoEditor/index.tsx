import { type RefObject } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';
import {
  TramoEditorCtx,
  useTramoEditorContext,
  ROTATE_LABEL_BTN_STYLE,
  type ProbedElement,
  type TramoEditorContextValue,
} from './context';
import {
  ContadorTramoEditor,
  CalentadorTramoEditor,
  CanalTramoEditor,
  BajanteHeaderFields,
  AreaHeaderFields,
  TextHeaderFields,
  RamalHeaderFields,
  BajanteEditorSection,
  RamalEditorSection,
} from './variants';

interface TramoEditorProps {
  selElement: PlanoElement | null;
  activeNet: string;
  engineRef: RefObject<PlanoEngine | null>;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, Array<{ val: string }>> | null;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  handleUpdateSel: (field: string, value: unknown) => void;
  handleRotateLabel: () => void;
  plans?: PlanItem[];
  pisos?: Piso[];
}

export default function TramoEditor(props: TramoEditorProps) {
  const ctxValue: TramoEditorContextValue = {
    engineRef: props.engineRef as React.MutableRefObject<PlanoEngine | null>,
    selElement: props.selElement,
    setSelElement: props.setSelElement,
    activeNet: props.activeNet,
    handleUpdateSel: props.handleUpdateSel,
    handleRotateLabel: props.handleRotateLabel,
    diamSel: props.diamSel,
    setDiamSel: props.setDiamSel,
    gasMatSel: props.gasMatSel,
    setGasMatSel: props.setGasMatSel,
    pendSel: props.pendSel,
    setPendSel: props.setPendSel,
    pendInput: props.pendInput,
    setPendInput: props.setPendInput,
    mats: props.mats,
    matLongName: props.matLongName,
    plans: props.plans,
    pisos: props.pisos,
  };

  return (
    <TramoEditorCtx.Provider value={ctxValue}>
      <TramoEditorInner />
    </TramoEditorCtx.Provider>
  );
}

function TramoEditorInner() {
  const ctx = useTramoEditorContext();
  const { engineRef, handleRotateLabel } = ctx;
  const selElement = ctx.selElement as ProbedElement | null;

  if (selElement && selElement.tipo === 'contador') return <ContadorTramoEditor />;
  if (selElement && selElement.tipo === 'calentador') return <CalentadorTramoEditor />;
  if (selElement && selElement.tipo === 'canal') return <CanalTramoEditor />;

  const isGhostSel =
    (selElement &&
      (selElement.tipo === 'bajante' || selElement.tipo === 'montante') &&
      engineRef.current?._isGhostSel) ||
    false;
  const isBajMont = selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante');
  const isArea = selElement && selElement.id?.startsWith('AR');
  const isText = selElement && selElement.id?.startsWith('T');
  // Las guías también llevan una polilínea `pts` (reutilizada para la detección de clics, como un ramal)
  // pero no tienen `tipo` ni están en engine.ramales — sin esta exclusión, al seleccionar una guía
  // caía en el fallback de `selElement.pts` de abajo y renderizaba el editor completo de ramal
  // (material/diámetro/pendiente) más el panel Aparatos (PdfViewer.tsx), nada de lo cual aplica a una guía.
  const isGuide = !!selElement?.id?.startsWith('GL');
  const isRamal =
    selElement &&
    !isGuide &&
    (selElement.tipo === 'ramal' || selElement.tipo === 'tributario' || selElement.pts);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              color: '#9BA8AA',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {isGhostSel
              ? 'Datos del bajante fantasma'
              : isArea
                ? 'Datos del área'
                : isGuide
                  ? 'Línea guía'
                  : 'Datos del tramo'}
          </div>
          {selElement && (selElement.pts || selElement.id?.startsWith('T')) && (
            <button
              type="button"
              onClick={handleRotateLabel}
              title="Rotar etiqueta (0°/45°/90°/-90°/-45°)"
              style={ROTATE_LABEL_BTN_STYLE}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>↻</span>
              <span>{selElement.labelAngle || selElement.textAngle || 0}°</span>
            </button>
          )}
        </div>
        {selElement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {isRamal && <RamalHeaderFields />}
            {isBajMont && <BajanteHeaderFields />}
            {isText && <TextHeaderFields />}
            {isArea && <AreaHeaderFields />}
            {selElement.pts && (
              <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace" }}>
                L={selElement.totalL}m · {selElement.pts.length} pts
                {selElement.tipo ? ` · ${selElement.tipo}` : ''}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: '#8AB4D6',
              fontFamily: "'Geist',monospace",
              padding: '4px 0',
            }}
          >
            Selecciona un elemento en el plano
          </div>
        )}
      </div>

      {selElement && !isArea && isBajMont && <BajanteEditorSection />}
      {selElement && !isArea && !isBajMont && !isGuide && <RamalEditorSection />}
    </form>
  );
}
