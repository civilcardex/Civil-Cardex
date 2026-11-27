// Preferencias de DISPOSITIVO que sobreviven al reset del workspace (orig. usuario: el
// estado de redes ocultas/bloqueadas de la barra del visor y la caché de colores por red
// se perdían al abrir/cambiar de proyecto — son ajustes del navegador, no datos del
// proyecto). El consentimiento de cookies ya vive fuera del namespace (cardex_cookie_consent).
const PREFIJOS_PREFERENCIAS = [
  'civilflow_pdf_hidden_nets',
  'civilflow_pdf_locked_nets',
  'civilflow_net_',
];

/* Libros de CONTEOS de aparatos/accesorios (ped. usuario 2026-11-25: «al restaurar, todos
 *  los aparatos asignados se resetean»). La apertura del proyecto los borraba con TODO el
 *  workspace; la restauración dependía de que cada fila de BD llevara fixtures — si el
 *  último autosave de la sesión anterior salió antes de la inyección, la nube quedaba sin
 *  ellos y el libro vacío se volvió permanente. Se conservan SOLO cuando hay planos
 *  vigentes (reapertura del MISMO proyecto): las claves llevan planId, así que cambiar de
 *  proyecto sigue limpiando. */
const PREFIJOS_CONTEOS = [
  'civilflow_aparatos_by_tramo_v2',
  'civilflow_aparatos_heredados_v1',
  'civilflow_aparatos_heredados_trib_v1',
  'civilflow_bajadas_receptoras_v1',
  'civilflow_tramo_hidro_data_v3',
  'civilflow_gas_accesorios',
];

import { listRawKeys, setActiveProyectoId, getActiveProyectoId } from './storage/localStorage.ts';
import { TRAZOS_PLAN_PREFIX, ACTIVE_NETS_KEY, PLANS_META_KEY } from '../constants/storage-keys.ts';
import { journalTrazos } from './storage/strokesJournal.ts';
import { saveToStorage } from './storageService.ts';
import { loadProyectoData } from './projectDataService.ts';
import { clearAllPDFs } from './idbStorage.ts';
import { PROY_DEFAULTS, type Proyecto } from '../context/ProjectContext.tsx';
import type { Piso, PlanMeta } from '../lib/shared/projectTypes.ts';
import { marcarNavInterna } from '../../../utils/internalNavigation.ts';
import { devError } from '../../../utils/devError.ts';

export interface ClearLocalWorkspaceOptions {
  /** Los borradores de rescate están aislados por usuario y plano; se conservan al navegar. */
  conservarRescates?: boolean;
  /** Ids de plano del proyecto que se está ABRIENDO. Sus copias locales de trazos
   *  (`civilflow_trazos_<planoId>`) se conservan; las de cualquier otro plano se borran igual
   *  que el resto del workspace — la propagación enumera TODAS las claves de trazos del
   *  navegador, así que una copia de otro proyecto se colaría en los conteos.
   *  Es el respaldo de un piso cuyo guardado en la nube falló (orig. usuario: los elementos de
   *  la cubierta desaparecían al cerrar la pestaña y reabrir el proyecto: la apertura borraba
   *  la caché local y la BD tenía una copia vacía).
   *  El logout y el borrado de proyecto NO pasan ids: borran todo (equipo compartido / datos
   *  borrados a propósito). */
  planosVigentes?: ReadonlyArray<string | number>;
}

