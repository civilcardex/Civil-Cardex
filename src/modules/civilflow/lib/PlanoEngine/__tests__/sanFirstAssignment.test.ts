import { describe, it, expect } from 'vitest';
import { sanDiametroPermitido, propagarSanDiametroAguasAbajo } from '../drawingFlow';

// Primera asignación libre (orig. usuario): un alimentador sin diámetro puede tomar el que
// sea aunque supere al receptor. La SUBIDA del alimentador siempre libre — el motor propaga
// el mayor aguas abajo. La alerta solo aplica al REDUCIR el receptor por debajo del mayor
// alimentador (sanReceptorDiametroPermitido).
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

describe('sanDiametroPermitido — primera asignación libre', () => {
  const geom = () => [
    ramal({
      id: 'RS0',
      label: 'RS0',
      diametro: '',
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

  it('alimentador SIN diámetro previo: puede tomar 4" aunque el receptor sea 2"', () => {
    expect(sanDiametroPermitido(geom(), 'RS0', '4"').ok).toBe(true);
  });

  it('segunda edición: subir por encima del receptor también libre (el motor propaga aguas abajo)', () => {
    const gs = geom();
    gs[0].diametro = '2"';
    expect(sanDiametroPermitido(gs, 'RS0', '4"').ok).toBe(true);
  });

  it('asignación por debajo o igual al receptor siempre permitida', () => {
    expect(sanDiametroPermitido(geom(), 'RS0', '2"').ok).toBe(true);
  });

  it('receptor que baja por debajo del mayor alimentador SÍ bloquea', () => {
    const gs = geom();
    gs[0].diametro = '4"';
    expect(sanDiametroPermitido(gs, 'RS3', '2"').ok).toBe(false);
  });
});

describe('propagarSanDiametroAguasAbajo', () => {
  it('subida del alimentador arrastra la cadena receptora (2"→4" propaga al receptor)', () => {
    const ramales = [
      {
        id: 'RS0',
        net: 'san',
        tipo: 'ramal',
        diametro: '2"',
        pts: [
          [0, 0],
          [40, 0],
        ],
        _tribReversed: false,
      },
      {
        id: 'RS3',
        net: 'san',
        tipo: 'ramal',
        diametro: '2"',
        pts: [
          [40, 0],
          [80, 0],
        ],
        _tribReversed: false,
      },
      {
        id: 'RS5',
        net: 'san',
        tipo: 'ramal',
        diametro: '2"',
        pts: [
          [80, 0],
          [120, 0],
        ],
        _tribReversed: false,
      },
    ];
    ramales[0].diametro = '4"';
    propagarSanDiametroAguasAbajo(ramales, 'RS0');
    expect(ramales[1].diametro).toBe('4"');
    expect(ramales[2].diametro).toBe('4"');
  });

  it('receptor ya mayor: no baja, y el flujo aguas abajo sigue con su diámetro', () => {
    const ramales = [
      {
        id: 'RS0',
        net: 'san',
        tipo: 'ramal',
        diametro: '4"',
        pts: [
          [0, 0],
          [40, 0],
        ],
        _tribReversed: false,
      },
      {
        id: 'RS3',
        net: 'san',
        tipo: 'ramal',
        diametro: '6"',
        pts: [
          [40, 0],
          [80, 0],
        ],
        _tribReversed: false,
      },
      {
        id: 'RS5',
        net: 'san',
        tipo: 'ramal',
        diametro: '2"',
        pts: [
          [80, 0],
          [120, 0],
        ],
        _tribReversed: false,
      },
    ];
    propagarSanDiametroAguasAbajo(ramales, 'RS0');
    expect(ramales[1].diametro).toBe('6"');
    expect(ramales[2].diametro).toBe('6"');
  });

  it('sin receptor en el punto de descarga: no hace nada', () => {
    const ramales = [
      {
        id: 'RS0',
        net: 'san',
        tipo: 'ramal',
        diametro: '4"',
        pts: [
          [0, 0],
          [40, 0],
        ],
        _tribReversed: false,
      },
      {
        id: 'RS3',
        net: 'san',
        tipo: 'ramal',
        diametro: '2"',
        pts: [
          [100, 0],
          [140, 0],
        ],
        _tribReversed: false,
      },
    ];
    propagarSanDiametroAguasAbajo(ramales, 'RS0');
    expect(ramales[1].diametro).toBe('2"');
  });
});
