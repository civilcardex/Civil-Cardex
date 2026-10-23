// Hub verbatim (Fase A4): re-exporta familia ayuda sin cambiar comportamiento.
// ponytail: split mecánico types/criterios/flow/manager; consumidores importan igual.
export type { GuiaItem, GuiaGrupo, GUIA_TYPE } from './helpGuideTypes.tsx';
export { iconoDeGrupo } from './helpGuideTypes.tsx';
export { CRITERIOS_3631 } from './helpGuideCriteria.tsx';
export { GUIA_FLOW } from './helpGuideFlow.tsx';
export { GUIA_MANAGER } from './helpGuideManager.tsx';
import type { GUIA_TYPE } from './helpGuideTypes.tsx';
import { GUIA_FLOW } from './helpGuideFlow.tsx';
import { GUIA_MANAGER } from './helpGuideManager.tsx';
export const GUIA: GUIA_TYPE = { ...GUIA_FLOW, ...GUIA_MANAGER };
