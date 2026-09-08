import { describe, it, expect } from 'vitest';
import {
  sanMinDiamPulgForApparatus,
  sanDiamAllowedForApparatus,
  sanDiamLabelAllowedForApparatus,
  sanMaxFeederDiam,
  sanFeederMinMsg,
  INODORO_APP_ID,
} from '../sanitaryDiamCompat';
import {
  sanReceptorDiametroPermitido,
  sanDiametroPermitido,
} from '../../lib/PlanoEngine/drawingFlow';
import { computeSanRows } from '../sanRows';
import type { Tramo } from '../../context/tramosReducer';

// Ítems 7/8: la regla "inodoro → 4" mínimo" es una sola fuente de verdad, consistente
// entre asignación automática, panel derecho y menú contextual.

describe('sanitaryDiamCompat — regla central', () => {
  it('inodoro exige mínimo 4"', () => {
    expect(sanMinDiamPulgForApparatus(INODORO_APP_ID)).toBe(4);
    expect(sanDiamAllowedForApparatus(4, INODORO_APP_ID)).toBe(true);
    expect(sanDiamAllowedForApparatus(6, INODORO_APP_ID)).toBe(true);
    expect(sanDiamAllowedForApparatus(2, INODORO_APP_ID)).toBe(false);
    expect(sanDiamAllowedForApparatus(3, INODORO_APP_ID)).toBe(false);
  });

  it('otros aparatos no restringen el diámetro (el 2" es solo relleno)', () => {
    expect(sanMinDiamPulgForApparatus('lv')).toBe(0);
    expect(sanDiamAllowedForApparatus(2, 'lv')).toBe(true);
    expect(sanDiamAllowedForApparatus(1.5, 'lv')).toBe(true);
    expect(sanDiamAllowedForApparatus(4, 'lv')).toBe(true);
  });

  it('sin aparato (null/undefined) no restringe', () => {
    expect(sanMinDiamPulgForApparatus(undefined)).toBe(0);
    expect(sanMinDiamPulgForApparatus(null)).toBe(0);
    expect(sanDiamAllowedForApparatus(1, null)).toBe(true);
    expect(sanDiamAllowedForApparatus(2, undefined)).toBe(true);
  });

  it('valida desde la etiqueta completa del diámetro', () => {
    expect(sanDiamLabelAllowedForApparatus('4" — 100 mm', INODORO_APP_ID)).toBe(true);
    expect(sanDiamLabelAllowedForApparatus('2" — 50 mm', INODORO_APP_ID)).toBe(false);
    expect(sanDiamLabelAllowedForApparatus('1/2" — 12.7 mm', INODORO_APP_ID)).toBe(false);
    expect(sanDiamLabelAllowedForApparatus('1/2" — 12.7 mm', 'lv')).toBe(true);
  });
});

const tramo = (o: Record<string, unknown>) =>
  ({ planId: 1, piso: 1, fixtures: {}, tipo: 'ramal', ...o }) as unknown as Tramo;

// Receptor ≥ alimentador: el ramal que recibe no puede quedar menor que el mayor ramal padre.
describe('sanitaria — receptor >= alimentador (tabla)', () => {
  const byKey = (ts: Tramo[]) => {
    const m = new Map(ts.map((t) => [t._key || t.id, t]));
    return (k: string) => m.get(k);
  };
  it('toma el mayor entre ramales padre e ignora tributarios/bajantes', () => {
    const ts = [
      tramo({ id: 'RS0', _key: 'RS0-1', diamDisPulg: 4, label: 'RS0' }),
      tramo({ id: 'RS9', _key: 'RS9-1', diamDisPulg: 3, label: 'RS9' }),
      tramo({ id: 'T1', _key: 'T1-1', tipo: 'tributario', diamDisPulg: 6, label: 'T1RS1' }),
      tramo({ id: 'B1', _key: 'B1-1', esBajante: true, diamDisPulg: 6, label: 'B1' }),
      tramo({ id: 'RSX', _key: 'RSX-1', label: 'RSX' }),
    ];
    const feeder = sanMaxFeederDiam(['RS0-1', 'RS9-1', 'T1-1', 'B1-1', 'RSX-1'], byKey(ts));
    expect(feeder).toEqual({ pulg: 4, label: 'RS0' });
  });

  it('sin padres con diámetro no restringe', () => {
    const ts = [tramo({ id: 'RS0', _key: 'RS0-1', label: 'RS0' })];
    expect(sanMaxFeederDiam(['RS0-1'], byKey(ts))).toBeNull();
    expect(sanMaxFeederDiam(['ZZ-9'], byKey(ts))).toBeNull();
  });

  it('mensaje canónico menciona alimentador y mínimo', () => {
    expect(sanFeederMinMsg('RS1', 4)).toContain('RS1');
    expect(sanFeederMinMsg('RS1', 4)).toContain('4"');
  });
});

