/**
 * Pestaña "Planos" del área de trabajo: lista de pisos con su plano asignado (asignar PDF, calibrar escala, copiar el dibujo de otro piso, abrir el visor) y guardado de trazos a BD.
 * Ej: asignar el plano "Piso 2.pdf" al nivel 2 calibra scaleM (metros por pixel) y habilita dibujar esa red ahí.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { pisoOcupadoPor } from '../../utils/isLevelTaken';
import { useNavigate } from 'react-router-dom';
import {
  saveTrazosToDB,
  loadTrazosFromDB,
  loadFromStorage,
  saveToStorage,
  getActiveProyectoId,
} from '../../services/storageService.ts';
import {
  TRAZOS_PREFIX,
  VISOR_ACTIVE_PLAN_ID_KEY,
  VISOR_ACTIVE_INDEX_KEY,
} from '../../constants/storage-keys.ts';
import { REQ_ITEMS, pisoLbl } from '../../constants';

import { PlanoConfigurator } from './PlanoConfigurator.tsx';
import { origenDePlan } from '../../utils/crossFloorStorage.ts';
import { sanearAsociacionesTrasRecalibrar } from '../../utils/sanitizeAssociations';
import {
  PlanosTab_S1,
  PlanosTab_S2,
  PlanosTab_S3,
  PlanosTab_S4,
  PlanosTab_S5,
  PlanosTab_S6,
  PlanosTab_S7,
  PlanosTab_reqBtnBase,
} from './PlanosTab.styles.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import ModalProtocolo from './ModalProtocol';
import { PlanCropPanel } from './PlanCropPanel.tsx';
import { ModalNivelPiso, ModalOrigenPlan } from './planosTab/PlanModals.tsx';
import { ListaPendientes } from './planosTab/PendingPlansList.tsx';
import { ListaCargados } from './planosTab/LoadedPlansList.tsx';
import { devError } from '../../../../utils/devError.ts';
import type { CalibrationData } from './planosTabCalibration.ts';
import {
  calDataDePlan,
  seedCalData,
  computeGlobalCal,
  computeOrigenesCompartidos,
  stampCalibracion,
} from './planosTabCalibration.ts';

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

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
  // huérfano para que el modal de primera calibración reaparezca si se borran todos los planos.
  // TAMBIÉN SIEMBRA: el initializer de calData corre una sola vez y en un remount plans
  // suele llegar vacío (restauración async de PlansContext) — sin siembra, globalCal quedaba
  // null para siempre y "Asignar piso" desaparecía tras cerrar y reabrir (bug 2026-09-22).
  useEffect(() => {
    setCalData((prev) => {
      const { next, changed } = seedCalData(prev, plans);
      return changed ? next : prev;
    });
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
        // Mutación pura del doc (stamp + re-base anclado) — definido arriba en este archivo.
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
    const pid = getActiveProyectoId();
    navigate(pid ? `/dibujoRedes/${pid}` : '/dibujoRedes');
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
                  pisoOcupadoPor(
                    plans.filter((x) => x.status === 'confirmed'),
                    selectedPlan.nivel ?? 0,
                    selectedPlan.id,
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
      data-tour="cf-tab-planos"
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
                    const pid = getActiveProyectoId();
                    navigate(pid ? `/dibujoRedes/${pid}` : '/dibujoRedes');
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

        <ListaPendientes
          planos={pendingPlanos}
          selectedPlanId={selectedPlanId}
          isCalibrated={(id) => !!isCalibrated(id)}
          hayCalibracionGlobal={!!globalCal}
          arrastrando={planDrag}
          onSoltarArchivos={addPlans}
          onArrastrar={setPlanDrag}
          onSelect={(id) => {
            setSelectedPlanId(id);
            setCalibrating(false);
          }}
          onAsignarPiso={setNivelPickerPlanId}
          onCalibrar={(id) => {
            setSelectedPlanId(id);
            setAutoOrigen(false);
            setCalibrating(true);
          }}
          onConfirmar={(id) => {
            const nivel = plans.find((x) => x.id === id)?.nivel ?? null;
            if (
              nivel !== null &&
              plans.some((x) => x.id !== id && x.status === 'confirmed' && x.nivel === nivel)
            ) {
              alert('Este nivel ya tiene un plano asociado.');
              return;
            }
            confirmPlan(id);
          }}
          onEliminar={(id) => {
            removePlan(id);
            if (selectedPlanId === id) setSelectedPlanId(null);
          }}
          onAbrirArchivos={() => fileRef.current?.click()}
        />

        <ListaCargados
          planos={confirmedPlanos}
          selectedPlanId={selectedPlanId}
          origenesCompartidos={origenesCompartidos}
          onSelect={(id) => setSelectedPlanId(id)}
          onCalibrar={(id) => {
            setSelectedPlanId(id);
            setAutoOrigen(false);
            setCalibrating(true);
          }}
          onEliminar={(id) => removePlan(id)}
        />
      </div>

      <ModalNivelPiso
        plans={plans}
        pisos={pisos}
        planId={nivelPickerPlanId}
        onSelect={handleAsignarPiso}
        onClose={() => setNivelPickerPlanId(null)}
      />
      <ModalOrigenPlan
        planId={origenModalPlanId}
        planNombre={plans.find((p) => p.id === origenModalPlanId)?.name || ''}
        onConfirmar={abrirConfiguradorOrigen}
        onClose={() => setOrigenModalPlanId(null)}
      />
    </div>
  );
}
export default React.memo(PlanosTab);
