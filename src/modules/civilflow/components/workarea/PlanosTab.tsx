import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  saveTrazosToDB,
  loadTrazosFromDB,
  loadFromStorage,
  saveToStorage,
} from '../../services/storageService';
import {
  TRAZOS_PREFIX,
  VISOR_ACTIVE_PLAN_ID_KEY,
  VISOR_ACTIVE_INDEX_KEY,
} from '../../constants/storage-keys';
import { REQ_ITEMS, pisoLbl } from '../../constants';

import { PlanoConfigurator } from './PlanoConfigurator';
import { origenDePlan } from '../../utils/crossFloorStorage';
import { sanearAsociacionesTrasRecalibrar } from '../../utils/sanearAsociaciones';
import {
  PlanosTab_S1,
  PlanosTab_S2,
  PlanosTab_S3,
  PlanosTab_S4,
  PlanosTab_S5,
  PlanosTab_S6,
  PlanosTab_S7,
  PlanosTab_S8,
  PlanosTab_S9,
  PlanosTab_S10,
  PlanosTab_S11,
  PlanosTab_S12,
  PlanosTab_S13,
  PlanosTab_S14,
  PlanosTab_reqBtnBase,
  PlanosTab_pendingLi,
  PlanosTab_verBtn,
} from './PlanosTab.styles';
import type { useWorkAreaState } from '../useWorkAreaState';
import ModalProtocolo from './ModalProtocolo';
import { PlanCropPanel } from './PlanCropPanel';
import { devError } from '../../../../utils/devError';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

import {
  calDataDePlan,
  seedCalData,
  computeGlobalCal,
  computeOrigenesCompartidos,
  stampCalibracion,
  type CalibrationData,
} from './planosTabCalibracion';

interface PlanosTabProps {
  state: WorkAreaState;
}