// Misma regla en dibujo: geometría del motor en vez de fullChildrenMap.
describe('sanitaria — receptor >= alimentador (dibujo)', () => {
  type EngRamal = {
    id: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
    label?: string;
    fin?: string;
    mergesFrom?: string[];
  };
  const ramal = (o: EngRamal): EngRamal => ({ net: 'san', tipo: 'ramal', ...o });
  const geom = () => [
    ramal({
      id: 'RS1',
      label: 'RS1',
      diametro: '4"',
      pts: [
        [0, 0],
        [40, 0],
      ],
    }),
    ramal({
      id: 'RS3',
      label: 'RS3',
      diametro: '2"',
      pts: [
        [40, 0],
        [80, 0],
      ],
    }),
  ];
  it('bloquea receptor menor que el padre y permite igual/mayor', () => {
    expect(sanReceptorDiametroPermitido(geom(), 'RS3', '2"').ok).toBe(false);
    expect(sanReceptorDiametroPermitido(geom(), 'RS3', '4"').ok).toBe(true);
    expect(sanReceptorDiametroPermitido(geom(), 'RS3', '6"').ok).toBe(true);
  });

  it('el padre puede reducirse libremente (el receptor ya es mayor)', () => {
    expect(sanReceptorDiametroPermitido(geom(), 'RS1', '2"').ok).toBe(true);
  });

  it('tributarios SÍ restringen al receptor (regla vigente: el mayor de los llegadores manda)', () => {
    const gs: EngRamal[] = [
      ...geom(),
      {
        net: 'san',
        tipo: 'tributario',
        id: 'T1',
        label: 'T1RS3',
        diametro: '4"',
        pts: [
          [60, 20],
          [60, 0],
        ],
      },
    ];
    expect(sanReceptorDiametroPermitido(gs, 'RS3', '3"').ok).toBe(false); // RS1 4" sigue mandando
    const solo: EngRamal[] = [
      ramal({
        id: 'RS3',
        label: 'RS3',
        diametro: '2"',
        pts: [
          [40, 0],
          [80, 0],
        ],
      }),
      {
        net: 'san',
        tipo: 'tributario',
        id: 'T1',
        label: 'T1RS3',
        diametro: '4"',
        pts: [
          [60, 20],
          [60, 0],
        ],
      },
    ];
    // El tributario 4" que llega a RS3 ahora restringe: bajar RS3 a 2" dispara la alerta.
    expect(sanReceptorDiametroPermitido(solo, 'RS3', '2"').ok).toBe(false);
  });

  it('candidato con fin hacia otro elemento no alimenta (co-sumidero al bajante)', () => {
    const gs: EngRamal[] = [
      ramal({
        id: 'RS1',
        label: 'RS1',
        diametro: '4"',
        pts: [
          [0, 0],
          [40, 0],
        ],
        fin: 'B1',
      }),
      ramal({
        id: 'RS2',
        label: 'RS2',
        diametro: '2"',
        pts: [
          [80, 0],
          [40, 0],
        ],
        fin: 'B1',
      }),
    ];
    expect(sanReceptorDiametroPermitido(gs, 'RS2', '2"').ok).toBe(true);
  });
});

