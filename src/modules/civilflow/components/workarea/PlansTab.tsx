/**
 * Pestaña "Planos" del área de trabajo: lista de pisos con su plano asignado (asignar PDF, calibrar escala, copiar el dibujo de otro piso, abrir el visor) y guardado de trazos a BD.
 * Ej: asignar el plano "Piso 2.pdf" al nivel 2 calibra scaleM (metros por pixel) y habilita dibujar esa red ahí.
 * Orquestador: la calibración vive en plansTab/PlansCalibracion, los requisitos en plansTab/PlansRequirements
 * y la columna central (drag & drop + preview) en plansTab/PlansUpload.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
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

import { origenDePlan } from '../../utils/crossFloorStorage.ts';
import { sanearAsociacionesTrasRecalibrar } from '../../utils/sanitizeAssociations';
import { PlanosTab_S7 } from './PlansTab.styles.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';
import { ModalNivelPiso, ModalOrigenPlan } from './plansTab/PlanModals.tsx';
import { ListaPendientes } from './plansTab/PendingPlansList.tsx';
import { ListaCargados } from './plansTab/LoadedPlansList.tsx';
import { PlansCalibracion } from './plansTab/PlansCalibracion.tsx';
import { PlansRequirements } from './plansTab/PlansRequirements.tsx';
import { PlansUpload } from './plansTab/PlansUpload.tsx';
import { devError } from '../../../../utils/devError.ts';
import type { CalibrationData } from './plansTabCalibration.ts';
import {
  calDataDePlan,
  seedCalData,
  computeGlobalCal,
  computeOrigenesCompartidos,
  stampCalibracion,
} from './plansTabCalibration.ts';

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
  // Siembra intencional en efecto (no derivable en render: plans llega vacío en el remount
  // y se restaura async — el initializer de useState corrió una sola vez).
  useEffect(() => {
    // Siembra intencional en efecto (no derivable en render: plans llega vacío en el remount
    // y se restaura async — el initializer corrió una sola vez).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Modo calibración: PlansCalibracion a ancho completo con botón volver
  if (calibrating && selectedPlan) {
    return (
      <PlansCalibracion
        selectedPlan={selectedPlan}
        cal={calData[selectedPlan.id]}
        esPrimeraCalibracion={!Object.values(calData).some((cd) => cd && cd.origen && cd.scaleM)}
        autoOrigen={autoOrigen}
        pisos={pisos}
        plans={plans}
        onVolver={() => setCalibrating(false)}
        confirmPlan={confirmPlan}
        onSaveConfig={handleSaveConfig}
        onIrADibujo={handleIrADibujo}
        onUpdateNivel={(pid, nivel) => updatePlan(pid, { nivel })}
      />
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
      <PlansRequirements selectedPlan={selectedPlan} selectedPlanUrl={selectedPlanUrl} />

      <PlansUpload
        selectedPlan={selectedPlan}
        selectedPlanUrl={selectedPlanUrl}
        selectedPlanId={selectedPlanId}
        plans={plans}
        planDrag={planDrag}
        setPlanDrag={setPlanDrag}
        addPlans={addPlans}
        fileRef={fileRef}
        isCalibrated={isCalibrated}
      />

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
