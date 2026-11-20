/** Datos compartidos de los modales del EPC (ped. 2026-11-20 — port de SIMB y APAR del HTML
 *  de referencia): la tabla de PRESIONES EN APARATOS (3 niveles, ya viva en epAparatos.ts) y la
 *  SIMBOLOGÍA de 32 términos en 6 grupos filtrable por montaje. Ej: simbHtml('red') filtra
 *  las filas de cisterna para el modal Simbología en modo red. */
import { EP_APARATOS } from './epAparatos.ts';

export type SimbFila = [
  grupo: string,
  simbolo: string,
  significado: string,
  unidad: string,
  montaje: '' | 'red' | 'cis',
];

/** Leyenda del esquema del cuarto de bombas: grupo del símbolo y su significado (los 'id' conectan el SVG con la guía). Ej: ['Caudales', 'Qac', …] agrupa las etiquetas de caudal. */
export const EP_SIMB: SimbFila[] = [
  [
    'Caudales',
    'Qac',
    'Caudal de diseño de agua fría de la edificación (del Perfil de presiones)',
    'L/s',
    '',
  ],
  ['Caudales', 'Qd', 'Caudal que debe entregar el equipo (= Qac)', 'L/s', ''],
  ['Caudales', 'Qb', 'Caudal por bomba en trabajo: Qd / Nt', 'L/s', ''],
  [
    'Caudales',
    'Qmín',
    'Caudal mínimo de parada: por debajo, el variador detiene la bomba (% de Qb)',
    'L/s',
    '',
  ],
  ['Presiones y alturas', 'Pmin', 'Presión mínima requerida en el aparato crítico', 'm.c.a.', ''],
  [
    'Presiones y alturas',
    'Hg',
    'Altura geométrica: desnivel del aparato crítico sobre la descarga (z_top − z_bomba)',
    'm',
    '',
  ],
  [
    'Presiones y alturas',
    'Hf_ac',
    'Pérdidas en la red de agua fría, de la descarga del equipo al aparato crítico',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'Hf_otros',
    'Pérdidas dentro del cuarto de bombas: válvulas, cheque, filtro y colectores',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'Hf_suc',
    'Pérdidas en la tubería de succión desde la cisterna',
    'm.c.a.',
    'cis',
  ],
  [
    'Presiones y alturas',
    'P mín. descarga',
    'Presión que el equipo debe entregar en su descarga: Hg + Hf_ac + Pmin',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'HMT',
    'Altura manométrica total: energía que cada bomba entrega al agua en su punto de selección',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'Pmáx',
    'Presión estática máxima admisible en los aparatos',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'P parada máx.',
    'Presión de parada máxima admisible por tubería y aparatos (del Perfil)',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'Pred',
    'Presión disponible de la red pública en la succión',
    'm.c.a.',
    'red',
  ],
  [
    'Presiones y alturas',
    'Patm',
    'Presión atmosférica según la altitud del proyecto',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'Pv',
    'Presión de vapor del agua a la temperatura de trabajo',
    'm.c.a.',
    '',
  ],
  [
    'Presiones y alturas',
    'NPSH disp.',
    'Carga neta positiva disponible en la succión; debe superar el NPSH requerido de la bomba',
    'm',
    '',
  ],
  [
    'Control y tanque',
    'VFD',
    'Variador de frecuencia: ajusta la velocidad de la bomba para sostener la presión objetivo',
    '—',
    '',
  ],
  [
    'Control y tanque',
    'Margen',
    'Holgura sobre la P mín. descarga para fijar el arranque',
    'm.c.a.',
    '',
  ],
  [
    'Control y tanque',
    'Arranque',
    'Presión a la que arranca la bomba (≥ P mín. descarga + margen)',
    'm.c.a.',
    '',
  ],
  [
    'Control y tanque',
    'P objetivo',
    'Presión objetivo (setpoint): la que el variador mantiene constante en la descarga; arranque + banda / 2',
    'm.c.a.',
    '',
  ],
  [
    'Control y tanque',
    'Parada',
    'Presión a la que se detiene la bomba: arranque + banda',
    'm.c.a.',
    '',
  ],
  ['Control y tanque', 'Banda', 'Diferencia de presión entre arranque y parada', 'm.c.a.', ''],
  [
    'Control y tanque',
    'Precarga N₂',
    'Presión del nitrógeno del tanque vacío de agua: 0,9 × arranque',
    'bar',
    '',
  ],
  ['Control y tanque', 'Tc', 'Tiempo de ciclo: 3600 / arranques por hora', 's', ''],
  ['Control y tanque', 'β', 'Factor de entrega del tanque (ley de Boyle con precarga)', '—', ''],
  ['Control y tanque', 'Vt', 'Volumen total del tanque hidroneumático: Qmín·Tc / 4 / β', 'L', ''],
  [
    'Control y tanque',
    'PSV',
    'Válvula de alivio de presión, tarada por encima de la parada',
    'm.c.a.',
    '',
  ],
  ['Equipo y tuberías', 'Nt · Nr', 'Bombas en trabajo · bombas en reserva', 'ud', ''],
  [
    'Equipo y tuberías',
    'η_b · η_m',
    'Eficiencia de la bomba · eficiencia del conjunto motor + variador',
    '—',
    '',
  ],
  ['Equipo y tuberías', 'F.S.', 'Factor de seguridad aplicado a la potencia', '—', ''],
  [
    'Equipo y tuberías',
    'DN · v',
    'Diámetro nominal de la tubería · velocidad del agua',
    'mm · m/s',
    '',
  ],
  ['Cotas y cisterna', 'z_bomba', 'Cota de la descarga del equipo', 'm', ''],
  ['Cotas y cisterna', 'z_top', 'Cota del aparato crítico', 'm', ''],
  ['Cotas y cisterna', 'z_cis · NAM', 'Nivel de agua mínimo de la cisterna (cota)', 'm', 'cis'],
  [
    'Cotas y cisterna',
    'NAV',
    'Nivel de agua máximo de la cisterna; allí se ubica el rebose',
    'm',
    'cis',
  ],
  ['Cotas y cisterna', 'RCI', 'Reserva contra incendio dentro de la cisterna', 'L', 'cis'],
  ['Cotas y cisterna', 'S', 'Sumergencia mínima de la toma de succión (ANSI/HI 9.8)', 'm', 'cis'],
];

/** Filtra la simbología por montaje. Ej: simbDe('red') excluye las filas exclusivas de cisterna. */
export function simbDe(modo: 'red' | 'cis'): SimbFila[] {
  return EP_SIMB.filter((x) => !x[4] || x[4] === (modo === 'cis' ? 'cis' : 'red'));
}

/** Filas de la tabla de presiones en aparatos (reutiliza EP_APARATOS). */
export function aparatosFilas(): typeof EP_APARATOS {
  return EP_APARATOS;
}
