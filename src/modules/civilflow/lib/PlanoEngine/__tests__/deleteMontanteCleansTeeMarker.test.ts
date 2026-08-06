import { describe, it, expect } from 'vitest';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Un montante a mitad de cuerpo escribe un marcador de tee (accMed) en su ramal anfitrión al crearse.
// Borrar el montante sin limpiar también ese marcador dejaba el glifo/contador de tee para siempre,
// porque nada más vuelve a revisar accMed una vez escrito — ver cleanupTeeMarkersAt en deleteSelected.ts.

function makeRamal(id: string, pts: number[][], accMed: Record<string, string>): PlanoRamal {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    accMed,
    totalL: 0,
    label: id,
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
    bloqueado: false,
  } as PlanoRamal;
}

function makeMontante(id: string, x: number, y: number): PlanoBajante {
  return {
    id,
    net: 'gas',
    tipo: 'montante',
    code: id,
    x,
    y,
    labelX: x,
    labelY: y + 20,
    labelAngle: 0,
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    origenId: null,
    dNominal: '',
    direccion: 'baja',
    _circ: { x, y, r: 8 },
  } as unknown as PlanoBajante;
}

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    crossFloorGhosts: [],
    selId: null,
    _isGhostSel: false,
    _yeeFlashKey: null,
    // Dejado en undefined a propósito: omite el barrido de almacenamiento de ghosts entre pisos en
    // deleteSelected, que toca localStorage — irrelevante para este test y no disponible en el entorno
    // vitest de node.
    _loadedPlanId: undefined,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    render: () => {},
    _markDirty: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('deleteSelected — montante deletion cleans up its host ramal tee marker', () => {
  it('clears accMed at the montante position when the montante is deleted', () => {
    const host = makeRamal(
      'RS1',
      [
        [0, 0],
        [10, 0],
        [50, 0],
      ],
      { accMed1: 'teeSube' },
    );
    const montante = makeMontante('M1', 10, 0);
    const engine = makeEngine([host], [montante]);

    deleteSelected(engine, ['M1']);

    expect(engine.bajantes.find((b) => b.id === 'M1')).toBeUndefined();
    expect(host.accMed?.accMed1).toBeUndefined();
  });

  it('does NOT clear the tee marker if another bajante still sits at that junction', () => {
    const host = makeRamal(
      'RS1',
      [
        [0, 0],
        [10, 0],
        [50, 0],
      ],
      { accMed1: 'teeSube' },
    );
    const montante = makeMontante('M1', 10, 0);
    const stillThere = makeMontante('M2', 10, 0); // mismo punto, sobrevive al borrado
    const engine = makeEngine([host], [montante, stillThere]);

    deleteSelected(engine, ['M1']);

    expect(host.accMed?.accMed1).toBe('teeSube');
  });
});
