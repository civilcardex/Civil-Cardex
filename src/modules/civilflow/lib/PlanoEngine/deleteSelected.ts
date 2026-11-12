/**
 * Borrado de la selección en el motor: elimina ramales/bajantes/canales/cotas/textos con TODAS sus consecuencias — enlaces entre pisos (punteros origen/descarga, fantasmas XFG), anillos de desplazamiento, renumeración y persistencia en storage.
 * Ej: borrar un LDesvio (ramal desvío entrepisos) individual limpia su puntero en el bajante origen y mata el anillo del piso de abajo.
 * El contenido vive en deleteSelected/ — pipeline orquesta y cada tipo de elemento tiene su módulo. Esta fachada mantiene la import `./deleteSelected.ts` de PlanoEngine.ts intacta.
 */
export { deleteSelected } from './deleteSelected/pipeline.ts';
