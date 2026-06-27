import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { NETS } from './PlanoState';
import { pointInLabelBox, pointInPoly } from './HitTester';

export interface DragState {
  id: string;
  offX: number;
  offY: number;
}

export interface PointDrag {
  id: string;
  ptIdx: number;
  slideConstraint?: { otherId: string; segmentIdx: number };
}

export interface TxtDrag {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export interface AreaDrag {
  id: string;
  startX: number;
  startY: number;
}

export interface GhostDrag {
  id: string;
  startX: number;
  startY: number;
  baseDx: number;
  baseDy: number;
}

export interface MultiDrag {
  startX: number;
  startY: number;
  origData: Record<string, unknown>;
}

export interface RamalDrag {
  id: string;
  startX: number;
  startY: number;
  origPts: [number, number][];
  connBaj?: { id: string; origX: number; origY: number; origLblX: number; origLblY: number; atIdx: number }[];
}

export type DragType = 'lbl' | 'baj' | 'txt' | 'pt' | 'ramal' | 'ghost' | 'area' | 'multi' | null;

export class DragStateMachine {
  private engine: IPlanoEngineCore;
  private _currentDrag: DragType = null;

  lblDrag: DragState | null = null;
  bajDrag: DragState | null = null;
  txtDrag: TxtDrag | null = null;
  ptDrag: PointDrag | null = null;
  ramalDrag: RamalDrag | null = null;
  ghostDrag: GhostDrag | null = null;
  areaDrag: AreaDrag | null = null;
  multiDrag: MultiDrag | null = null;

  constructor(engine: IPlanoEngineCore) {
    this.engine = engine;
  }

  get currentDrag(): DragType {
    return this._currentDrag;
  }

  private setCurrentDrag(type: DragType): void {
    this._currentDrag = type;
  }

  hasActiveDrag(): boolean {
    return this.lblDrag !== null ||
           this.bajDrag !== null ||
           this.txtDrag !== null ||
           this.ptDrag !== null ||
           this.ramalDrag !== null ||
           this.ghostDrag !== null ||
           this.areaDrag !== null ||
           this.multiDrag !== null;
  }

  clearAll(): void {
    this.lblDrag = null;
    this.bajDrag = null;
    this.txtDrag = null;
    this.ptDrag = null;
    this.ramalDrag = null;
    this.ghostDrag = null;
    this.areaDrag = null;
    this.multiDrag = null;
    this._currentDrag = null;
  }

  clearLabel(): void { this.lblDrag = null; }
  clearBajante(): void { this.bajDrag = null; }
  clearText(): void { this.txtDrag = null; }
  clearPoint(): void { this.ptDrag = null; }
  clearRamal(): void { this.ramalDrag = null; }
  clearGhost(): void { this.ghostDrag = null; }
  clearArea(): void { this.areaDrag = null; }
  clearMulti(): void { this.multiDrag = null; }

  setLblDrag(id: string, offX: number, offY: number): void {
    this.clearAll();
    this.lblDrag = { id, offX, offY };
    this.setCurrentDrag('lbl');
  }

  setBajDrag(id: string, offX: number, offY: number): void {
    this.clearAll();
    this.bajDrag = { id, offX, offY };
    this.setCurrentDrag('baj');
  }

  setTxtDrag(id: string, startX: number, startY: number, origX: number, origY: number): void {
    this.clearAll();
    this.txtDrag = { id, startX, startY, origX, origY };
    this.setCurrentDrag('txt');
  }

  setPtDrag(id: string, ptIdx: number, slideConstraint?: { otherId: string; segmentIdx: number }): void {
    this.clearAll();
    this.ptDrag = { id, ptIdx, slideConstraint };
    this.setCurrentDrag('pt');
  }

  setRamalDrag(id: string, startX: number, startY: number, origPts: [number, number][], connBaj?: RamalDrag['connBaj']): void {
    this.clearAll();
    this.ramalDrag = { id, startX, startY, origPts, connBaj };
    this.setCurrentDrag('ramal');
  }

  setGhostDrag(id: string, startX: number, startY: number, baseDx: number, baseDy: number): void {
    this.clearAll();
    this.ghostDrag = { id, startX, startY, baseDx, baseDy };
    this.setCurrentDrag('ghost');
  }

  setAreaDrag(id: string, startX: number, startY: number): void {
    this.clearAll();
    this.areaDrag = { id, startX, startY };
    this.setCurrentDrag('area');
  }

