import { describe, it, expect } from 'vitest';
import { tribsBlockingRamalConversion } from '../../../components/pdfViewer/drawingElementContextMenu/ramalMenuHelpers';
import type { PlanoRamal } from '../PlanoState';

// Convertir un segmento de línea tributaria partida no debe bloquearse por sus hermanos ni
// por los tributarios que drenan hacia él (serán tributarios normales del ramal nuevo).
// Sí bloquea un tributario ajeno al que el segmento ENTREGA.

function T(o: Partial<PlanoRamal> & { id: string; pts: number[][] }): PlanoRamal {
  return {
    net: 'san',
    tipo: 'tributario',
    padre: null,
    totalL: 0,
    label: o.id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
    ...o,
  } as PlanoRamal;
}

function trunk(id: string): PlanoRamal {
  // Lejos de los tributarios: solo aporta la raíz por cadena de padres, sin toques.
  return T({
    id,
    tipo: 'ramal',
    label: id,
    pts: [
      [0, 200],
      [200, 200],
    ],
  });
}

describe('tribsBlockingRamalConversion', () => {
  it('línea partida limpia (solo segmentos) convierte sin alerta', () => {
    const ramales = [
      trunk('RS1'),
      // Línea T1RS1 partida en dos segmentos, unión limpia extremo-con-extremo
      T({
        id: 'TA',
        padre: 'RS1',
        label: 'T1RS1',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      T({
        id: 'TB',
        padre: 'RS1',
        label: 'T2RS1',
        pts: [
          [100, 0],
          [200, 0],
        ],
      }),
      // Ajeno lejos: no toca, no bloquea
      T({
        id: 'TF',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [300, 50],
          [300, 0],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'TA')).toEqual([]);
    expect(tribsBlockingRamalConversion(ramales, 'TB')).toEqual([]);
  });

  it('segmentos con rama lateral en la unión bloquean (unión sucia)', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'TA',
        padre: 'RS1',
        label: 'T1RS1',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      T({
        id: 'TB',
        padre: 'RS1',
        label: 'T2RS1',
        pts: [
          [100, 0],
          [200, 0],
        ],
      }),
      // Tributario que drena justo a la unión de los segmentos: la unión deja de ser limpia
      T({
        id: 'TC',
        padre: 'RS1',
        label: 'T3RS1',
        pts: [
          [100, 50],
          [100, 0],
        ],
      }),
    ];
    expect(
      tribsBlockingRamalConversion(ramales, 'TA')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['TB', 'TC']);
  });

  it('linaje de split (mergesFrom) exime aunque haya rama en la unión', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'TA',
        padre: 'RS1',
        label: 'T1RS1',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      // Downstream autocreado que continúa TA (mismo trazo físico)
      {
        ...T({
          id: 'TD',
          padre: 'RS1',
          label: 'T2RS1',
          pts: [
            [100, 0],
            [200, 0],
          ],
        }),
        mergesFrom: ['TA', 'TC'],
      } as PlanoRamal,
      T({
        id: 'TC',
        padre: 'RS1',
        label: 'T3RS1',
        pts: [
          [100, 50],
          [100, 0],
        ],
      }),
    ];
    // TA convierte: TD es su continuación (linaje) y no bloquea; TC lateral sí bloquea
    expect(tribsBlockingRamalConversion(ramales, 'TA').map((r) => r.id)).toEqual(['TC']);
  });

  it('bloquea si el segmento entrega a un tributario ajeno', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'TX',
        padre: 'RS1',
        label: 'T9RS1',
        pts: [
          [100, 0],
          [150, 0],
        ],
      }),
      // Ajeno cuyo cuerpo recibe la cabeza de TX (TX entrega a TG)
      T({
        id: 'TG',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [150, -20],
          [150, 20],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'TX').map((r) => r.id)).toEqual(['TG']);
  });

  it('rama lateral que LLEGA al cuerpo no bloquea (receptor sí convierte)', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'TA',
        padre: 'RS1',
        label: 'T1RS1',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      // Lateral de otra línea cuya cabeza cae al cuerpo de TA: TA lo recibe, no llega a él
      T({
        id: 'TL',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [50, 40],
          [50, 0],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'TA')).toEqual([]);
  });

  it('llegadas a la cola y al cuerpo convierten (receptor T1RS8)', () => {
    const ramales = [
      trunk('RS8'),
      T({
        id: 'T1',
        padre: 'RS8',
        label: 'T1RS8',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      // Lateral cuya cabeza cae justo en la COLA de T1 (lo alimenta por la entrada)
      T({
        id: 'L1',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [-40, 30],
          [0, 0],
        ],
      }),
      // Lateral cuya cabeza cae al CUERPO de T1
      T({
        id: 'L2',
        padre: 'RS9',
        label: 'T2RS9',
        pts: [
          [50, 40],
          [50, 0],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'T1')).toEqual([]);
  });

  it('extremos coincidentes en tee con tronco no bloquean (la unión es del tronco)', () => {
    const ramales = [
      // Tronco con vértice justo en el tee compartido P=(100,0)
      T({
        id: 'RS8',
        tipo: 'ramal',
        label: 'RS8',
        pts: [
          [0, 0],
          [100, 0],
          [200, 0],
        ],
      }),
      T({
        id: 'TA',
        padre: 'RS8',
        label: 'T1RS8',
        pts: [
          [0, 0],
          [100, 0],
        ],
      }),
      T({
        id: 'TB',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [100, 0],
          [100, 60],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'TA')).toEqual([]);
  });

  it('bloquea si el padre es tributario fuera de la línea', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'TF',
        padre: 'RS9',
        label: 'T1RS9',
        pts: [
          [300, 50],
          [300, 0],
        ],
      }),
      T({
        id: 'TY',
        padre: 'TF',
        label: 'T9RS9',
        pts: [
          [0, 0],
          [50, 0],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'TY').map((r) => r.id)).toEqual(['TF']);
  });

  it('no-tributario y red af con emanación normal no bloquean', () => {
    const ramales = [
      trunk('RS1'),
      T({
        id: 'FA',
        net: 'af',
        tipo: 'ramal',
        padre: null,
        label: 'RA1',
        pts: [
          [0, 0],
          [200, 0],
        ],
      }),
      T({
        id: 'FB',
        net: 'af',
        padre: 'RA1',
        label: 'T1RA1',
        pts: [
          [0, 0],
          [40, 0],
        ],
      }),
    ];
    expect(tribsBlockingRamalConversion(ramales, 'RS1')).toEqual([]);
    expect(tribsBlockingRamalConversion(ramales, 'FB')).toEqual([]);
  });
});