function PlanosTab({ state }: PlanosTabProps) {
  const {
    plans,
    addPlans,
    removePlan,
    updatePlan,
    confirmPlan,
    planDrag,
    setPlanDrag,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    selectedPlanUrl,
    pendingPlanos,
    confirmedPlanos,
    pisos,
    fileRef,
  } = state;

  const navigate = useNavigate();
  const [calibrating, setCalibrating] = useState(false);
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [nivelPickerPlanId, setNivelPickerPlanId] = useState<number | null>(null);
  // Modal "define el origen de esta lámina" tras ASIGNAR PISO (flujo nuevo) + flag que abre el
  // configurador directo en modo marcado de origen.
  const [origenModalPlanId, setOrigenModalPlanId] = useState<number | null>(null);
  const [autoOrigen, setAutoOrigen] = useState(false);
  const [calData, setCalData] = useState<Record<number, CalibrationData>>(() => {
    const initial: Record<number, CalibrationData> = {};
    if (plans) {
      for (const p of plans) {
        if (p.origen && p.scale) initial[p.id] = calDataDePlan(p);
      }
    }
    return initial;
  });

  // 1a: la calibración se deriva de los planes vivos. Al borrar planos se purga el calData
  // huérfano (y la caché global en window._planosConfig cuando no queda ningún plano) para
  // que el modal de primera calibración reaparezca si se borran todos los planos.
  // TAMBIÉN SIEMBRA: el initializer de calData corre una sola vez y en un remount plans
  // suele llegar vacío (restauración async de PlansContext) — sin siembra, globalCal quedaba
  // null para siempre y "Asignar piso" desaparecía tras cerrar y reabrir (bug 2026-09-22).
  useEffect(() => {
    setCalData((prev) => {
      const { next, changed } = seedCalData(prev, plans);
      return changed ? next : prev;
    });
    if (plans.length === 0) {
      const win = window as unknown as { _planosConfig?: Record<string, unknown> };
      win._planosConfig = {};
    }
  }, [plans]);

  const isCalibrated = useCallback(
    (planId: number) => {
      const cd = calData[planId];
      return cd && cd.origen && cd.scaleM;
    },
    [calData],
  );

  // Un plan calibrado con "Alcance: Todos" debería aplicar a todo piso futuro — pero hasta ahora
  // nada se lo ofrecía a un plan recién subido; cada uno debía calibrarse a mano. Se expone
  // como alternativa de un clic a CALIBRAR.
  const globalCal = useMemo(() => computeGlobalCal(calData, plans), [calData, plans]);

  // Láminas confirmadas que comparten el MISMO origen px con otra: la herencia vieja clonaba el
  // origen de la primera calibración a todos los planos — solo es legítimo si las hojas están
  // realmente alineadas. El badge en la fila de "Cargados" guía a re-marcar el origen.
  const origenesCompartidos = useMemo(() => computeOrigenesCompartidos(plans), [plans]);

  const handleAsignarPiso = (planId: number, nivel: number) => {
    // Con la calibración ya global (primera calibración confirmada con el modal), asignar piso
    // hereda la ESCALA del proyecto, pero el ORIGEN ya NO se clona: las láminas del mismo
    // AutoCAD no comparten posición absoluta (el edificio cae en px distintos por hoja) y con
    // origenSrc === origenDst el desfase de copia quedaba en 0 — copias e isometría
    // desalineadas entre pisos. Si el plan ya tiene calibración propia no se pisa: el
    // configurador la muestra y el usuario decide.
    // Origen REAL (sembrado con origen:null por el primer clic NO cuenta): si el usuario
    // canceló el modal, el segundo clic debe volver a abrir el flujo guiado (idempotente).
    const necesitaOrigen =
      !!globalCal && !calData[planId]?.origen && !plans.find((p) => p.id === planId)?.origen;
    if (necesitaOrigen) {
      setCalData((prev) => ({
        ...prev,
        [planId]: {
          origen: null,
          scaleM: globalCal!.scaleM,
          factorX: globalCal!.factorX,
          factorY: globalCal!.factorY,
          calGlobal: null,
          definedScale: globalCal!.definedScale,
        },
      }));
    }
    updatePlan(planId, { nivel });
    setNivelPickerPlanId(null);
    if (necesitaOrigen) {
      // Modal explicativo primero ("esta lámina necesita SU propio origen"); al confirmar se
      // abre el configurador con el modo de marcado de origen ya activo.
      setOrigenModalPlanId(planId);
      return;
    }
    setSelectedPlanId(planId);
    setCalibrating(true);
  };

  // Confirma el modal de origen: abre el configurador directo en modo "marcar origen".
  const abrirConfiguradorOrigen = (planId: number) => {
    setOrigenModalPlanId(null);
    setAutoOrigen(true);
    setSelectedPlanId(planId);
    setCalibrating(true);
  };

  const handleSaveConfig = (config: CalibrationData & { planId: number }) => {
    // Frame ANTERIOR del plan (meta/doc): el saneador lo necesita ANTES de estampar el nuevo.
    const prevOrigen = origenDePlan(String(config.planId));
    setCalData((prev) => ({ ...prev, [config.planId]: config }));
    const win = window as unknown as { _planosConfig?: Record<string, unknown> };
    if (!win._planosConfig) win._planosConfig = {};
    const key = `${selectedPlan?.name || 'plan'}_${config.planId}`;
    win._planosConfig[key] = {
      nombre: selectedPlan?.name || '',
      origen: config.origen,
      scaleM: config.scaleM,
      factorX: config.factorX,
      factorY: config.factorY,
      calGlobal: config.calGlobal,
      fecha: new Date().toLocaleString('es-CO'),
    };
    updatePlan(config.planId, {
      // Escala EXACTA en el meta (×100, sin redondear): el meta alimenta escalaGlobalRef
      // (PdfViewer) y la siembra de calData — redondearlo a entero (0.4723 → 47 → 0.47) hacía
      // que escalaGlobal ≠ scaleM del doc y el re-base de carga RE-ESCALABA la geometría en
      // cada primera reapertura (cotas desplazadas/dañadas, incidente 2026-09-22).
      scale: config.scaleM ? config.scaleM * 100 : 100,
      origen: config.origen,
      factorX: config.factorX,
      factorY: config.factorY,
      // Alcance ya no se pregunta en PlanoConfigurator (step 5 eliminado) — toda calibración se
      // guarda como "global" para que `globalCal` + "Usar calibración previa" (PlanosTab:289-298)
      // sigan funcionando y la escala se propague a planes nuevos automáticamente.
      calGlobal: true,
      definedScale: config.definedScale,
    });

    try {
      const trazosKey = TRAZOS_PREFIX + config.planId;
      // Caché ausente: la BD puede tener trazos reales del piso (otro equipo / caché limpiada
      // al reabrir el proyecto). Fabricar un doc solo-config dejaba la clave no-null para
      // siempre — el prefetch no la rellena y el árbitro la hacía ganar por ts → piso vacío.
      // Se baja el doc de BD primero y se le montan los campos de calibración.
      const fill = (doc: Record<string, unknown>) => {
        // Mutación pura del doc (stamp + re-base anclado) — vive en planosTabCalibracion.
        stampCalibracion(
          {
            ...config,
            scaleM: config.scaleM ?? 0,
            factorX: config.factorX ?? 0,
            factorY: config.factorY ?? 0,
            definedScale: config.definedScale ?? 0,
          },
          doc,
        );
        saveToStorage(trazosKey, doc);
        saveTrazosToDB(String(config.planId), doc).catch((e) => {
          devError('saveTrazosToDB error:', e);
        });
      };
      const local = loadFromStorage<Record<string, unknown> | null>(trazosKey, null);
      if (local) {
        fill(local);
      } else {
        loadTrazosFromDB(String(config.planId))
          // Sin doc en BD TAMPOCO: no fabricar doc solo-config — la clave quedaría no-null
          // para siempre y bloquearía el relleno del prefetch (mismo hazard del comentario
          // de arriba). La calibración vive en el meta; el doc nace con el primer trazo.
          .then((db) => {
            if (db) fill(db as unknown as Record<string, unknown>);
          })
          .catch((e) => devError('Error syncing calibration to Supabase:', e));
      }
      // Origen cambió: trasladar anillos/LDs/ghosts de las asociaciones que cruzan este plan
      // (traslación pura por Δ; no-op en la primera calibración).
      sanearAsociacionesTrasRecalibrar(config.planId, prevOrigen);
    } catch (e) {
      devError('Error syncing calibration to Supabase:', e);
    }
  };

  const handleIrADibujo = () => {
    if (!selectedPlan) return;
    const idx = plans.findIndex((p) => p.id === selectedPlan.id);
    if (idx >= 0) {
      try {
        localStorage.setItem(VISOR_ACTIVE_INDEX_KEY, String(idx));
        localStorage.setItem(VISOR_ACTIVE_PLAN_ID_KEY, String(selectedPlan.id));
      } catch {
        // ignorar
      }
    }
    navigate('/visor');
  };

  // Modo calibración: PlanoConfigurator a ancho completo con botón volver
  if (calibrating && selectedPlan) {
    const cal = calData[selectedPlan.id];
    const calDone = cal && cal.origen && cal.scaleM;
    return (
      <div
        className="fu"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCalibrating(false);
            }}
            style={PlanosTab_S1}
          >
            ← VOLVER A CARGA DE PLANOS
          </button>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedPlan.name}</span>
          {calDone && (
            <span style={{ fontSize: 12, color: 'var(--ok)', marginLeft: 4 }}>✓ Calibrado</span>
          )}
          <div style={{ flex: 1 }} />
          {selectedPlan.nivel !== null && calDone && (
            <button
              type="button"
              onClick={() => {
                if (
                  plans.some(
                    (x) =>
                      x.id !== selectedPlan.id &&
                      x.status === 'confirmed' &&
                      x.nivel === selectedPlan.nivel,
                  )
                ) {
                  alert('Este nivel ya tiene un plano asociado.');
                  return;
                }
                confirmPlan(selectedPlan.id);
                setCalibrating(false);
              }}
              style={PlanosTab_S2}
            >
              ✓ CONFIRMAR PLANO
            </button>
          )}
          {(!calDone || selectedPlan.nivel === null || selectedPlan.nivel === undefined) && (
            <span style={{ fontSize: 12, color: 'var(--txt4)', whiteSpace: 'nowrap' }}>
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
          autoOrigen={autoOrigen}
          pisos={pisos}
          plans={plans}
          planNivel={selectedPlan.nivel ?? null}
          onUpdateNivel={(pid, nivel) => updatePlan(pid, { nivel })}
          esPrimeraCalibracion={!Object.values(calData).some((cd) => cd && cd.origen && cd.scaleM)}
        />
      </div>
    );
  }

  return (
    <div
      className="fu"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        padding: 0,
      }}
    >
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
        {selectedPlan && selectedPlanUrl && (
          <PlanCropPanel selectedPlanUrl={selectedPlanUrl} planFile={selectedPlan.file} />
        )}
      </div>
      {showProtocolo && <ModalProtocolo onClose={() => setShowProtocolo(false)} />}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setPlanDrag(true);
        }}
        onDragLeave={() => setPlanDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setPlanDrag(false);
          const fl = e.dataTransfer?.files;
          if (fl && fl.length > 0) addPlans(fl);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) addPlans(e.target.files);
            e.target.value = '';
          }}
        />

        <div style={PlanosTab_S3}>
          {selectedPlan ? (
            <>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedPlan.name}
              </span>
              {selectedPlan.nivel !== null && (
                <span
                  style={{
                    fontSize: 12,
                    padding: '1px 6px',
                    background: 'var(--bg3)',
                    borderRadius: 'var(--r)',
                    color: 'var(--txt3)',
                    flexShrink: 0,
                  }}
                >
                  {pisoLbl(selectedPlan.nivel)}
                </span>
              )}
              {isCalibrated(selectedPlan.id) && (
                <span style={{ fontSize: 12, color: 'var(--ok)', flexShrink: 0 }}>✓</span>
              )}
              <div style={{ flex: 1 }} />
              {selectedPlan.status === 'confirmed' && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = plans.findIndex((p) => p.id === selectedPlanId);
                    if (idx >= 0) {
                      try {
                        localStorage.setItem(VISOR_ACTIVE_INDEX_KEY, String(idx));
                        localStorage.setItem(VISOR_ACTIVE_PLAN_ID_KEY, String(selectedPlanId));
                      } catch {
                        // ignorar
                      }
                    }
                    navigate('/visor');
                  }}
                  style={PlanosTab_S4}
                >
                  DIBUJAR REDES EN ESTE PLANO &rarr;
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Vista previa del plano</span>
          )}
        </div>

        {selectedPlan && selectedPlanUrl ? (
          <div style={{ flex: 1, background: '#141416', position: 'relative' }}>
            {planDrag && (
              <div style={PlanosTab_S5}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>
                  &#x1F4D0; SOLTAR PARA SUBIR
                </span>
              </div>
            )}
            <embed
              key={selectedPlanUrl}
              src={`${selectedPlanUrl}#toolbar=0`}
              type="application/pdf"
              title="Plano seleccionado"
              aria-label="Plano seleccionado"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        ) : (
          <button
            type="button"
            style={PlanosTab_S6}
            aria-label="Seleccionar archivo de plano"
            onClick={() => fileRef.current?.click()}
          >
            {planDrag ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,220,229,.08)',
                  border: '3px dashed rgba(0,220,229,.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>
                  &#x1F4D0; SOLTAR PARA SUBIR
                </span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, opacity: 0.25 }}>&#x1F4D0;</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>
                  Vista previa del plano
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--txt4)',
                    textAlign: 'center',
                    maxWidth: 260,
                    lineHeight: 1.5,
                  }}
                >
                  Sube un plano desde el panel derecho o arrastra un PDF aquí
                </div>
              </>
            )}
          </button>
        )}
      </div>

      <div
        style={{
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--line)',
          background: 'var(--bg)',
        }}
      >
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={PlanosTab_S7}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,220,229,0.12)';
              e.currentTarget.style.borderColor = 'rgba(0,220,229,0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,220,229,0.06)';
              e.currentTarget.style.borderColor = 'rgba(0,220,229,0.3)';
            }}
          >
            <img
              src="/iconos_civilflow/carga_planos/subir_plano.webp"
              alt="Subir plano"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            SUBIR PLANO
          </button>
        </div>

        <div
          style={{
            flex: '1 1 50%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderBottom: '1px solid var(--line)',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setPlanDrag(true);
          }}
          onDragLeave={() => setPlanDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setPlanDrag(false);
            const fl = e.dataTransfer?.files;
            if (fl && fl.length > 0) addPlans(fl);
          }}
        >
          <div style={PlanosTab_S8}>
            <img
              src="/iconos_civilflow/carga_planos/pendientes.webp"
              alt="Pendientes"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle' }}
              loading="lazy"
            />
            Pendientes {pendingPlanos.length > 0 && `(${pendingPlanos.length})`}
          </div>
          {pendingPlanos.length === 0 ? (
            <button
              type="button"
              style={PlanosTab_S9}
              aria-label="Subir planos"
              onClick={() => fileRef.current?.click()}
            >
              {planDrag ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#00dce5' }}>
                  &#x1F4D0; SOLTAR PARA SUBIR
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 24, opacity: 0.3 }}>&#x1F4D0;</div>
                  <span>Arrastra PDFs aquí o haz clic para subir varios planos</span>
                </>
              )}
            </button>
          ) : (
            <ul style={PlanosTab_S10}>
              {pendingPlanos.map((p) => {
                const calOk = isCalibrated(p.id);
                const isSelected = selectedPlanId === p.id;
                return (
                  <li
                    key={p.id}
                    style={{
                      ...PlanosTab_pendingLi,
                      border: isSelected
                        ? '1px solid rgba(0, 220, 229, 0.35)'
                        : '1px solid var(--line)',
                      background: isSelected ? 'rgba(0, 220, 229, 0.03)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--txt)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </span>
                      {p.nivel !== null && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '1px 5px',
                            background: 'var(--bg3)',
                            borderRadius: 'var(--r)',
                            color: 'var(--txt3)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {pisoLbl(p.nivel)}
                        </span>
                      )}
                    </div>

                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {calOk ? (
                          <span
                            style={{
                              color: 'var(--ok)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ fontSize: 12 }}>●</span> Calibrado
                            </span>
                            {p.definedScale ? (
                              <span style={{ color: 'var(--txt3)' }}>
                                Diseño 1:{Math.round(p.definedScale * 100)}
                              </span>
                            ) : null}
                            <span style={{ color: 'var(--txt2)' }}>
                              | Calibrada 1:{Math.round((p.scale / 100) * 100)}
                            </span>
                          </span>
                        ) : (
                          <span
                            style={{
                              color: '#F5A623',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <span style={{ fontSize: 12 }}>●</span> Sin calibrar
                          </span>
                        )}
                      </div>

                      {calOk && p.nivel !== null && p.nivel !== undefined && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              plans.some(
                                (x) =>
                                  x.id !== p.id && x.status === 'confirmed' && x.nivel === p.nivel,
                              )
                            ) {
                              alert('Este nivel ya tiene un plano asociado.');
                              return;
                            }
                            confirmPlan(p.id);
                          }}
                          style={PlanosTab_S11}
                        >
                          CONFIRMAR
                        </button>
                      )}
                    </div>

                    <div
                      style={{ display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          setCalibrating(false);
                        }}
                        style={{
                          ...PlanosTab_verBtn,
                          background:
                            isSelected && !calibrating ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)',
                          color: isSelected && !calibrating ? '#00dce5' : 'var(--txt2)',
                        }}
                        title="Vista previa"
                      >
                        VER
                      </button>

                      {globalCal ? (
                        <button
                          type="button"
                          onClick={() => setNivelPickerPlanId(p.id)}
                          style={{
                            ...PlanosTab_verBtn,
                            background: 'rgba(14,204,122,0.1)',
                            color: '#0ECC7A',
                            borderColor: 'rgba(14,204,122,0.3)',
                          }}
                          title="Asignar piso al plano"
                        >
                          ASIGNAR PISO
                        </button>
                      ) : (
                        // 1b: sin calibración global todavía, el primer plano debe calibrarse
                        // antes que nada: se ofrece CALIBRAR directo en la fila.
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(p.id);
                            setAutoOrigen(false);
                            setCalibrating(true);
                          }}
                          style={{
                            ...PlanosTab_verBtn,
                            background: 'rgba(0,220,229,0.08)',
                            color: '#00dce5',
                            borderColor: 'rgba(0,220,229,0.3)',
                          }}
                          title="Calibrar el plano (primera calibración del proyecto)"
                        >
                          CALIBRAR
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          removePlan(p.id);
                          if (selectedPlanId === p.id) {
                            setSelectedPlanId(null);
                          }
                        }}
                        style={PlanosTab_S12}
                        title="Eliminar plano"
                      >
                        ELIMINAR
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            flex: '1 1 50%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={PlanosTab_S13}>
            <img
              src="/iconos_civilflow/carga_planos/cargados.webp"
              alt="Cargados"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle' }}
              loading="lazy"
            />
            Cargados {confirmedPlanos.length > 0 && `(${confirmedPlanos.length})`}
          </div>
          {confirmedPlanos.length === 0 ? (
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'var(--txt3)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{'\u{1F4CB}'}</div>
                Aún no hay planos cargados
              </div>
            </div>
          ) : (
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
              {confirmedPlanos.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--line)',
                    background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent',
                    transition: 'background .1s',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--txt3)',
                        display: 'flex',
                        gap: 5,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      {p.nivel !== null && <span>{pisoLbl(p.nivel)}</span>}
                      {p.origen && origenesCompartidos.has(`${p.origen.x_px}|${p.origen.y_px}`) && (
                        <span
                          style={{ color: '#F5A623', fontSize: 11, fontWeight: 600 }}
                          title="Esta lámina comparte el origen px con otra: si las hojas no están exactamente alineadas, re-marque el origen (CALIBRAR) en el mismo punto físico del AutoCAD para que copias e isometría queden verticales entre pisos."
                        >
                          ⚠ Origen compartido
                        </span>
                      )}
                      {p.scale ? (
                        <>
                          <span style={{ color: 'var(--line)' }}>|</span>
                          {p.definedScale ? (
                            <span>Diseño 1:{Math.round(p.definedScale * 100)}</span>
                          ) : null}
                          {p.definedScale ? <span style={{ color: 'var(--line)' }}>|</span> : null}
                          <span style={{ color: 'var(--txt2)' }}>
                            Calibrada 1:{Math.round(p.scale)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(p.id);
                      setAutoOrigen(false);
                      setCalibrating(true);
                    }}
                    style={{ ...PlanosTab_verBtn, flexShrink: 0 }}
                    title="Re-marcar origen / recalibrar esta lámina"
                  >
                    CALIBRAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    style={{
                      ...PlanosTab_verBtn,
                      background:
                        selectedPlanId === p.id ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)',
                      color: selectedPlanId === p.id ? '#00dce5' : 'var(--txt2)',
                      flexShrink: 0,
                    }}
                    title="Vista previa"
                  >
                    VER
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlan(p.id)}
                    style={PlanosTab_S14}
                    title="Eliminar"
                  >
                    ELIMINAR
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {nivelPickerPlanId !== null && (
        // Backdrop con cierre por click-fuera: patrón estándar de modal.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setNivelPickerPlanId(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              padding: 16,
              minWidth: 220,
              maxWidth: 300,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--txt)' }}>
              Asignar piso al plano
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pisos
                .filter(
                  (s) =>
                    !plans.some(
                      (x) =>
                        x.id !== nivelPickerPlanId && x.status === 'confirmed' && x.nivel === s.n,
                    ),
                )
                .map((s) => (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => handleAsignarPiso(nivelPickerPlanId, s.n)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      background: 'var(--bg3)',
                      color: 'var(--txt)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(14,204,122,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg3)';
                    }}
                  >
                    {pisoLbl(s.n)}
                  </button>
                ))}
              {pisos.filter(
                (s) =>
                  !plans.some(
                    (x) =>
                      x.id !== nivelPickerPlanId && x.status === 'confirmed' && x.nivel === s.n,
                  ),
              ).length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--txt4)',
                    padding: '8px 0',
                    textAlign: 'center',
                  }}
                >
                  Todos los pisos ya tienen un plano asociado
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNivelPickerPlanId(null)}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '5px 0',
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--txt3)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {origenModalPlanId !== null && (
        // Modal de flujo: "esta lámina necesita SU propio origen". Al confirmar, el
        // configurador abre directo en modo marcado de origen (autoOrigen).
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setOrigenModalPlanId(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            role="dialog"
            aria-label="Definir origen de la lámina"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              padding: 16,
              minWidth: 260,
              maxWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--txt)' }}>
              📍 Define el origen de este plano
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>
              Piso asignado a <b>{plans.find((p) => p.id === origenModalPlanId)?.name}</b>. La
              escala del proyecto ya está aplicada, pero a cada plano se le debe definir su propio
              origen.
            </div>
            <button
              type="button"
              onClick={() => abrirConfiguradorOrigen(origenModalPlanId)}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '7px 0',
                borderRadius: 'var(--r)',
                border: '1px solid rgba(14,204,122,0.3)',
                background: 'rgba(14,204,122,0.1)',
                color: '#0ECC7A',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              📍 Marcar origen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default React.memo(PlanosTab);
