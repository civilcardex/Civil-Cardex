/** Campos de la sub-pestaña TUBERÍA y mangueras: límites de velocidad, presión de trabajo y
 *  cómo se alimenta el caudal de mangueras. Ej: mang.duracion muestra la duración según el
 *  riesgo (Tabla 19.2.3.1.1). */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { SINO } from '../../../utils/rci/RCIRowsModel.ts';

export const GRUPO_TUBERIA: DefCampo[] = [
  {
    path: 'tub.Vmax',
    lbl: 'Velocidad máxima',
    num: true,
    uni: 'm/s',
    ayu: 'NFPA 13 no fija límite; 6 m/s es práctica común',
  },
  {
    path: 'tub.Pcomp',
    lbl: 'Presión de trabajo de componentes',
    num: true,
    uni: 'psi',
    ayu: 'Componentes estándar: 175 psi',
  },
  {
    path: 'mang.mangBomba',
    lbl: '¿La bomba suministra el caudal de mangueras?',
    opts: SINO,
    ayu: (r) => `Sí: suma ${r.roc.hz.hose} gpm de mangueras al caudal de la bomba (NFPA 13)`,
  },
  {
    path: 'mang.mangTanque',
    lbl: '¿El agua de mangueras sale del tanque?',
    opts: SINO,
    ayu: 'Si es Sí, se suma al volumen del tanque',
  },
  {
    path: 'mang.duracion',
    lbl: 'Duración adoptada',
    num: true,
    uni: 'min',
    ayu: (r, e) =>
      r.roc.dmin === r.roc.dmax
        ? `${e.clas.riesgo}: ${r.roc.dmin} min (Tabla 19.2.3.1.1); más si la autoridad lo exige`
        : `${e.clas.riesgo}: ${r.roc.dmin} a ${r.roc.dmax} min (Tabla 19.2.3.1.1)`,
  },
];
