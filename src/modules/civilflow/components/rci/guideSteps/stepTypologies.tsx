/** Paso 6 «Clasifica los pisos» de la Guía de diseño RCI: el alzado ILUSTRATIVO del edificio
 *  con sus franjas de tipología (pisos de ejemplo, sin datos del proyecto — ped. usuario: la
 *  tabla de tipologías del proyecto se quitó de la guía).
 *  Ej: <PasoTipologias /> pinta el alzado de ejemplo y la explicación de tipologías. */
import { ElevSvg } from '../RCISvgBuilding.tsx';
import type { PisoRow, Tips } from '../../../lib/rci/types.ts';
import { BLOQUE_COMPACTO, TXT, UL, type PropsPasoGuia } from './shared.ts';

/** Pisos de EJEMPLO del alzado (3 niveles + cubierta): sin datos del proyecto. */
const FILAS_EJEMPLO: PisoRow[] = [
  {
    nombre: 'Cubierta',
    npt: 12,
    planta: 'A',
    riesgo: 'Riesgo leve',
    sistema: 'Húmedo',
    htecho: 3.5,
    qr: 'No',
    constr: 'No combustible',
    techoIncl: 'No',
    ocultoComb: 'No',
    K: '',
    S: '',
    L: '',
    salida: 'Ninguna',
    tip: 'auto',
  } as PisoRow,
  {
    nombre: 'Piso 2',
    npt: 6,
    planta: 'A',
    riesgo: 'Riesgo leve',
    sistema: 'Húmedo',
    htecho: 2.9,
    qr: 'Sí',
    constr: 'No combustible',
    techoIncl: 'No',
    ocultoComb: 'No',
    K: '',
    S: '',
    L: '',
    salida: 'Ninguna',
    tip: 'auto',
  } as PisoRow,
  {
    nombre: 'Piso 1',
    npt: 0,
    planta: 'A',
    riesgo: 'Riesgo leve',
    sistema: 'Húmedo',
    htecho: 2.9,
    qr: 'Sí',
    constr: 'No combustible',
    techoIncl: 'No',
    ocultoComb: 'No',
    K: '',
    S: '',
    L: '',
    salida: 'Ninguna',
    tip: 'auto',
  } as PisoRow,
];

/** Tipología de EJEMPLO: las 3 filas comparten riesgo/sistema/techo (una sola red). */
const TIPS_EJEMPLO: Tips = {
  groups: [{ id: 'T1', base: 2, pisos: [0, 1, 2], rep: 1, cant: 3, planta: '', qr: '', keys: {} }],
  tipOf: ['T1', 'T1', 'T1'],
} as unknown as Tips;

/* 6 · Clasifica los pisos */
export function PasoTipologias(_props: PropsPasoGuia) {
  return (
    /* Alzado arriba (ancho completo) y la explicación debajo. */
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={BLOQUE_COMPACTO}>
        <ElevSvg pisos={FILAS_EJEMPLO} groups={TIPS_EJEMPLO} zBomba={-3} compact={false} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={TXT}>
          En un edificio no se calcula cada piso: se agrupan los pisos cuya red de rociadores se
          calcula igual. Cada grupo es una <b>tipología</b>; se dibuja y se calcula una red por
          tipología, en su piso representativo ★ (por defecto el más alto, que recibe menos
          presión). El alzado de arriba es un <b>ejemplo</b> de 3 pisos + cubierta en una sola
          tipología.
        </p>
        <ul style={UL}>
          <li>
            Cambian la tipología: riesgo, sistema húmedo o seco, altura del techo, QR, construcción
            y pendiente del techo, espacios ocultos, K, S × L y la planta arquitectónica
            (distribución de rociadores y tuberías).
          </li>
          <li>
            La cota <b>no</b> cambia la tipología: la diferencia de altura entre pisos la resuelve
            el perfil de presiones.
          </li>
          <li>
            Pisos sin rociadores (cubiertas, cuartos técnicos) se registran igual: cuentan para el
            montante y el perfil.
          </li>
          <li>
            Con más de 8 pisos, en el corte los consecutivos de la misma tipología se agrupan en una
            franja (sin escala); el representativo se muestra aparte. Los puntos rojos son salidas
            del montante.
          </li>
        </ul>
      </div>
    </div>
  );
}
