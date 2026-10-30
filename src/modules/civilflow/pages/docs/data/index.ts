import hidraulica from './hydraulics.tsx';
import sanitarias from './sanitary.tsx';
import lluvias from './rainwater.tsx';
import agua_fria from './coldWater';
import agua_caliente from './hotWater';
import gas from './gas';
import equipos from './equipment.tsx';
import tablas from './tables.tsx';
import formulas from './formulas';
import manual from './manual';
import manager from './manager.tsx';
import normas_pais from './countryStandards';

/** Índice del contenido de la página /docs: cada clave es una categoría del menú (las secciones viven en cada archivo de data/). Ej: docData.gas trae las secciones de la red de gas. */
export const docData = {
  hidraulica,
  sanitarias,
  lluvias,
  agua_fria,
  agua_caliente,
  gas,
  equipos,
  tablas,
  formulas,
  manual,
  manager,
  normas_pais,
};
