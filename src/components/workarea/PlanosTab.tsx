import { useState, useRef, useCallback } from "react";
import { REQ_ITEMS, pisoLbl } from "../../constants";
import EmptyState from "../shared/EmptyState";
import PlanoConfigurator from "./PlanoConfigurator";
import type { useWorkAreaState } from "../useWorkAreaState";

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface PlanosTabProps {
  state: WorkAreaState;
}

interface CalibrationData {
  origen: { x_px: number; y_px: number } | null;
  scaleM: number | null;
  factorX: number | null;
  factorY: number | null;
  calGlobal: boolean | null;
}

export default function PlanosTab({ state }: PlanosTabProps) {
  const {
    plans, addPlans, removePlan, updatePlan, confirmPlan,
    planDrag, setPlanDrag,
    selectedPlanId, setSelectedPlanId,
    selectedPlan, selectedPlanUrl,
    pendingPlanos, confirmedPlanos,
    pisos, fileRef,
  } = state;

  const [calibrating, setCalibrating] = useState(false);
  const [calData, setCalData] = useState<Record<number, CalibrationData>>({});

  const isCalibrated = useCallback((planId: number) => {
    const cd = calData[planId];
    return cd && cd.origen && cd.scaleM;
  }, [calData]);

  const handleSaveConfig = (config: CalibrationData & { planId: number }) => {
    setCalData(prev => ({ ...prev, [config.planId]: config }));
    if (!(window as any)._planosConfig) (window as any)._planosConfig = {};
    const key = `${selectedPlan?.name || 'plan'}_${config.planId}`;
    (window as any)._planosConfig[key] = {
      nombre: selectedPlan?.name || '',
      origen: config.origen,
      scaleM: config.scaleM,
      factorX: config.factorX,
      factorY: config.factorY,
      calGlobal: config.calGlobal,
      fecha: new Date().toLocaleString('es-CO'),
    };
    if (config.scaleM) {
      updatePlan(config.planId, { scale: Math.round(config.scaleM * 100) });
    }
  };

  const handleIrADibujo = () => {
    if (!selectedPlan) return;
    const idx = plans.findIndex(p => p.id === selectedPlan.id);
    if (idx >= 0) {
      try {
        localStorage.setItem('civilflow_visor_activeIndex', String(idx));
        localStorage.setItem('civilflow_visor_activePlanId', String(selectedPlan.id));
      } catch (_) {}
    }
    window.location.hash = '#/visor';
  };

  const handleSelectPending = (plan: any) => {
    setSelectedPlanId(plan.id);
    setCalibrating(true);
  };

  // Calibration mode: full-width PlanoConfigurator with back button
  if (calibrating && selectedPlan) {
    const cal = calData[selectedPlan.id];
    const calDone = cal && cal.origen && cal.scaleM;
    return (
      <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setCalibrating(false); }}
            style={{ padding: '4px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← VOLVER A CARGA DE PLANOS
          </button>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>|</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{selectedPlan.name}</span>
          {calDone && (
            <span style={{ fontSize: 9, color: 'var(--ok)', marginLeft: 4 }}>✓ Calibrado</span>
          )}
          <div style={{ flex: 1 }} />
          {selectedPlan.nivel !== null && calDone && (
            <button onClick={() => {
              if (plans.some((x: any) => x.id !== selectedPlan.id && x.status === 'confirmed' && x.nivel === selectedPlan.nivel)) {
                alert('Este nivel ya tiene un plano asociado.');
                return;
              }
              confirmPlan(selectedPlan.id);
              setCalibrating(false);
            }} style={{ padding: '4px 14px', background: 'rgba(14,204,122,0.12)', border: '1.5px solid rgba(14,204,122,0.3)', borderRadius: 'var(--r)', color: '#0ECC7A', cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ✓ CONFIRMAR PLANO
            </button>
          )}
          {(!calDone || selectedPlan.nivel === null || selectedPlan.nivel === undefined) && (
            <span style={{ fontSize: 9, color: 'var(--txt4)', whiteSpace: 'nowrap' }}>
              {!calDone ? 'Define origen y calibración' : 'Asigna un nivel en Paso 0'}
            </span>
          )}
        </div>
        <PlanoConfigurator
          planFile={selectedPlan.file}
          planName={selectedPlan.name}
          planId={selectedPlan.id}
          onSaveConfig={handleSaveConfig}
          onIrADibujo={handleIrADibujo}
          existingCal={cal}
          pisos={pisos}
          plans={plans}
          planNivel={selectedPlan.nivel ?? null}
          onUpdateNivel={(pid, nivel) => updatePlan(pid, { nivel })}
        />
      </div>
    );
  }

  return (
    <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', padding: 0 }}>
      <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', borderRadius: 'var(--r2)' }}>
        <div className="card-h" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'none' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_carga_planos/requisitos_del_plano.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} />
            Requisitos del plano
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REQ_ITEMS.map(({ ico, icoImg, t, s }) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icoImg ? <img src={icoImg} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : ico}</span>
              <div><div style={{ fontSize: 12, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.4 }}>{s}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}
        onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
        onDragLeave={() => setPlanDrag(false)}
        onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) addPlans(e.target.files); e.target.value = ''; }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', minHeight: 36 }}>
          {selectedPlan ? (
            <>
              <span style={{ fontSize: 14, flexShrink: 0 }}>&#x1F4C4;</span>
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPlan.name}</span>
              {selectedPlan.nivel !== null && <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', color: 'var(--txt3)', flexShrink: 0 }}>{pisoLbl(selectedPlan.nivel)}</span>}
              <span style={{ fontSize: 9, color: 'var(--txt3)', flexShrink: 0 }}>1:{selectedPlan.scale}</span>
              {isCalibrated(selectedPlan.id) && <span style={{ fontSize: 9, color: 'var(--ok)', flexShrink: 0 }}>✓</span>}
              <div style={{ flex: 1 }} />
              <button onClick={() => setCalibrating(true)}
                style={{ padding: '4px 12px', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--r)', color: '#F5A623', cursor: 'pointer', fontSize: 10, fontWeight: 700, flexShrink: 0, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s', textTransform: 'uppercase' }}
                title="Calibrar plano">
                &#x1F4CF; CALIBRAR
              </button>
              <button onClick={() => setSelectedPlanId(null)}
                style={{ padding: '4px 12px', background: 'rgba(211,47,47,0.15)', border: '1px solid rgba(211,47,47,0.35)', borderRadius: 'var(--r)', color: '#ef5350', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(211,47,47,0.3)'; e.currentTarget.style.borderColor = 'rgba(211,47,47,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(211,47,47,0.15)'; e.currentTarget.style.borderColor = 'rgba(211,47,47,0.35)'; }}
                title="Cerrar vista">&#x2715; Cerrar</button>
              {selectedPlan.status === 'confirmed' && (
                <a href="#/visor"
                  onClick={() => {
                    const idx = plans.findIndex(p => p.id === selectedPlanId);
                    if (idx >= 0) {
                      try {
                        localStorage.setItem('civilflow_visor_activeIndex', String(idx));
                        localStorage.setItem('civilflow_visor_activePlanId', String(selectedPlanId));
                      } catch (_) {}
                    }
                  }}
                  style={{ padding: '3px 10px', background: 'rgba(0,220,229,0.08)', border: '1px solid rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  IR A DIBUJO DE REDES &rarr;
                </a>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Vista previa del plano</span>
          )}
        </div>

        {selectedPlan && selectedPlanUrl ? (
          <div style={{ flex: 1, background: '#141416', position: 'relative' }}>
            {planDrag && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,220,229,.12)', border: '3px dashed rgba(0,220,229,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            )}
            <embed key={selectedPlanUrl} src={selectedPlanUrl} type="application/pdf" title="Plano seleccionado" style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg)', cursor: 'pointer', position: 'relative' }}
            onClick={() => fileRef.current?.click()}>
            {planDrag ? (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,220,229,.08)', border: '3px dashed rgba(0,220,229,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, opacity: .25 }}>&#x1F4D0;</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>Vista previa del plano</div>
                <div style={{ fontSize: 10, color: 'var(--txt4)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                  Sube un plano desde el panel derecho o arrastra un PDF aquí
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ width: '100%', padding: '10px', background: 'rgba(0,220,229,0.06)', border: '1.5px dashed rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.3)'; }}>
            <img src="/iconos_carga_planos/subir_plano.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} /> SUBIR PLANO
          </button>
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}
          onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
          onDragLeave={() => setPlanDrag(false)}
          onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
          <div style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
            <img src="/iconos_carga_planos/pendientes.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
            Pendientes {pendingPlanos.length > 0 && `(${pendingPlanos.length})`}
          </div>
          {pendingPlanos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--txt4)', textAlign: 'center', lineHeight: 1.6 }}
              onClick={() => fileRef.current?.click()}>
              {planDrag ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</div>
              ) : (
                <>
                  <div style={{ fontSize: 24, opacity: .3 }}>&#x1F4D0;</div>
                  <span>Arrastra PDFs aquí o haz clic para subir varios planos</span>
                </>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pendingPlanos.map((p: any) => {
                const calOk = isCalibrated(p.id);
                return (
                  <div key={p.id} onClick={() => handleSelectPending(p)}
                    style={{ cursor: 'pointer', padding: '8px 10px', borderBottom: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 4, transition: 'background .1s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>&#x1F4C4;</span>
                      <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{p.name}</span>
                      <button onClick={e => { e.stopPropagation(); removePlan(p.id); }}
                        style={{ padding: '2px 8px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Cancelar">Cancelar</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        {calOk
                          ? <span style={{ fontSize: 10, color: 'var(--ok)' }}>✓ Calibrado — Asigna nivel para confirmar</span>
                          : <span style={{ fontSize: 10, color: '#F5A623' }}>⚡ Requiere calibración</span>
                        }
                      </div>
                      {calOk && p.nivel !== null && p.nivel !== undefined && (
                        <button onClick={e => {
                          e.stopPropagation();
                          if (plans.some((x: any) => x.id !== p.id && x.status === 'confirmed' && x.nivel === p.nivel)) {
                            alert('Este nivel ya tiene un plano asociado.');
                            return;
                          }
                          confirmPlan(p.id);
                        }} style={{ padding: '3px 10px', background: 'rgba(14,204,122,0.12)', border: '1.5px solid rgba(14,204,122,0.3)', borderRadius: 'var(--r)', color: '#0ECC7A', cursor: 'pointer', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>&#x2713; Confirmar</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
            <img src="/iconos_carga_planos/cargados.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
            Cargados {confirmedPlanos.length > 0 && `(${confirmedPlanos.length})`}
          </div>
          {confirmedPlanos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState message="Aún no hay planos cargados" />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {confirmedPlanos.map((p: any) => (
                <div key={p.id} onClick={() => setSelectedPlanId(p.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent', transition: 'background .1s' }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>&#x1F4C4;</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', gap: 5 }}>
                      {p.nivel !== null && <span>{pisoLbl(p.nivel)}</span>}
                      <span>1:{p.scale}</span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setSelectedPlanId(p.id); }}
                    style={{ padding: '3px 7px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--acc2)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Vista previa">&#x1F441;</button>
                  <button onClick={e => { e.stopPropagation(); removePlan(p.id); }}
                    style={{ padding: '3px 7px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Eliminar">&#x2715;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
