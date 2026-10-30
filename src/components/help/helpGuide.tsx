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
import { GUIA_RECORTE } from './helpGuideCrop.tsx';
/** Guía fusionada por clave de contexto: flow + manager + recorte (el editor de recorte publica su propia clave 'cf:recorte'). */
export const GUIA: GUIA_TYPE = {
  ...GUIA_FLOW,
  ...GUIA_MANAGER,
  // El editor de recorte publica su propio contexto (cf:recorte): su Ayuda muestra esta
  // misma sección colapsable, y el «REPETIR TOUR» del pie lanza el tour del recorte.
  'cf:recorte': [{ titulo: GUIA_RECORTE.titulo, items: GUIA_RECORTE.items }],
};
