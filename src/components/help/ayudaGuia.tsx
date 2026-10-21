// Hub verbatim (Fase A4): re-exporta familia ayuda sin cambiar comportamiento.
// ponytail: split mecánico types/criterios/flow/manager; consumidores importan igual.
export type { GuiaItem, GuiaGrupo, GUIA_TYPE } from './ayudaGuiaTipos.tsx';
export { iconoDeGrupo } from './ayudaGuiaTipos.tsx';
export { CRITERIOS_3631 } from './ayudaGuiaCriterios.tsx';
export { GUIA_FLOW } from './ayudaGuiaFlujo.tsx';
export { GUIA_MANAGER } from './ayudaGuiaGestor.tsx';
import type { GUIA_TYPE } from './ayudaGuiaTipos.tsx';
import { GUIA_FLOW } from './ayudaGuiaFlujo.tsx';
import { GUIA_MANAGER } from './ayudaGuiaGestor.tsx';
export const GUIA: GUIA_TYPE = { ...GUIA_FLOW, ...GUIA_MANAGER };