/** Deja el workspace local en blanco (proyecto, pisos, planos, conteos…). */
export function clearLocalWorkspace(opts: ClearLocalWorkspaceOptions = {}): void {
  const vigentes = opts.planosVigentes ? new Set(opts.planosVigentes.map(String)) : null;
  const lsKeys: string[] = [];
  for (const k of listRawKeys('civilflow_')) {
    if (PREFIJOS_PREFERENCIAS.some((p) => k.startsWith(p))) continue;
    if (opts.conservarRescates && k.startsWith('civilflow_plano_borrador_rescate_')) continue;
    if (vigentes && PREFIJOS_CONTEOS.some((p) => k.startsWith(p))) continue;
    if (vigentes && k.startsWith(TRAZOS_PLAN_PREFIX)) {
      const pid = k.slice(TRAZOS_PLAN_PREFIX.length);
      if (vigentes.has(pid)) {
        // Caja negra: deja constancia de qué dibujos SOBREVIVIERON al reset (y de su ts).
        journalTrazos('wipe', pid, undefined, 'conservado');
        continue;
      }
    }
    lsKeys.push(k);
  }
  for (const k of lsKeys) {
    if (k.startsWith(TRAZOS_PLAN_PREFIX)) {
      journalTrazos('wipe', k.slice(TRAZOS_PLAN_PREFIX.length), undefined, 'borrado');
    }
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  // La clave ACTIVE_PROYECTO_ID_KEY murió arriba: la sesión en memoria no debe quedar
  // apuntando a un proyecto cuyo workspace acaba de borrarse.
  setActiveProyectoId(null);
}

/** Datos crudos que loadProyectoData entrega para volcar al storage de hand-off. */
export interface ProyectoVolcado {
  plans_meta?: PlanMeta[] | null;
  pisos?: Piso[] | null;
  proy?: Partial<Proyecto> | null;
  mats?: Record<string, unknown> | null;
  profs?: unknown[] | null;
  crits?: unknown[] | null;
  redesActivas?: string[] | null;
}

/**
 * Secuencia destructiva compartida de "abrir proyecto desde URL/id" (visor y workarea):
 * pausa el sync de nube, DESTRUYE el workspace local, vuelca el proyecto entrante al storage
 * y recarga la página (los providers re-nacen leyendo el storage). En fallo hace rollback
 * del puntero activo y recarga al proyecto previo o al perfil. Ej: /dibujoRedes/<otro-id>
 * dispara esto para intercambiar de proyecto sin arrastrar datos del anterior.
 */
export async function abrirProyectoDesdeUrl(opts: {
  wantsId: number | string;
  /** Pausa el sync en nube de ambos providers (plans+proyecto) — sin pausa, los resets de
   *  abajo disparan los efectos debounced de guardado y vaciarían el proyecto en la nube. */
  pausar: () => void;
  /** resetPlans + resetToDefaults de los providers en memoria. */
  resetear: () => void;
  /** setActiveProyectoId del provider (puntero de proyecto activo). */
  activar: (id: number | string) => void;
  /** Ruta de recarga con el proyecto nuevo; en fallo se recarga `rutaBase` (o /perfil). */
  rutaConId: string;
  rutaBase: string;
}): Promise<void> {
  const { wantsId, pausar, resetear, activar, rutaConId, rutaBase } = opts;
  const idAnterior = getActiveProyectoId();
  try {
    pausar();
    // Cargar ANTES de destruir: si el proyecto no existe o no es accesible, el workspace
    // actual debe quedar intacto (el catch recarga al proyecto previo).
    const data = await loadProyectoData(String(wantsId));
    if (!data) throw new Error('proyecto-no-encontrado-o-sin-acceso');
    // Conserva las copias locales de trazos de ESTE proyecto (ver clearLocalWorkspace):
    // son el único respaldo de un piso cuyo guardado en la nube falló.
    clearLocalWorkspace({
      planosVigentes: (data.plans_meta ?? []).map((m) => m.id),
      conservarRescates: true,
    });
    await clearAllPDFs();
    resetear();
    activar(wantsId);
    // Escritura vía saveToStorage (aplica el 2º prefijo civilflow_ que leen los providers
    // al montar — mismo contrato de hand-off documentado en ProfilePage).
    if (data?.pisos) saveToStorage('civilflow_pisos', data.pisos as Piso[]);
    // Rename vive en cf_proyectos; la ficha general es el respaldo si esa fila está vacía.
    const nombreProyecto =
      String(data?.nombreProyecto ?? '').trim() || String(data?.proy?.nombre ?? '').trim();
    const proyToSave =
      data?.proy && Object.keys(data.proy).length
        ? ({
            ...PROY_DEFAULTS,
            ...(data.proy as Partial<Proyecto>),
            nombre: nombreProyecto || PROY_DEFAULTS.nombre,
          } as Proyecto)
        : ({ ...PROY_DEFAULTS, nombre: nombreProyecto } as Proyecto);
    saveToStorage('civilflow_proy', proyToSave);
    if (data?.mats && Object.keys(data.mats).length) saveToStorage('civilflow_mats', data.mats);
    if (data?.profs && data.profs.length) saveToStorage('civilflow_profs', data.profs);
    if (data?.crits && data.crits.length) saveToStorage('civilflow_crits', data.crits);
    if (data?.redesActivas && data.redesActivas.length)
      saveToStorage(ACTIVE_NETS_KEY, data.redesActivas);
    if (data?.plans_meta) saveToStorage(PLANS_META_KEY, data.plans_meta as PlanMeta[]);
    // Reload completo: providers re-nacen leyendo el storage recién volcado.
    marcarNavInterna();
    window.location.replace(rutaConId);
  } catch (e) {
    devError('abrir proyecto desde URL:', e);
    // Rollback: recarga completa — el workspace del proyecto previo ya no existe en memoria;
    // los providers se re-nacen con la recarga, un resume in situ dejaría workspace vacío.
    if (idAnterior) activar(idAnterior);
    marcarNavInterna();
    window.location.replace(idAnterior ? rutaBase : '/perfil');
  }
}
