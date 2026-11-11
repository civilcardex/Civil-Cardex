/**
 * Emisores y triggers del motor: notifican selección/estado/borrado al visor (limpiando las
 * cajas de render del objeto) y disparan alertas y modales. Extraído verbatim de
 * PlanoEngine.ts. Ej: _emitSelect(rest) le entrega al panel derecho el elemento SIN los
 * campos _circ/_box (cache de render, no datos de negocio).
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
  PlanoDimension,
} from './PlanoState.ts';

type CbsWithAlert = IPlanoEngineCore & {
  _onStatusCb: ((msg: string) => void) | null;
  _onSelectCb: ((rest: unknown) => void) | null;
  _onDeleteCb: ((ids: string[]) => void) | null;
  _onAlertCb: ((title: string, msg: string) => void) | null;
  _onOpcionesCb: ((title: string, msg: string, opciones: string[]) => Promise<number>) | null;
  _onAccesorioModalCb:
    | ((data: {
        ramalId: string;
        angleDeg: number;
        junctionIndex: number;
        point: number[];
        net: string;
        isTee?: boolean;
      }) => void)
    | null;
};

export function emitStatus(engine: IPlanoEngineCore, msg: string): void {
  const eng = engine as CbsWithAlert;
  if (eng._onStatusCb) eng._onStatusCb(msg);
}

export function emitSelect(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | null,
): void {
  const eng = engine as CbsWithAlert;
  if (!eng._onSelectCb) return;
  if (!el) {
    eng._onSelectCb(null);
    return;
  }
  const rest: Record<string, unknown> = { ...el };
  delete rest._circ;
  delete rest._ghost;
  delete rest._box;
  delete rest._polyBox;
  delete rest._labelBox;
  eng._onSelectCb(rest);
}

export function emitDelete(engine: IPlanoEngineCore, ids: string[]): void {
  const eng = engine as CbsWithAlert;
  if (eng._onDeleteCb) eng._onDeleteCb(ids);
}

export function triggerAlert(engine: IPlanoEngineCore, title: string, msg: string): void {
  const eng = engine as CbsWithAlert;
  if (eng._onAlertCb) eng._onAlertCb(title, msg);
}

/** Modal de opciones: resuelve cuando el usuario elige (o -1 si cancela). */
export function triggerOpciones(
  engine: IPlanoEngineCore,
  title: string,
  msg: string,
  opciones: string[],
): Promise<number> {
  const eng = engine as CbsWithAlert;
  if (eng._onOpcionesCb) return eng._onOpcionesCb(title, msg, opciones);
  return Promise.resolve(-1);
}

export function triggerAccesorioModal(
  engine: IPlanoEngineCore,
  data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  },
): void {
  const eng = engine as CbsWithAlert;
  if (eng._onAccesorioModalCb) eng._onAccesorioModalCb(data);
}
