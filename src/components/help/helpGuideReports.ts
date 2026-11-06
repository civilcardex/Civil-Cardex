/**
 * Guía contextual — dominio INFORMES Y CRITERIOS: 'cf:inf' (memorias/informes) y 'cf:crit'
 * (criterios de diseño por norma). Contenido puro, lo consume helpGuideFlow.
 * Ej: 'cf:crit' explica cómo se leen los criterios de Hunter/Renouard.
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';

export const GUIA_REPORTS: GUIA_TYPE = {
  'cf:inf': [
    {
      titulo: 'Informes y descargas',
      items: [
        {
          nombre: 'Resumen del proyecto',
          desc: 'Ficha con nombre, dirección, uso y estado por red (✓ OK / ✗ Revisar) según las validaciones de diseño.',
        },
        {
          nombre: 'Memorias finales (Excel/Word/PDF)',
          desc: 'Memoria de cálculo completa por red: datos, tablas de diseño y verificaciones. Se desactiva mientras alguna red tenga errores.',
        },
        {
          nombre: 'Anexo — detalle de aparatos',
          desc: 'PDF fijo con el detalle de instalación de cada aparato hidrosanitario.',
        },
        {
          nombre: 'Planos de red',
          desc: 'PDF con los planos confirmados y sus redes dibujadas encima.',
        },
      ],
    },
  ],

  'cf:crit': [
    {
      titulo: 'Referencias normativas',
      items: [
        {
          nombre: 'Filtros (AF/AC, Sanitaria, Lluvias, Gas, RCI)',
          desc: 'Recortan las tarjetas de normas a la red de interés.',
        },
        {
          nombre: 'Tarjetas por norma',
          desc: 'Resumen práctico de NTC 1500, RAS 2000, NTC 3728, NSR-10 J, NFPA 13 y NTC 3096 con sus numerales clave.',
        },
      ],
    },
    {
      titulo: 'Criterios de diseño (tabla editable)',
      items: [
        {
          nombre: '+ Agregar / ✕',
          desc: 'Crea o elimina criterios propios del proyecto (parámetro, valor, unidad).',
        },
        {
          nombre: 'Norma / Artículo / Evidencia',
          desc: 'Documenta de dónde sale cada criterio y cómo se cumple — viaja con el proyecto a las memorias.',
        },
        {
          nombre: '↺ Restaurar',
          desc: 'Vuelve a los criterios por defecto de la app (CRIT0) borrando los personalizados.',
        },
      ],
    },
  ],

  // ── Isometría (sub-pestañas) ──
};
