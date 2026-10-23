import { devError } from '../../utils/devError.ts';
import type { Piso } from '../../modules/civilflow/lib/shared/projectTypes.ts';
import type { PlanMeta } from '../../modules/civilflow/lib/shared/projectTypes.ts';
import { PROY_DEFAULTS, type Proyecto } from '../../modules/civilflow/context/ProjectContext.tsx';
import { loadProyectoDataConError } from '../../modules/civilflow/services/projectDataService.ts';
import { downloadPlanPDF } from '../../modules/civilflow/services/pdfStorageService.ts';
import { storePDF, clearAllPDFs } from '../../modules/civilflow/services/idbStorage.ts';
import { clearLocalWorkspace } from '../../modules/civilflow/services/workspaceReset.ts';
import { saveToStorage } from '../../modules/civilflow/services/storageService.ts';
import {
  ACTIVE_PROYECTO_ID_KEY,
  ACTIVE_NETS_KEY,
  PLANS_META_KEY,
} from '../../modules/civilflow/constants/storage-keys.ts';
import type { ProyectoRow } from '../../modules/civilflow/services/projectsService.ts';

interface AbrirProyectoCfArgs {
  proy: ProyectoRow;
  projectCtx: { pauseCloudSync(): void; resumeCloudSync(): void; resetToDefaults(): void } | null;
  plansCtx: { pauseCloudSync(): void; resumeCloudSync(): void; resetPlans(): void } | null;
  navigate: (to: string) => void;
  onError: (msg: string) => void;
}

/** Traspaso del workspace local al proyecto CF elegido: carga PRIMERO (un fallo de red/RLS
 *  no borra lo que hay en pantalla ni navega a un área vacía), luego reset + hand-off por
 *  localStorage y navegación inmediata; los PDFs bajan en paralelo en background.
 *  Devuelve true si se navegó al workarea. */
export async function abrirProyectoCf({
  proy,
  projectCtx,
  plansCtx,
  navigate,
  onError,
}: AbrirProyectoCfArgs): Promise<boolean> {
  try {
    // Local workspace always starts blank before loading the selected project —
    // clearing localStorage alone doesn't touch state already sitting in the context
    // providers (they wrap the whole app and don't remount on navigation).
    // Pause the debounced cloud-save effects before resetting — otherwise the reset's
    // transient empty state gets written to Supabase (wiping the project) before the
    // manual restore below has a chance to run, since it's separated from the reset by
    // an await and therefore lands in its own render commit.
    projectCtx?.pauseCloudSync();
    plansCtx?.pauseCloudSync();

    // 1) CARGAR PRIMERO. Si la carga falla (sin red, RLS, suscripción vencida), NO se
    // borra el workspace anterior y NO se navega: entrar al workarea con un proyecto
    // VACÍO hacía que el usuario redibujara encima de un trabajo que sí estaba en la nube.
    const { data, error: errorCarga } = await loadProyectoDataConError(proy.id);
    if (errorCarga) {
      devError('Error abriendo proyecto:', errorCarga);
      onError('No se pudo cargar el proyecto. Revisa tu conexión o tu suscripción.');
      return false;
    }

    // 2) Ahora sí: workspace en blanco y traspaso por localStorage.
    clearLocalWorkspace();
    await clearAllPDFs();
    plansCtx?.resetPlans();
    projectCtx?.resetToDefaults();
    localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, proy.id);

    // The context setters below (setPisos/setProyAll/setMats/.../restorePlans) are no-ops
    // on this route — CivilFlowProviders only wraps /civilflowareatrabajo, so projectCtx and
    // plansCtx are both null here. The real hand-off to the work area is via localStorage:
    // ProyectoProvider/PisosProvider/etc each read their own key on mount via
    // usePersistedState, which internally prefixes the key AGAIN (usePersistedState is
    // already called with the prefixed 'civilflow_proy'/'civilflow_pisos'/etc), so the actual
    // storage key is the DOUBLED civilflow_civilflow_proy — must go through saveToStorage
    // (which applies that same second prefix), never a raw localStorage.setItem, or the
    // write lands on a key nobody reads.
    if (data) {
      if (data.pisos) saveToStorage('civilflow_pisos', data.pisos as Piso[]);
      const proyToSave =
        data.proy && Object.keys(data.proy).length
          ? { ...PROY_DEFAULTS, ...(data.proy as Partial<Proyecto>) }
          : { ...PROY_DEFAULTS, nombre: proy.nombre };
      saveToStorage('civilflow_proy', proyToSave);
      if (data.mats && Object.keys(data.mats).length) saveToStorage('civilflow_mats', data.mats);
      if (data.profs && data.profs.length) saveToStorage('civilflow_profs', data.profs);
      if (data.crits && data.crits.length) saveToStorage('civilflow_crits', data.crits);
      if (data.redesActivas && data.redesActivas.length)
        saveToStorage(ACTIVE_NETS_KEY, data.redesActivas);
    } else {
      // No saved data yet for this project (created before this feature, or never
      // touched) — at least show the right name instead of the reset default.
      saveToStorage('civilflow_proy', { ...PROY_DEFAULTS, nombre: proy.nombre });
    }

    const plansMeta = (data?.plans_meta as PlanMeta[]) || [];
    // Carga silenciosa (orig. usuario): guardar la metadata de planos INMEDIATAMENTE y navegar
    // sin esperar los PDFs — cada PDF se descarga EN PARALELO en background y se cachea en
    // IndexedDB. Al montar, PlansContext lee la metadata de localStorage y carga los PDFs
    // faltantes lazy por piso.
    if (plansMeta.length > 0) saveToStorage(PLANS_META_KEY, plansMeta);

    // Deep-link tipo CM por slug uuid (fallback numérico si la migración aún no corre).
    navigate(`/civilflowareatrabajo/${proy.id}`);

    void (async () => {
      const resolved = await Promise.all(
        plansMeta.map(async (m) => {
          const file = await downloadPlanPDF(proy.id, m.id, m.name || `plano_${m.id}.pdf`);
          if (file) await storePDF(m.id, file);
          return m;
        }),
      );
      if (resolved.length > 0) saveToStorage(PLANS_META_KEY, resolved);
    })();
    return true;
  } catch (err) {
    devError('Error abriendo proyecto:', err);
    return false;
  } finally {
    projectCtx?.resumeCloudSync();
    plansCtx?.resumeCloudSync();
  }
}
