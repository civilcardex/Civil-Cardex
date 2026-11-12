/** Campos de las sub-pestañas de BOMBA y TANQUE: selección de bomba (curva, eficiencias),
 *  succión (NPSH), bomba jockey y volumen de reserva del tanque. Ej: bomba.margenNpsh es el
 *  colchón contra cavitación que no exige NFPA. */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { NOM } from '../../../lib/rci/tables.ts';
import { MATERIALES } from '../../../utils/rci/RCIRowsModel.ts';
import { num } from '../../../lib/rci/hydraulics.ts';

export const GRUPO_SELECCION: DefCampo[] = [
  {
    path: 'pisos.zBomba',
    lbl: 'Cota del eje de la bomba',
    num: true,
    uni: 'm',
    ayu: 'Mismo origen que los NPT de los pisos',
  },
  {
    path: 'bomba.margen',
    lbl: 'Margen de presión sobre la demanda',
    num: true,
    uni: 'fracción',
    ayu: '0,10 = 10 %. NFPA 20 no lo exige; lo usual es 0,05–0,10',
  },
  {
    path: 'bomba.qrManual',
    lbl: 'Caudal nominal adoptado',
    num: true,
    uni: 'gpm',
    ayu: 'Vacío = tamaño estándar inmediato superior',
  },
  {
    path: 'bomba.fchurn',
    lbl: 'Presión a caudal cero / nominal',
    num: true,
    ayu: 'Dato del fabricante; NFPA 20: ≤ 1,40',
    rango: () => ({ max: 1.4 }),
  },
  {
    path: 'bomba.etaN',
    lbl: 'Eficiencia en el punto nominal',
    num: true,
    uni: 'fracción',
    ayu: 'Del catálogo de la bomba elegida',
  },
  {
    path: 'bomba.eta150',
    lbl: 'Eficiencia al 150 % del caudal',
    num: true,
    uni: 'fracción',
    ayu: 'Del catálogo; suele gobernar la potencia del motor',
  },
  {
    path: 'bomba.fs',
    lbl: 'Factor de servicio del motor',
    num: true,
    ayu: '1,00 conservador; 1,15 solo si el motor lo certifica',
  },
];

export const GRUPO_SUCCION: DefCampo[] = [
  {
    path: 'bomba.zFondo',
    lbl: 'Cota del fondo del tanque sobre el eje de la bomba',
    num: true,
    uni: 'm',
    ayu: 'NFPA 20: al nivel del eje o por encima (succión positiva, sin válvula de pie)',
  },
  {
    path: 'bomba.hmin',
    lbl: 'Nivel mínimo de agua sobre el eje de la bomba',
    num: true,
    uni: 'm',
    ayu: 'Nivel más bajo tras la demanda y duración de diseño; con él se calculan la succión y el NPSH',
  },
  {
    path: 'bomba.hmax',
    lbl: 'Nivel máximo de agua sobre el eje de la bomba',
    num: true,
    uni: 'm',
    ayu: 'Nivel de rebose: se suma a la presión estática máxima del sistema',
  },
  {
    path: 'bomba.matSuc',
    lbl: 'Material de la succión',
    opts: MATERIALES,
    ayu: 'Define el diámetro interior y el coeficiente C',
  },
  {
    path: 'bomba.dnSuc',
    lbl: 'Diámetro nominal de succión',
    opts: NOM,
    ayu: (r) =>
      `Mínimo ${r.bomba.DsucMin}" (NFPA 20) para ${r.bomba.Qnom} gpm; velocidad ≤ 4,57 m/s al 150 %`,
  },
  {
    path: 'bomba.lSuc',
    lbl: 'Longitud real de succión',
    num: true,
    uni: 'm',
    ayu: 'Del tanque a la brida de succión de la bomba',
  },
  {
    path: 'bomba.c90',
    lbl: 'Succión: codos 90°',
    num: true,
    uni: 'un',
    ayu: 'Accesorios de la tubería de succión',
  },
  {
    path: 'bomba.tee',
    lbl: 'Succión: tees',
    num: true,
    uni: 'un',
    ayu: 'Solo las tees donde el flujo gira',
  },
  {
    path: 'bomba.comp',
    lbl: 'Succión: válvulas de compuerta OS&Y',
    num: true,
    uni: 'un',
    ayu: 'No se admiten mariposas a menos de 15 m de la succión',
  },
  {
    path: 'bomba.chq',
    lbl: 'Succión: retención / válvula de pie',
    num: true,
    uni: 'un',
    ayu: 'La válvula de pie solo existe con succión negativa, que NFPA 20 no admite en bomba horizontal',
  },
  {
    path: 'bomba.altitud',
    lbl: 'Altitud del sitio',
    num: true,
    uni: 'm s.n.m.',
    ayu: 'Reduce la presión atmosférica y el NPSH disponible',
  },
  {
    path: 'bomba.patmManual',
    lbl: 'Presión atmosférica',
    num: true,
    uni: 'm.c.a.',
    ayu: (_r, e) =>
      `Vacío = ${(10.33 - (num(e.bomba.altitud) || 0) / 900).toFixed(2)} m (10,33 − h/900)`,
  },
  {
    path: 'bomba.tagua',
    lbl: 'Temperatura del agua',
    num: true,
    uni: '°C',
    ayu: 'Define la presión de vapor en el NPSH disponible',
  },
  {
    path: 'bomba.npshr',
    lbl: 'NPSH requerido del fabricante (al 150 %)',
    num: true,
    uni: 'm',
    ayu: 'Dato del catálogo de la bomba',
  },
  {
    path: 'bomba.margenNpsh',
    lbl: 'Margen de NPSH',
    num: true,
    uni: 'm',
    ayu: 'Práctica recomendada para evitar cavitación; no es exigencia NFPA',
  },
];

export const GRUPO_JOCKEY: DefCampo[] = [
  {
    path: 'bomba.qjockey',
    lbl: 'Caudal de la bomba jockey',
    num: true,
    uni: 'gpm',
    ayu: (r) =>
      `Entre 1 gpm y ${r.roc.Q1.toFixed(1)} gpm (un rociador). Arranque ${r.bomba.JkStart.toFixed(0)} / parada ${r.bomba.JkStop.toFixed(0)} psi; la principal arranca a ${r.bomba.PpStart.toFixed(0)} psi`,
    rango: (_e, r) => ({ min: 1, max: r.roc.Q1 }),
  },
];

export const GRUPO_TANQUE: DefCampo[] = [
  {
    path: 'tanque.vextra',
    lbl: 'Volumen adicional (otros usos / reserva)',
    num: true,
    uni: 'm³',
    ayu: (r) =>
      `Se suma al volumen contra incendio (${Math.max(r.tanque.Vroc, r.tanque.Vsp).toFixed(1)} m³); total ${r.tanque.V.toFixed(1)} m³`,
  },
];
