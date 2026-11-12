/** Campos de la sub-pestaña CLASIFICACIÓN: riesgo NFPA, tipo de sistema, almacenamiento y
 *  construcción del techo — lo que decide el área de diseño. Ej: clas.almacen «Sí» bloquea
 *  el Riesgo leve. */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { HZ } from '../../../lib/rci/tables.ts';
import { CONSTR_OPCIONES, SINO } from '../../../utils/rci/RCIRowsModel.ts';

/** Clasificaciones de riesgo (las llaves de HZ, la tabla de densidades del motor). */
const RIESGOS: string[] = Object.keys(HZ);

/** Opciones de «Construcción del techo»: el select guarda el valor CORTO (la llave del motor,
 *  CONSTR_OPCIONES) y muestra la etiqueta LARGA del FORM del HTML. Ej: guarda 'Combustible
 *  obstruida' y muestra 'Combustible obstruida, elementos a ≥ 0,91 m'. */
const CONSTR_PARES: readonly (readonly [string, string])[] = [
  [CONSTR_OPCIONES[0], 'No combustible, o combustible sin obstrucción'],
  [CONSTR_OPCIONES[1], 'Combustible obstruida, elementos a ≥ 0,91 m'],
  [CONSTR_OPCIONES[2], 'Combustible, elementos a < 0,91 m entre ejes'],
];

export const GRUPO_CLASIFICACION: DefCampo[] = [
  {
    path: 'clas.almacen',
    lbl: '¿La ocupación incluye almacenamiento?',
    opts: SINO,
    ayu: 'Con almacenamiento no se admite Riesgo leve',
  },
  {
    path: 'clas.arrumeH',
    lbl: 'Altura máxima de arrume',
    num: true,
    uni: 'm',
    ayu: '> 3,66 m requiere NFPA 13 cap. 20–25',
    dep: 'clas.almacen',
  },
  { path: 'clas.riesgo', lbl: 'Clasificación de riesgo', opts: RIESGOS, ayu: 'NFPA 13 cap. 4' },
  {
    path: 'clas.sistema',
    lbl: 'Tipo de sistema',
    opts: ['Húmedo', 'Seco'],
    ayu: 'Seco: área +30 %, C acero 100, sin reducción QR. El tiempo de llegada del agua, el volumen, los equipos y el drenaje del sistema seco se diseñan aparte',
  },
  {
    path: 'clas.htecho',
    lbl: 'Altura libre al techo más alto del área',
    num: true,
    uni: 'm',
    ayu: '> 9,14 m: requisitos de techos altos',
  },
  {
    path: 'clas.constr',
    lbl: 'Construcción del techo',
    optsPar: CONSTR_PARES,
    ayu: 'Riesgo leve: cobertura máx. 225 / 168 / 130 ft² según la opción. Ver ayuda en Tipologías',
  },
  {
    path: 'clas.techoIncl',
    lbl: '¿Techo con pendiente mayor que 2:12?',
    opts: SINO,
    ayu: 'Área de diseño +30 %',
  },
  {
    path: 'clas.ocultoComb',
    lbl: '¿Espacios ocultos combustibles sin rociadores?',
    opts: SINO,
    ayu: 'Área mínima de 3000 ft²',
  },
];