  setMultiDrag(startX: number, startY: number, origData: Record<string, unknown>): void {
    this.clearAll();
    this.multiDrag = { startX, startY, origData };
    this.setCurrentDrag('multi');
  }

  syncToEngine(): void {
    this.engine.lblDrag = this.lblDrag;
    this.engine.bajDrag = this.bajDrag;
    this.engine.txtDrag = this.txtDrag;
    this.engine.ptDrag = this.ptDrag;
    this.engine.ramalDrag = this.ramalDrag;
    this.engine.ghostDrag = this.ghostDrag;
    this.engine.areaDrag = this.areaDrag;
    this.engine.multiDrag = this.multiDrag;
  }

  syncFromEngine(): void {
    this.lblDrag = this.engine.lblDrag;
    this.bajDrag = this.engine.bajDrag;
    this.txtDrag = this.engine.txtDrag;
    this.ptDrag = this.engine.ptDrag;
    this.ramalDrag = this.engine.ramalDrag;
    this.ghostDrag = this.engine.ghostDrag;
    this.areaDrag = this.engine.areaDrag;
    this.multiDrag = this.engine.multiDrag;
  }
}

export interface HitTestResult {
  element: unknown;
  isGhostClick: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
}

export function hitTestContextMenu(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  zoom: number
): HitTestResult | null {
  if (!engine.selId) return null;

  const bajante = engine.bajantes.find(b => b.id === engine.selId);
  if (bajante) {
    if (!engine._isGhostSel) {
      const c = engine.toCvs(bajante.x, bajante.y);
      const hitR = (bajante._circ?.r || Math.max(6, 6 * zoom) + 10);
      const hitOnCircle = Math.hypot(x - c.x, y - c.y) <= hitR;
      const hitOnLabel = bajante._labelBox && pointInLabelBox(x, y, bajante._labelBox);
      if (hitOnCircle || hitOnLabel) {
        return { element: bajante, isGhostClick: false };
      }
    } else {
      const ghostList = engine.getBajantesFantasma().filter(g => g.id === engine.selId);
      if (ghostList.length > 0 && ghostList[0]._ghost) {
        const gh = ghostList[0]._ghost;
        const hitOnGhost = Math.hypot(x - gh.x, y - gh.y) <= gh.r;
        const hitOnGhostLabel = ghostList[0]._ghostLabelBox && pointInLabelBox(x, y, ghostList[0]._ghostLabelBox);
        if (hitOnGhost || hitOnGhostLabel) {
          return { element: bajante, isGhostClick: true };
        }
      }
    }
    return null;
  }

  const ramal = engine.ramales.find(r => r.id === engine.selId);
  if (ramal) {
    let hitOnRamal = false;
    let ramalEndpoint: { idx: number; x: number; y: number } | null = null;

    if (ramal.pts) {
      for (const epIdx of [0, ramal.pts.length - 1]) {
        const ep = engine.toCvs(ramal.pts[epIdx][0], ramal.pts[epIdx][1]);
        if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
          hitOnRamal = true;
          ramalEndpoint = { idx: epIdx, x: ramal.pts[epIdx][0], y: ramal.pts[epIdx][1] };
          break;
        }
      }

      if (!hitOnRamal) {
        for (let i = 0; i < ramal.pts.length - 1; i++) {
          const p1 = engine.toCvs(ramal.pts[i][0], ramal.pts[i][1]);
          const p2 = engine.toCvs(ramal.pts[i + 1][0], ramal.pts[i + 1][1]);
          const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
          let t = l2 === 0 ? 0 : ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          if (Math.hypot(x - projX, y - projY) <= 12) {
            hitOnRamal = true;
            break;
          }
        }
      }
    }

    const hitOnLabel = ramal._labelBox && pointInLabelBox(x, y, ramal._labelBox);
    if (hitOnRamal || hitOnLabel) {
      return { element: ramal, isGhostClick: false, ramalEndpoint };
    }
    return null;
  }

  const area = engine.areas.find(a => a.id === engine.selId);
  if (area) {
    let hitOnArea = false;
    if (area.pts) {
      const cvsPts = area.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1]));
      if (pointInPoly(x, y, cvsPts)) {
        hitOnArea = true;
      }
    }
    const hitOnLabel = area._labelBox && pointInLabelBox(x, y, area._labelBox);
    if (hitOnArea || hitOnLabel) {
      return { element: area, isGhostClick: false };
    }
  }

  return null;
}

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