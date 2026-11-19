/** Presiones en aparatos del módulo EPC (Equipo de Presión Constante) — port del HTML de referencia:
 *  tabla de tres niveles [mínima, confort, máxima] en m.c.a. La mínima es la que funciona con
 *  grifería de baja presión (tanque elevado, criterio NBR 5626: 0,5–1,5 m); la de confort es
 *  la de diseño (IPC Tabla 604.3: 8/20/25/35/45 psi); la máxima es la estática admisible
 *  (IPC 604.8: 80 psi). Ej: apLim('ducha con mezcladora') → {mn 1.02, rc 14.06, mx 56.25}. */

const ps = (x: number): number => x * 0.70307; // psi → m.c.a.
const PX = ps(80); // 56,25 m.c.a. — máxima estática IPC 604.8

/** Una fila de la tabla: nombre visible, límites en m.c.a. y patrón para reconocer el
 *  nombre que envía el Perfil de presiones (ap.match). nota = '*' con texto al pasar el mouse. */
export interface AparatoRow {
  nombre: string;
  min: number;
  confort: number;
  max: number;
  nota?: string;
  re: RegExp;
}

const ROWS: Array<[string, number, number, number, RegExp, string?]> = [
  ['Lavamanos', 0.51, ps(8), PX, /lavaman|lavator/],
  ['Lavamanos con mezcladora', 0.51, ps(8), PX, /lavaman.*mezcl/],
  ['Lavamanos público', 0.51, ps(8), PX, /lavaman.*public/],
  ['Lavaplatos (poceta residencial)', 0.51, ps(8), PX, /lavaplat|fregader|cocina|poceta.*resid/],
  ['Poceta de servicio', 0.51, ps(8), PX, /poceta.*serv|aseo/],
  ['Lavadero', 0.51, ps(8), PX, /lavadero/],
  ['Lavadora', 0.51, ps(8), PX, /lavadora/, 'No listada en IPC 604.3: se asume grifería'],
  ['Lavavajillas doméstico', 1.02, ps(8), PX, /lavavajilla|lavaloza/],
  ['Accesorio de combinación', 0.51, ps(8), PX, /combinaci/],
  ['Ducha', 1.02, ps(8), PX, /ducha|regadera/],
  [
    'Ducha con mezcladora balanceada o termostática',
    1.02,
    ps(20),
    PX,
    /ducha.*(mezcl|termost|balance)/,
  ],
  ['Tina / bañera', 0.51, ps(20), PX, /tina|ba[nñ]era/],
  ['Bidé con mezcladora termostática', 1.02, ps(20), PX, /bide/],
  ['Bebedero', 1.02, ps(8), PX, /bebedero/],
  ['Grifería de manguera / jardín', 0.51, ps(8), PX, /manguera|jard|hose/],
  ['Sanitario con tanque', 0.71, ps(20), PX, /sanitario|inodoro|\bwc\b/],
  ['Sanitario sifónico con fluxómetro', 1.53, ps(35), PX, /flux/],
  [
    'Sanitario con tanque a presión (fluxómetro)',
    ps(20),
    ps(20),
    PX,
    /tanque.*(flux|presi)/,
    'Sin versión de baja presión',
  ],
  [
    'Sanitario de desboque con fluxómetro',
    ps(45),
    ps(45),
    PX,
    /desboque|arrastre|blowout/,
    'Sin versión de baja presión',
  ],
  ['Orinal de válvula', 1.53, ps(25), PX, /orinal|urinari/],
];

export const EP_APARATOS: AparatoRow[] = ROWS.map(([nombre, min, confort, max, re, nota]) => ({
  nombre,
  min,
  confort,
  max,
  re,
  ...(nota ? { nota } : {}),
}));

/** Normaliza texto para el match: minúsculas sin acentos (apNorm del HTML). */
export const apNorm = (t: string | undefined): string =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Índice del aparato que matchea un nombre libre (el ÚLTIMO patrón que coincide es el más
 *  específico — «ducha con mezcladora» gana a «ducha»). -1 si ninguno. Ej: apMatch('Ducha
 *  confort') → 9 (Ducha). */
export function apMatch(t: string | undefined): number {
  const n = apNorm(t);
  if (!n) return -1;
  const ex = EP_APARATOS.findIndex((a) => apNorm(a.nombre) === n);
  if (ex >= 0) return ex;
  let r = -1;
  EP_APARATOS.forEach((a, i) => {
    if (a.re.test(n)) r = i;
  });
  return r;
}

/** Límites del aparato en un índice (-1 → null): {nombre, min, confort, max} en m.c.a. */
export function apLim(
  i: number,
): { nombre: string; min: number; confort: number; max: number } | null {
  const a = EP_APARATOS[i];
  return a ? { nombre: a.nombre, min: a.min, confort: a.confort, max: a.max } : null;
}
