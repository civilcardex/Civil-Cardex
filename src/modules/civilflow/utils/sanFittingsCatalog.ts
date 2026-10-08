import { diamPulgFromLabel } from './diamPulgFromLabel';
import { distToSegment } from '../lib/shared/geometry';

export interface HidroEntry {
  accesorios?: Record<string, number>;
}

// Marcadores de tee escritos en los vértices del cuerpo de un ramal (accMed) o en sus extremos
// (accesorioInicio/Fin) — cada uno tiene entrada de catálogo (ACCESORIOS_HIDRO / GAS_ACCESORIOS);
// el auto-tee del montante y el selector de accesorios de mitad de cuerpo persisten tees SOLO
// aquí (nunca en hidroData como fuente primaria de conteo), así que el resumen debe contarlas del
// dibujo, no de los tramos.
export const TEES_ACC_MED = new Set([
  'teeDirecto',
  'teeReduccion',
  'teeLado',
  'teeSube',
  'teeBaja',
  'teeTapon',
  'teeLlaveTerminal',
  'te_linea',
  'te_ramal',
]);

// Tees de las redes hidro que calcHydroAccessories arrastra a hidroData desde accMed/extremos —
// en la tabla se cuentan SOLO desde los marcadores del dibujo (con nomenclatura de tres brazos),
// así que esta ruta se excluye en AF/AC/gas para no duplicarlas.
export const HYDRO_TEE_IDS = new Set([
  'teeDirecto',
  'teeReduccion',
  'teeLado',
  'teeSube',
  'teeBaja',
  'teeTapon',
  'teeLlaveTerminal',
  'te_linea',
  'te_ramal',
]);

// Codons de 90° puestos a MITAD de ramal (accMed, sobre un quiebre del trazo). En AF/AC/LL el
// glifo no se dibuja (el arco del quiebre ya es el codo) pero la pieza SÍ se compra — el resumen
// los muestra en su propia columna "Codo medio 90°". calcHydroAccessories los arrastra a hidroData
// con el mismo id de catálogo del codo elegido, así que esa porción se resta de la ruta hidroData
// y se cuenta una sola vez desde los marcadores del dibujo.
export const ACC_MED_CODOS = new Set([
  'codo90rc',
  'codo90rm',
  'codo90rl',
  'codo90rmSube',
  'codo90rmBaja',
]);

// Todos los codos de 90° (variantes corto/medio/largo + sube/baja). En AF/AC/LL se resumen en UNA
// sola columna "Codo medio 90°": el sube/baja solo describe cómo se instala (hacia arriba o hacia
// abajo), no cambia la pieza, y rc/rm/rl son el mismo codo de 90° en el plano. San conserva sus
// filas de catálogo.
export const CODO_90_IDS = new Set([
  'codo90rc',
  'codo90rm',
  'codo90rl',
  'codo90rmSube',
  'codo90rmBaja',
]);

export const CODO_MEDIO_90 = {
  id: 'codoMedio90',
  emoji: '🔩',
  nombre: 'Codo medio 90°',
  icono: '/iconos_civilflow/accesorios/codo90rm.webp',
  cat: 'Codos',
};

/**
 * Conteo real de bushings (reducciones): cada conexión de un ramal MENOR contra un elemento
 * MAYOR (ramal de más diámetro o bajante/montante) es una reducción. Solo usa geometría y
 * diámetros, por lo que es fácil de probar. Los bajantes se chequean primero porque la
 * conexión ramal→montante es el caso más común y evita doble conteo.
 */
export const BUSHING_TOL = 0.5;

// Compacta los brazos de una yee con igual diámetro a un solo valor, en orden de
// aparición: ["4\"","4\"","2\""] → '4"×2"'. La columna Diámetro del resumen no repite medidas.
export function compactYeeDiam(parts: string[]): string {
  const seen: string[] = [];
  for (const p of parts) {
    const t = (p || '').trim();
    if (!t || t === '—') continue;
    if (!seen.includes(t)) seen.push(t);
  }
  return seen.join('×');
}

// ¿El ramal ya trae un codo manual (90° o 45°) en el extremo que toca al bajante? Si sí, ese
// cubre la pieza y el bloque bajante no debe auto-agregar otro codo 90° (evita duplicar).
const MANUAL_CODO_AT_BAJANTE = new Set([...CODO_90_IDS, 'codo45rc']);
export function ramalHasManualCodoAt(
  r: { pts?: number[][]; accIni?: string; accFin?: string },
  bx?: number,
  by?: number,
): boolean {
  if (!r.pts || r.pts.length < 2 || bx == null || by == null) return false;
  const first = r.pts[0];
  const last = r.pts[r.pts.length - 1];
  if (
    r.accIni &&
    MANUAL_CODO_AT_BAJANTE.has(r.accIni) &&
    Math.hypot(first[0] - bx, first[1] - by) < 0.5
  )
    return true;
  if (
    r.accFin &&
    MANUAL_CODO_AT_BAJANTE.has(r.accFin) &&
    Math.hypot(last[0] - bx, last[1] - by) < 0.5
  )
    return true;
  return false;
}

export function computeBushingCounts(
  minors: Array<{ id: string; diametro: string; pts: number[][] }>,
  majors: Array<{ id: string; diametro: string; pts: number[][] }>,
  bajantes: Array<{ id: string; diametro: string; x: number; y: number }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const pulg = (d: string): number => diamPulgFromLabel(d);
  const add = (mayor: number, menor: number) => {
    const k = `${mayor}_${menor}`;
    counts[k] = (counts[k] || 0) + 1;
  };
  for (const m of minors) {
    const dm = pulg(m.diametro);
    if (dm <= 0 || !m.pts || m.pts.length < 2) continue;
    for (const ep of [m.pts[0], m.pts[m.pts.length - 1]]) {
      let matchedBajante = false;
      for (const b of bajantes) {
        const db = pulg(b.diametro);
        if (db <= dm) continue;
        if (Math.hypot(ep[0] - b.x, ep[1] - b.y) <= BUSHING_TOL) {
          add(db, dm);
          matchedBajante = true;
          break;
        }
      }
      if (matchedBajante) continue;
      // Un extremo en la UNIÓN de dos ramales mayores (tee 6"-6" donde descarga el de 4") es
      // una reducción contra CADA mayor que toca el punto — sin break al primero, o la unión
      // RAC1+RAC3 del caso real contaría 1 bushing en vez de 2.
      for (const M of majors) {
        if (M.id === m.id) continue;
        const dM = pulg(M.diametro);
        if (dM <= dm) continue;
        for (let i = 0; i < M.pts.length - 1; i++) {
          if (distToSegment(ep, M.pts[i], M.pts[i + 1]) <= BUSHING_TOL) {
            add(dM, dm);
            break;
          }
        }
      }
    }
  }
  return counts;
}
