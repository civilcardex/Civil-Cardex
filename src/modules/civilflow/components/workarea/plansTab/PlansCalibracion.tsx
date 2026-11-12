/**
 * Vista de calibración a ancho completo de la pestaña "Planos": barra superior (volver, confirmar
 * plano) + PlanoConfigurator para marcar origen y escala del plano seleccionado.
 * Ej: entrar con "Calibrar" en Piso 2.pdf -> marcar 2 puntos y el origen, y "✓ CONFIRMAR PLANO".
 */
import { pisoOcupadoPor } from '../../../utils/isLevelTaken.ts';
import { PlanoConfigurator } from '../PlanConfigurator.tsx';
import { PlanosTab_S1, PlanosTab_S2 } from '../PlansTab.styles.ts';
import type { Piso } from '../../../lib/shared/projectTypes.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import type { CalibrationData } from '../plansTabCalibration.ts';

export interface PlansCalibracionProps {
  /** Plano en calibración (el padre solo monta esta vista cuando hay uno seleccionado). */
  selectedPlan: PlanItem;
  /** Calibración viva del plano (entrada de calData); undefined si aún no tiene. */
  cal: CalibrationData | undefined;
  /** true si NINGÚN plano del proyecto está calibrado aún (el configurador muestra su modal guiado). */
  esPrimeraCalibracion: boolean;
  /** Abre el configurador directo en modo marcado de origen (viene del modal "define el origen"). */
  autoOrigen: boolean;
  /** Pisos del proyecto (el configurador deja reasignar el nivel del plano). */
  pisos: Piso[];
  /** Planos vivos: el check de piso ocupado y el propio configurador los necesitan. */
  plans: PlanItem[];
  /** Cierra la vista de calibración y vuelve a la carga de planos. */
  onVolver: () => void;
  /** Marca el plano como confirmado (acción del botón "✓ CONFIRMAR PLANO"). */
  confirmPlan: (id: number) => void;
  /** Guarda la calibración que entrega el configurador (estampa escala/origen en plan + trazos). */
  onSaveConfig: (config: CalibrationData & { planId: number }) => void;
  /** Salta al visor de dibujo con este plano activo (acción "IR A DIBUJO"). */
  onIrADibujo: () => void;
  /** Reasigna el nivel de un plano desde el propio configurador. */
  onUpdateNivel: (planId: number, nivel: number | null) => void;
}

/** Vista de calibración del plano seleccionado (el orquestador la muestra en lugar de la tabla). */
export function PlansCalibracion({
  selectedPlan,
  cal,
  esPrimeraCalibracion,
  autoOrigen,
  pisos,
  plans,
  onVolver,
  confirmPlan,
  onSaveConfig,
  onIrADibujo,
  onUpdateNivel,
}: PlansCalibracionProps) {
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
            onVolver();
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
              onVolver();
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
        onSaveConfig={onSaveConfig}
        onIrADibujo={onIrADibujo}
        existingCal={cal}
        autoOrigen={autoOrigen}
        pisos={pisos}
        plans={plans}
        planNivel={selectedPlan.nivel ?? null}
        onUpdateNivel={onUpdateNivel}
        esPrimeraCalibracion={esPrimeraCalibracion}
      />
    </div>
  );
}
