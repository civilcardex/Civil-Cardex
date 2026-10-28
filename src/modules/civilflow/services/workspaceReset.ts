// Preferencias de DISPOSITIVO que sobreviven al reset del workspace (orig. usuario: el
// estado de redes ocultas/bloqueadas de la barra del visor y la caché de colores por red
// se perdían al abrir/cambiar de proyecto — son ajustes del navegador, no datos del
// proyecto). El consentimiento de cookies ya vive fuera del namespace (cardex_cookie_consent).
const PREFIJOS_PREFERENCIAS = [
  'civilflow_pdf_hidden_nets',
  'civilflow_pdf_locked_nets',
  'civilflow_net_',
];

import { setActiveProyectoId } from './storage/localStorage.ts';
import { TRAZOS_PLAN_PREFIX } from '../constants/storage-keys.ts';
import { journalTrazos } from './storage/trazosJournal.ts';

export interface ClearLocalWorkspaceOptions {
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
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('civilflow_')) continue;
    if (PREFIJOS_PREFERENCIAS.some((p) => k.startsWith(p))) continue;
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
