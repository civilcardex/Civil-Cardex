/** Textos fijos del encabezado de cada sub-pestaña ENTRADAS del RCI: la nota bajo el título
 *  y el icono del header (ruta pública). Ej: ICONO_SUB.tanque alimenta el header del grupo
 *  Tanque. Datos puros (sin React). */

/** Nota bajo el título de cada sub-pestaña (las que la traen en el HTML). */
export const NOTA_SUB: Record<string, string> = {
  normativa: 'No interviene en los cálculos',
  succion:
    'NPSH (Net Positive Suction Head): energía disponible en la succión para evitar cavitación',
  montantes: 'Clase y caudal se habilitan si el código exige gabinetes; el montante aplica siempre',
  siamesa: 'Se habilita si el código exige montantes; se supone conectada en la base del montante',
};

/** Icono del header de cada sub-pestaña (ruta pública). */
export const ICONO_SUB: Record<string, string> = {
  normativa: '/iconos/normativa_local.webp',
  clasificacion: '/iconos/clasificacion_riesgo.webp',
  montantes: '/iconos/montantes_nfpa14.webp',
  siamesa: '/iconos/siamesa.webp',
  seleccion: '/iconos/seleccion_bomba.webp',
  succion: '/iconos/succion_cavitacion.webp',
  jockey: '/iconos/bomba_jockey.webp',
  tanque: '/iconos/tanque.webp',
  tuberia: '/iconos/tuberia_mangueras.webp',
};
