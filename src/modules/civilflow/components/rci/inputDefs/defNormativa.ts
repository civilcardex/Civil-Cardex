/** Campos de la sub-pestaña NORMATIVA local: el marco legal de cada país (código de
 *  edificación, rociadores, montantes, bloque sísmico). Las ayudas leen el perfil del país
 *  (perfilRciDe). Ej: local.codLocal muestra «Precargado: NSR-10 Título J · NTC 1500». */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { perfilRciDe } from '../../../constants/rciCountryStandards.ts';
import { SINO, ZONAS_SIS } from '../../../utils/rci/RCIRowsModel.ts';
import { zonaSis } from '../../../lib/rci/index.ts';

export const GRUPO_NORMATIVA: DefCampo[] = [
  {
    path: 'meta.pais',
    lbl: 'País del proyecto',
    soloLectura: true,
    ayu: (_r, e) => `Del país escogido: ${e.meta.pais || 'Colombia'}`,
  },
  {
    path: 'local.codLocal',
    lbl: 'Código de edificación aplicable',
    ayu: (_r, e) => `Precargado: ${perfilRciDe(e.meta.pais).codLocal}`,
  },
  {
    path: 'local.ocupLocal',
    lbl: 'Ocupación según el código local',
    ayu: 'Grupo de ocupación del código local. No define el riesgo NFPA 13',
  },
  {
    path: 'local.exigeRoc',
    lbl: '¿El código local exige rociadores?',
    opts: SINO,
    ayu: (_r, e) => `Perfil: ${perfilRciDe(e.meta.pais).exigeRoc}`,
  },
  {
    path: 'local.refRoc',
    lbl: 'Artículo que exige rociadores',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).refRoc || 'Artículo del código local',
    dep: 'local.exigeRoc',
  },
  {
    path: 'local.exigeSP',
    lbl: '¿Exige montantes / gabinetes?',
    opts: SINO,
    ayu: (_r, e) => `Perfil: ${perfilRciDe(e.meta.pais).exigeSP}`,
  },
  {
    path: 'local.refSP',
    lbl: 'Artículo que exige montantes',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).refSP || 'Artículo del código local',
    dep: 'local.exigeSP',
  },
  {
    path: 'local.adopNac',
    lbl: 'Adopción nacional de NFPA 13 / 14',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).adopNac,
  },
  {
    path: 'local.normElec',
    lbl: 'Norma eléctrica local',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).normElec,
  },
  {
    path: 'local.reqSismo',
    lbl: '¿Requiere diseño sísmico de la red?',
    opts: SINO,
    ayu: (_r, e) =>
      perfilRciDe(e.meta.pais).reqSismo
        ? 'Perfil del país: Sí'
        : 'Sin regla sísmica RCI en el perfil del país',
  },
  {
    path: 'local.normSis',
    lbl: 'Norma sísmica local',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).normSis || 'Ej.: ASCE 7 o la norma nacional',
    dep: 'local.reqSismo',
  },
  {
    path: 'local.parSismo',
    lbl: 'Parámetro sísmico de referencia',
    ayu: (_r, e) => perfilRciDe(e.meta.pais).parLabel || "Ej.: 'Aa 0.15, Av 0.20'",
    dep: 'local.reqSismo',
  },
  {
    path: 'local.zonaSis',
    lbl: 'Zona de amenaza sísmica del proyecto',
    opts: ZONAS_SIS,
    dep: 'local.reqSismo',
    ayu: (_r, e) => {
      const p = perfilRciDe(e.meta.pais);
      const z = zonaSis(e);
      if (z.auto)
        return `Auto con NSR-10: zona ${z.z} (mayor de Aa y Av = ${z.a?.toFixed(2)}). Elija otra solo si la autoridad lo indica`;
      if (e.meta.pais === 'Colombia' && !e.local.zonaSis)
        return 'Con NSR-10 se calcula sola al escribir Aa y Av en el parámetro sísmico';
      return `Según la norma sísmica del país (${p.normSis || 'norma local'}). ${
        p.zonaAuto ? p.zonaAuto + '. ' : ''
      }Define el alcance de la guía de la pestaña Soportes sísmicos`;
    },
  },
  {
    path: 'local.cp',
    lbl: 'Coeficiente sísmico Cp (NFPA 13)',
    num: true,
    ayu: 'Vacío = 0,5 (default NFPA 13)',
    dep: 'local.reqSismo',
  },
  {
    path: 'local.losaRestr',
    lbl: '¿Las losas restringen el montante? (paso ajustado)',
    opts: SINO,
    dep: 'local.reqSismo',
    ayu: 'Sí: riostra de cuatro vías intermedia no exigida (NFPA 13 cap. 18)',
  },
];
