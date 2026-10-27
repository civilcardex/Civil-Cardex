import React, { useState, useCallback } from 'react';
import { loadPlanCrop, savePlanCrop, type PlanCrop } from '../../utils/planoCrop.ts';
import { PlanCropModal } from './planosTab/PlanCropModal.tsx';

const recortarBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt2)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};
const quitarBtnStyle: React.CSSProperties = {
  padding: '4px 6px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: '#ef5350',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};

// Herramienta de recorte autocontenida, anclada abajo a la izquierda de "Carga de planos". Solo
// afecta a cómo se renderiza el plano en la isometría — la vista previa principal de aquí y el
// visor de dibujo siempre muestran el plano completo, sin recortar.
export function PlanCropPanel({
  selectedPlanUrl,
  planFile,
}: {
  selectedPlanUrl: string;
  planFile: File;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [planCrop, setPlanCropState] = useState<PlanCrop | null>(() => loadPlanCrop());

  const applyCrop = useCallback((crop: PlanCrop | null) => {
    setPlanCropState(crop);
    savePlanCrop(crop);
  }, []);

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--line)',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--txt3)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Recorte (isometría)
        </span>
      </div>
      <div
        data-tour="planos-recorte"
        style={{
          position: 'relative',
          width: '100%',
          height: 110,
          background: '#141416',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        <embed
          key={selectedPlanUrl}
          src={`${selectedPlanUrl}#toolbar=0`}
          type="application/pdf"
          title="Miniatura del plano"
          aria-label="Miniatura del plano"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        {planCrop && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              left: `${planCrop.x * 100}%`,
              top: `${planCrop.y * 100}%`,
              width: `${planCrop.w * 100}%`,
              height: `${planCrop.h * 100}%`,
              border: '2px solid #F5A623',
              boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)',
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={() => setModalOpen(true)} style={recortarBtnStyle}>
          Recortar
        </button>
        {planCrop && (
          <button type="button" onClick={() => applyCrop(null)} style={quitarBtnStyle}>
            Quitar
          </button>
        )}
      </div>
      {modalOpen && (
        <PlanCropModal
          planFile={planFile}
          initialCrop={planCrop}
          onClose={() => setModalOpen(false)}
          onSave={(crop) => {
            applyCrop(crop);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
