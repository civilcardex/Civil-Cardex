import type { IPlanoEngineCore } from './PlanoState';
import { NETS } from './PlanoState';

export function initEngineState(engine: IPlanoEngineCore): void {
  engine.zoom = 1;
  engine.offX = 0;
  engine.offY = 0;
  engine.dpr = 1;
  engine.tool = 'sel';
  engine.activeNet = 'af';
  (engine as any).tipoTramo = 'ramal';
  engine.snapMode = true;
  engine.scaleM = 0.5;
  engine.definedScaleM = 0;
  engine.pageW = 0;
  engine.pageH = 0;

  engine.ramales = [];
  engine.dims = [];
  engine.textAnnots = [];
  engine.bajantes = [];
  engine.areas = [];
  engine.activeRamal = null;
  engine.padreTributario = null;
  engine.activeArea = null;
  engine.selId = null;
  (engine as any)._isGhostSel = false;
  (engine as any)._yeeFlashKey = null;
  engine.areaDrag = null;
  engine.dimDrag = null;
  engine.panning = false;
  (engine as any).panX0 = 0;
  (engine as any).panY0 = 0;
  engine.mouseX = 0;
  engine.mouseY = 0;
  engine.ghostDrag = null;
  engine.lblDrag = null;
  engine.txtDrag = null;
  engine.bajDrag = null;
  engine.ptDrag = null;
  engine.ramalDrag = null;
  (engine as any).multiSel = [];
  (engine as any).multiDrag = null;
  (engine as any).marqueeRect = null;
  engine._dimStart = null;
  engine.nivelActual = null;
  engine.nptLevels = [];
  engine._hiddenNets = new Set<string>();
  engine._lockedNets = new Set<string>();
  engine._loadedPlanId = null;
  engine._onDirtyCb = null;
  engine._lastMouseCvs = { x: 0, y: 0 };

  engine._netCounts = {};
  NETS.forEach(n => { engine._netCounts[n.id] = { ramal: 0, tributario: 0 }; });

  engine.MM = {
    lblName: 1.5,
    lblInfo: 1.2,
    lblCode: 1.4,
    flowEmoji: 2.0,
    coord: 1.2,
  };

  engine._ramalDefaults = null;
}
