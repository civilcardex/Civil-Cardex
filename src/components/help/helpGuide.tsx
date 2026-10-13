// Hub verbatim (Fase A4): re-exporta familia ayuda sin cambiar comportamiento.
// ponytail: split mecánico types/criterios/flow/manager; consumidores importan igual.
export type { GuiaItem, GuiaGrupo, GUIA_TYPE } from './helpGuideTypes';
export { iconoDeGrupo } from './helpGuideTypes';
export { CRITERIOS_3631 } from './helpGuideCriterios';
export { GUIA_FLOW } from './helpGuideFlow';
export { GUIA_MANAGER } from './helpGuideManager';
import type { GUIA_TYPE } from './helpGuideTypes';
import { GUIA_FLOW } from './helpGuideFlow';
import { GUIA_MANAGER } from './helpGuideManager';
export const GUIA: GUIA_TYPE = { ...GUIA_FLOW, ...GUIA_MANAGER };
