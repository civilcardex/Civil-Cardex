/** Campos de la sub-pestaña MONTANTES (NFPA 14): clase de sistema, número y diámetro de
 *  montantes, cotas de gabinete y derivación. Ej: mont.hS fija la válvula del gabinete entre
 *  0,90 y 1,50 m sobre el NPT (Nivel de Piso Terminado). */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { CLASES_SP, DIAMETROS, MATERIALES, SINO } from '../../../utils/rci/RCIRowsModel.ts';

export const GRUPO_MONTANTES: DefCampo[] = [
  {
    path: 'sp.clase',
    lbl: 'Clase de sistema',
    opts: CLASES_SP,
    abreModal: 'clases',
    dep: 'local.exigeSP',
    ayu: (_r, e) =>
      (
        ({
          'Clase I': 'Conexión de 2½" para bomberos, sin manguera. 100 psi, 500 gpm',
          'Clase II': 'Gabinete con manguera de 1½" para ocupantes. 65 psi, 100 gpm',
          'Clase III':
            'Conexión de 2½" para bomberos y gabinete con manguera de 1½" en cada punto. 100 psi, 500 gpm',
        }) as Record<string, string>
      )[e.sp.clase] || 'La define el código local. Ver «¿Qué clase elegir?»',
  },
  {
    path: 'sp.num',
    lbl: 'Número de montantes',
    num: true,
    uni: 'un',
    dep: 'local.exigeSP',
    ayu: 'Clase I/III: cada montante adicional suma 250 gpm',
  },
  {
    path: 'sp.rociado',
    lbl: 'Edificio totalmente rociado',
    opts: SINO,
    ayu: 'Sí: tope de 1000 gpm y gobierna la mayor demanda (no se suman)',
  },
  {
    path: 'sp.diam',
    lbl: 'Diámetro mínimo del montante',
    num: true,
    uni: 'pulg',
    dep: 'local.exigeSP',
    ayu: 'Mín. 4"; combinado 6" salvo cálculo hidráulico. El diámetro de cálculo es el del montante (abajo)',
    rango: () => ({ min: 4 }),
  },
  {
    path: 'sp.zMinSalida',
    lbl: 'Cota de la salida más baja del edificio',
    num: true,
    uni: 'm',
    dep: 'local.exigeSP',
    ayu: (r) =>
      r.sp.activo && r.sp.zAuto !== undefined
        ? `Vacío = ${r.sp.zAuto} m (la más baja de la tabla de pisos)`
        : 'Sobre el eje de la bomba',
  },
  {
    path: 'mont.mat',
    lbl: 'Material del montante',
    opts: MATERIALES,
    ayu: 'Su C sale de la tabla de Tubería',
  },
  {
    path: 'mont.dn',
    lbl: 'Diámetro del montante',
    opts: DIAMETROS,
    fmtValor: (v) => String(v).replace(/ /g, '-'),
    ayu: (r, e) =>
      r.edif.dnM
        ? `Ø usado: ${r.edif.dnM}${e.mont.dn === 'auto' ? ' (auto)' : ''}`
        : 'Auto: el menor que cumple velocidad y mínimo de norma',
  },
  {
    path: 'mont.hS',
    lbl: 'Altura de la válvula de manguera (gabinete) sobre NPT',
    num: true,
    uni: 'm',
    ayu: 'Centro de la válvula sobre el NPT (Nivel de Piso Terminado). NFPA 14: entre 0,90 y 1,50 m. Cota = NPT + altura',
    rango: () => ({ min: 0.9, max: 1.5 }),
  },
  {
    path: 'mont.hD',
    lbl: 'Altura de la derivación del piso sobre NPT (tee en el montante)',
    num: true,
    uni: 'm',
    ayu: 'La tee de salida hacia el piso, antes de la VCP (válvula de control del piso). Solo se usa en tipologías sin red; con red, manda la cota del nudo de derivación',
  },
  {
    path: 'mont.zBase',
    lbl: 'Cota de la base del montante',
    num: true,
    uni: 'm',
    ayu: 'Sobre el eje de la bomba',
  },
  {
    path: 'mont.holgura',
    lbl: 'Holgura mínima exigida en cada derivación',
    num: true,
    uni: 'psi',
    ayu: '0 = lo que exige la norma; un margen de diseño la aumenta',
  },
];