// Dirección SUBIDA: libre — el motor propaga el mayor aguas abajo (recomputeDownstream-
// Diameters); la alerta solo aplica al REDUCIR el receptor por debajo del mayor alimentador.
describe('sanitaria — alimentador <= receptor: subida libre con propagación', () => {
  type EngRamal = {
    id: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
    label?: string;
    fin?: string;
    mergesFrom?: string[];
  };
  const ramal = (o: EngRamal): EngRamal => ({ net: 'san', tipo: 'ramal', ...o });
  const geom = () => [
    ramal({
      id: 'RS0',
      label: 'RS0',
      diametro: '4"',
      pts: [
        [0, 0],
        [40, 0],
      ],
    }),
    ramal({
      id: 'RS3',
      label: 'RS3',
      diametro: '2"',
      pts: [
        [40, 0],
        [80, 0],
      ],
    }),
  ];
  it('permite subir el alimentador por encima de su receptor (propagación automática)', () => {
    expect(sanDiametroPermitido(geom(), 'RS0', '6"').ok).toBe(true);
  });

  it('permite igualar al receptor y reducirse (sin alimentadores propios)', () => {
    expect(sanDiametroPermitido(geom(), 'RS0', '4"').ok).toBe(true);
    expect(sanDiametroPermitido(geom(), 'RS0', '2"').ok).toBe(true);
  });

  it('fin hacia un bajante (no ramal) libera la restricción de subida', () => {
    const gs: EngRamal[] = [
      ramal({
        id: 'RS0',
        label: 'RS0',
        diametro: '4"',
        pts: [
          [0, 0],
          [40, 0],
        ],
        fin: 'B1',
      }),
      ramal({
        id: 'RS3',
        label: 'RS3',
        diametro: '2"',
        pts: [
          [40, 0],
          [80, 0],
        ],
      }),
    ];
    expect(sanDiametroPermitido(gs, 'RS0', '6"').ok).toBe(true);
  });

  it('la bajada del receptor sigue bloqueada por el alimentador (regla original intacta)', () => {
    expect(sanDiametroPermitido(geom(), 'RS3', '2"').ok).toBe(false);
  });
});

// UD propia incluye tributarios (directos y anidados): con solo tributarios, propia == total.
describe('sanitaria — propia incluye tributarios anidados', () => {
  const base = [{ id: 'lv', nombre: 'Lavamanos', ud: 2 }];
  it('ramal + tributario + nieto: propia == total', () => {
    const all = [
      tramo({ id: 'RS1', _key: 'RS1-1', fixtures: { lv: 1 } }),
      tramo({
        id: 'T1RS1',
        _key: 'T1RS1-1',
        tipo: 'tributario',
        padre: 'RS1',
        fixtures: { lv: 1 },
      }),
      tramo({ id: 'T2', _key: 'T2-1', tipo: 'tributario', padre: 'T1RS1', fixtures: { lv: 1 } }),
    ];
    const rows = computeSanRows([all[0]], { 'RS1-1': 6 }, base, all, {
      'RS1-1': ['T1RS1-1'],
      'T1RS1-1': ['T2-1'],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].udPropias).toBe(6);
    expect(rows[0].udAcum).toBe(6);
  });

  it('con ramal padre aguas arriba, total supera a propia', () => {
    const all = [
      tramo({ id: 'RS1', _key: 'RS1-1', fixtures: { lv: 1 } }),
      tramo({ id: 'RS0', _key: 'RS0-1', fixtures: { lv: 1 } }),
      tramo({
        id: 'T1RS1',
        _key: 'T1RS1-1',
        tipo: 'tributario',
        padre: 'RS1',
        fixtures: { lv: 1 },
      }),
    ];
    const rows = computeSanRows([all[0]], { 'RS1-1': 6 }, base, all, {
      'RS1-1': ['RS0-1', 'T1RS1-1'],
    });
    expect(rows[0].udPropias).toBe(4);
    expect(rows[0].udAcum).toBe(6);
  });
});
