/**
 * Panel izquierdo de la pestaña "Planos": checklist "Requisitos del plano" (con su modal de
 * protocolo) y, si hay un plano seleccionado, el panel de recorte PlanCropPanel.
 * Ej: clic en "📋 Requisitos para carga" abre el modal con las reglas del PDF aceptado.
 */
import { useState } from 'react';
import { REQ_ITEMS } from '../../../constants';
import ModalProtocolo from '../ModalProtocol.tsx';
import { PlanCropPanel } from '../PlanCropPanel.tsx';
import { PlanosTab_reqBtnBase } from '../PlansTab.styles.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';

export interface PlansRequirementsProps {
  /** Plano seleccionado: si hay uno con URL, el panel de recorte aparece bajo la checklist. */
  selectedPlan: PlanItem | null;
  /** URL de vista previa del plano seleccionado (null = sin vista previa). */
  selectedPlanUrl: string | null;
}

/** Columna izquierda: requisitos del plano + recorte del plano seleccionado. */
export function PlansRequirements({ selectedPlan, selectedPlanUrl }: PlansRequirementsProps) {
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  return (
    <>
      <div
        style={{
          width: 215,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--line)',
        }}
      >
        <div
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          data-tour="planos-requisitos"
        >
          <div
            className="card-h"
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--line)',
              flexShrink: 0,
              background: 'none',
            }}
          >
            <h3 className="card-t" style={{ fontSize: 15 }}>
              <img
                src="/iconos_civilflow/carga_planos/requisitos_del_plano.webp"
                alt="Requisitos del plano"
                width={24}
                height={24}
                style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
                loading="lazy"
              />
              Requisitos del plano
            </h3>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setShowProtocolo(true)}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                ...PlanosTab_reqBtnBase,
                background: btnHover ? 'rgba(0, 220, 229, 0.1)' : 'var(--bg3)',
                border: `1.5px solid ${btnHover ? '#00dce5' : 'var(--line)'}`,
                color: btnHover ? '#00dce5' : 'var(--txt2)',
                fontWeight: btnHover ? 600 : 400,
              }}
            >
              📋 Requisitos para carga
            </button>
            {REQ_ITEMS.map(({ ico, icoImg, t, s }) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  background: 'var(--bg3)',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--line)',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {icoImg ? (
                    <img
                      src={icoImg}
                      alt=""
                      width={24}
                      height={24}
                      style={{ width: 24, height: 24, verticalAlign: 'middle' }}
                      loading="lazy"
                    />
                  ) : (
                    ico
                  )}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t}</div>
                  <div
                    style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.4 }}
                  >
                    {s}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedPlan && selectedPlanUrl && (
          <PlanCropPanel selectedPlanUrl={selectedPlanUrl} planFile={selectedPlan.file} />
        )}
      </div>
      {showProtocolo && <ModalProtocolo onClose={() => setShowProtocolo(false)} />}
    </>
  );
}
