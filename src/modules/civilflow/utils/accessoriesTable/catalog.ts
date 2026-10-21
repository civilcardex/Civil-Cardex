import { SAN_ACCESORIOS, ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../../constants';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { CODO_MEDIO_90, type HidroEntry } from '../sanFittingsCatalog.ts';
import type { RamalDibujo, VentDibujo, TribDibujo, BajanteDibujo } from './collection';

/** Catálogo de accesorios de la red y título de la tabla. */
export function catalogoDeRed(net: 'san' | 'll' | 'af' | 'ac' | 'gas'): {
  catalog: typeof SAN_ACCESORIOS;
  title: string;
} {
  const catalog =
    net === 'san' || net === 'll'
      ? // ponytail: sifón es un APARATO (fixture), no un accesorio de tubería — no va en el
        // resumen de accesorios. El codo 90° implícito del sifón SÍ se cuenta (engine side).
        SAN_ACCESORIOS.filter((a) => a.id !== 'sifon')
      : net === 'gas'
        ? // En gas las seis variantes de codo 90° (estándar/radio largo × horizontal/sube/baja)
          // se fusionan por TIPO: la orientación no cambia la pieza, y la tabla queda con una
          // sola fila por codo ("Codo 90° estándar horizontal" y "Codo 90° radio largo
          // horizontal") que suma todas las orientaciones (ver codoTarget abajo).
          GAS_ACCESORIOS.filter((a) => !a.id.endsWith('_sube') && !a.id.endsWith('_baja'))
        : ACCESORIOS_HIDRO;
  const title =
    net === 'san'
      ? 'Resumen de accesorios sanitarios por diámetro'
      : net === 'll'
        ? 'Resumen de accesorios por diámetro — aguas lluvias'
        : net === 'af'
          ? 'Resumen de accesorios por diámetro — agua fría'
          : net === 'ac'
            ? 'Resumen de accesorios por diámetro — agua caliente'
            : 'Resumen de accesorios por diámetro — gas';
  return { catalog, title };
}

/**
 * Resumen del catálogo visible + los datos de hidro (accesorios de fitting) del storage.
 */
export function resumenCatalogo(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  catalog: typeof SAN_ACCESORIOS,
  drawingRamales: RamalDibujo[],
  tribDrawing: TribDibujo[],
  ventRamales: VentDibujo[],
  bajanteDrawing: BajanteDibujo[],
): {
  summaryCatalog: typeof SAN_ACCESORIOS;
  hasBajanteConn: boolean;
  hidroData: Record<string, HidroEntry>;
} {
  const hidroData = loadFromStorage<Record<string, HidroEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  // Catálogo visible de la tabla: en AF/AC/LL se agrega "Codo medio 90°" — columna propia de los
  // codons puestos a mitad de ramal (ver ACC_MED_CODOS). No entra al catálogo real para no
  // aparecer en dropdowns de selección ni en otras tablas.
  let summaryCatalog =
    net === 'af' || net === 'ac' || net === 'll' ? [...catalog, CODO_MEDIO_90] : [...catalog];
  // Yees siempre presentes en san/ll: el conteo puede venir de hidroData (yee doble con brazo
  // borrado + tapón) aunque no haya geometría de par ni conexión de bajante. Las columnas sin
  // datos las elimina dropAllZeroColumns.
  if (net === 'san' || net === 'll') {
    for (const yId of ['yeeSimple', 'yeeDoble']) {
      if (!summaryCatalog.some((a) => a.id === yId)) {
        const src = SAN_ACCESORIOS.find((a) => a.id === yId) || {
          id: yId,
          nombre: yId === 'yeeSimple' ? 'Y simple' : 'Y doble',
          icono: '',
          cat: 'Tees',
          emoji: '🔧',
        };
        summaryCatalog = [...summaryCatalog, src as (typeof summaryCatalog)[number]];
      }
    }
  }
  // 14. Ensure bajante codo45/Y appear for any net that has bajante connections — por
  // recibeDeIds O por conexión geométrica (el conteo de abajo detecta geométricos; sin esto
  // el gate del catálogo descartaba las piezas contadas cuando recibeDeIds estaba vacío).
  const hasBajanteConn = bajanteDrawing.some((b) => {
    if ((b.net || net) !== net) return false;
    if (b.recibeDeIds && b.recibeDeIds.length > 0) return true;
    if (b.x == null || b.y == null) return false;
    const candidatos = [...drawingRamales, ...tribDrawing, ...ventRamales].filter(
      (r) => r.planId === b.planId,
    );
    return candidatos.some(
      (r) =>
        r.pts &&
        r.pts.length >= 2 &&
        [r.pts[0], r.pts[r.pts.length - 1]].some(
          (pt) => Math.hypot(pt[0] - b.x!, pt[1] - b.y!) < 0.5,
        ),
    );
  });
  if (hasBajanteConn) {
    const needCodo45 = net === 'gas' ? 'codos_45' : 'codo45rc';
    if (!summaryCatalog.some((a) => a.id === needCodo45)) {
      const src = [...SAN_ACCESORIOS, ...ACCESORIOS_HIDRO, ...GAS_ACCESORIOS].find(
        (a) => a.id === needCodo45,
      ) || { id: needCodo45, nombre: 'Codo 45°', icono: '', cat: 'Codos', emoji: '🔩' };
      summaryCatalog = [...summaryCatalog, src as (typeof summaryCatalog)[number]];
    }
    for (const yId of ['yeeSimple', 'yeeDoble']) {
      if (!summaryCatalog.some((a) => a.id === yId)) {
        const src = SAN_ACCESORIOS.find((a) => a.id === yId) || {
          id: yId,
          nombre: yId === 'yeeSimple' ? 'Y simple' : 'Y doble',
          icono: '',
          cat: 'Tees',
          emoji: '🔧',
        };
        summaryCatalog = [...summaryCatalog, src as (typeof summaryCatalog)[number]];
      }
    }
  }
  return { summaryCatalog, hasBajanteConn, hidroData };
}
