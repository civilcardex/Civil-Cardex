/**
 * Columna central de la pestaña "Planos": barra de vista previa con acciones, visor embebido del
 * PDF seleccionado y zona de carga (drag & drop de PDFs + input de archivo oculto).
 * Ej: arrastrar "Piso 3.pdf" al centro lo agrega como plano pendiente y muestra "SOLTAR PARA SUBIR".
 */
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { pisoLbl } from '../../../constants';
import { getActiveProyectoId } from '../../../services/storageService.ts';
import { VISOR_ACTIVE_INDEX_KEY, VISOR_ACTIVE_PLAN_ID_KEY } from '../../../constants/storage-keys.ts';
import { PlanosTab_S3, PlanosTab_S4, PlanosTab_S5, PlanosTab_S6 } from '../PlansTab.styles.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';

export interface PlansUploadProps {
  /** Plano seleccionado (null = estado vacío con la gran zona clicable de subida). */
  selectedPlan: PlanItem | null;
  /** URL de vista previa del PDF (null = sin plano cargado aún). */
  selectedPlanUrl: string | null;
  /** id del plano seleccionado: el botón "DIBUJAR REDES" guarda esta referencia en storage. */
  selectedPlanId: number | null;
  /** Planos vivos: da el índice del plano seleccionado para el visor de dibujo. */
  plans: PlanItem[];
  /** true mientras un PDF se arrastra sobre la zona (overlay "SOLTAR PARA SUBIR"). */
  planDrag: boolean;
  /** Enciende/apaga el estado de arrastre del padre (compartido con la lista de pendientes). */
  setPlanDrag: Dispatch<SetStateAction<boolean>>;
  /** Agrega los PDFs soltados o elegidos como planos pendientes. */
  addPlans: (newFiles: FileList | File[]) => PlanItem[];
  /** Ref al input de archivo oculto: lo comparte con el botón "SUBIR PLANO" del panel derecho. */
  fileRef: RefObject<HTMLInputElement | null>;
  /** ¿El plano seleccionado ya tiene origen y escala calibrados? (badge ✓ en la barra). */
  isCalibrated: (planId: number) => boolean | number | null | undefined;
}

/** Columna central: vista previa del plano seleccionado + zona de carga drag & drop. */
export function PlansUpload({
  selectedPlan,
  selectedPlanUrl,
  selectedPlanId,
  plans,
  planDrag,
  setPlanDrag,
  addPlans,
  fileRef,
  isCalibrated,
}: PlansUploadProps) {
  const navigate = useNavigate();
  return (
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
  );
}
