// Creación del GABINETE (caja pequeña contra incendio, GABn) sobre el plano. Esqueleto de
// handleCajaDown (la caja más simple del motor): un punto que suelta un símbolo y queda
// seleccionado — sin asociación geométrica (el vínculo con su montante es el campo opcional
// `montante` (código), que la fase de UI de diseño escribirá).
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { numDeBajante } from '../../../utils/keys.ts';

/** Prefijo de código del gabinete (GAB1, GAB2…). */
export const GABINETE_PFX = 'GAB';

/** Suelta un GABINETE (la caja pequeña donde vive la válvula/gabinete contra incendio) donde
 *  hiciste clic y lo deja seleccionado. Net-agnostic: hereda la red activa (en rci es donde se
 *  usa; el glifo toma el color de esa red). El montante que lo alimenta NO se fija aquí — se
 *  asigna después en `montante` (código del montante, ej: 'MRCI1'). */
export function handleGabineteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  // MENOR NÚMERO LIBRE sobre ids existentes (mismo criterio de handleBajante): borrar GAB1 de
  // {GAB1, GAB2} reutiliza el 1 en vez de dejar hueco. El número se lee con el extractor
  // CANÓNICO (numDeBajante, el final del id/código).
  const usedNums = new Set<number>(
    engine.bajantes
      .filter((b) => b.tipo === 'gabinete')
      .map((b) => numDeBajante(b.code || b.id, GABINETE_PFX))
      .filter((n) => n > 0),
  );
  let cnt = 1;
  while (usedNums.has(cnt)) cnt++;
  const gabId = GABINETE_PFX + cnt;
  engine.bajantes.push({
    id: gabId,
    net: engine.activeNet,
    tipo: 'gabinete',
    code: gabId,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
  });
  engine.selId = gabId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}
