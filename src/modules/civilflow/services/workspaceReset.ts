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

export function clearLocalWorkspace(): void {
  const lsKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('civilflow_')) continue;
    if (PREFIJOS_PREFERENCIAS.some((p) => k.startsWith(p))) continue;
    lsKeys.push(k);
  }
  for (const k of lsKeys) {
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
