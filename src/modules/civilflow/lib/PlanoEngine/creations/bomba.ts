// Creación de bomba sobre caja.
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';
import { _statusMsg } from '../ramalMeasure';
import { pisoCorto } from '../../../constants';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
/** Crea la BOMBA asociada a una caja (AN/LL): círculo punteado a la derecha del símbolo,
 *  código BOMAN-<nivel> único, vinculada permanentemente por `cajaOrigenId` — una bomba por
 *  caja (orig. usuario). Un snapshot de historial por creación. */
export function handleCreateBomba(engine: IPlanoEngineCore, caja: PlanoBajante): void {
  if (caja.tipo !== 'caja_san' && caja.tipo !== 'caja_ll') return;
  // Una bomba por CAJA (por piso puede haber varias — cálculos por bomba, orig. usuario).
  const existente = engine.bajantes.find((b) => b.tipo === 'bomba' && b.cajaOrigenId === caja.id);
  if (existente) {
    engine.triggerAlert(
      'La caja ya tiene bomba',
      `Esta caja ya tiene la bomba ${existente.code || existente.id} asociada.`,
    );
    return;
  }
  // Código único BOMAN<consecutivo>-<piso> (orig. usuario): el consecutivo cuenta las bombas
  // ya creadas en el piso cargado; unicidad garantizada contra los códigos vivos.
  const nivelN = Number(engine.nivelActual?.n ?? 0);
  const consec = engine.bajantes.filter((b) => b.tipo === 'bomba').length + 1;
  const base = `BOMAN${consec}-${pisoCorto(nivelN) || 'P0'}`;
  let code = base;
  let n = 2;
  const codes = new Set(engine.bajantes.map((b) => b.code || b.id));
  while (codes.has(code)) {
    code = `${base}-${n}`;
    n++;
  }
  // Posición: a la DERECHA del símbolo de la caja (semilado caja + radio bomba + margen).
  const cajaHalf = engine.realMmToCanvasPx(1000) / 2 / (engine.zoom || 1);
  const bombaR = engine.realMmToCanvasPx(350) / 4 / (engine.zoom || 1);
  const x = caja.x + cajaHalf + bombaR + cajaHalf * 0.3;
  {
    const bomba: PlanoBajante = {
      id: code,
      net: caja.net,
      tipo: 'bomba',
      code,
      x,
      y: caja.y,
      direccion: 'sube',
      pisoBase: engine.nivelActual?.label ?? '',
      pisoCima: engine.nivelActual?.label ?? '',
      nptBase: engine.nivelActual?.npt ?? 0,
      nptCima: engine.nivelActual?.npt ?? 0,
      hVert: 0,
      dNominal: '',
      recibeDeIds: [],
      alimentaIds: [],
      descargaEnId: null,
      cajaOrigenId: caja.id,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
      lblOffX: 0,
      lblOffY: 0,
      labelAngle: 0,
      labelX: x,
      labelY: caja.y + 20,
      bajR: 7 / 24,
    };
    engine.bajantes.push(bomba);
    engine.selId = code;
    engine._isGhostSel = false;
    engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
    engine.render();
    engine._markDirty();
  }
}
