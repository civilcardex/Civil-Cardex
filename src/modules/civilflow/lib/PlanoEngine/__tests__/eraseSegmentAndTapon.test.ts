import { describe, it, expect, beforeEach } from 'vitest';
import { eraseRamalAt } from '../drawingErase';
import { preserveYeeDobleAt, placeTaponOnHost } from '../deleteYeePreserve';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Orig. usuario: (1) borrar un segmento debe funcionar en CUALQUIER ramal — mitades de
// división (mergesFrom), conectados por guía, etc.; (2) al borrar un brazo lateral de una
// yee doble, el símbolo persiste y el punto queda tapado con tapón al diámetro del brazo
// principal (dibujo + hidroData).

function setLocalStorage(key: string, val: unknown) {
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + key,
    JSON.stringify(val),
  );
}

function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}

function getStore(key: string): Record<string, { accesorios?: Record<string, number> }> {
  const raw = (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
    'civilflow_' + key,
  );
  return raw ? (JSON.parse(raw) as Record<string, { accesorios?: Record<string, number> }>) : {};
}

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [100, 0],
    ],
    totalL: 0,
    label: 'R',
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
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _netCounts: {
      san: { ramal: 5, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    deleteSelected: function (ids?: string[], opts?: { noMerge?: boolean }) {
      _deleteSelected(this as unknown as IPlanoEngineCore, ids, opts);
    },
  };
  return engine as IPlanoEngineCore;
}

describe('borrador por segmentos sin excepciones', () => {
  beforeEach(() => resetStorage());

  it('mitad de división (mergesFrom) se puede recortar por el extremo sin borrar el clúster', () => {
    const half = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      mergesFrom: ['RS1', 'T1788'],
    });
    const other = R({ id: 'RS1', label: 'RS1' });
    const eng = makeEngine([half, other]);
    // Clic sobre el segmento extremo derecho (cerca de [100,0]).
    eraseRamalAt(eng, half, 98, 0);
    expect(half.pts.length).toBe(2);
    expect(half.pts[1]).toEqual([50, 0]);
    // El clúster sigue intacto: ni RS1 ni la rama entrante fueron borrados.
    expect(eng.ramales.some((r) => r.id === 'RS1')).toBe(true);
    expect(eng.ramales.length).toBe(2);
  });

  it('segmento intermedio de una mitad de división parte el ramal en dos', () => {
    const half = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 0],
        [40, 0],
        [80, 0],
        [120, 0],
      ],
      mergesFrom: ['RS1', 'T1788'],
    });
    const eng = makeEngine([half]);
    // Clic sobre el segmento central [40,0]-[80,0].
    eraseRamalAt(eng, half, 60, 0);
    expect(eng.ramales.length).toBe(2);
    expect(half.pts).toEqual([
      [0, 0],
      [40, 0],
    ]);
  });

  it('polilínea recta con vértice de unión se recorta por segmento (no borra todo)', () => {
    const straight = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([straight]);
    eraseRamalAt(eng, straight, 98, 0);
    expect(straight.pts.length).toBe(2);
    expect(eng.ramales.length).toBe(1);
  });
});

describe('yee doble: símbolo persiste y tapón automático', () => {
  beforeEach(() => resetStorage());

  it('brazo lateral (tributario) con yeeDobleAt propia: tapón en el puerto (regla consolidada: tributario tapa)', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    const host = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [0, 50],
        [0, 100],
      ],
      diametro: '4"',
      yeeDobleAt: [
        [0, 40],
        [0, 60],
      ],
    });
    const lateral = R({
      id: 'T1788',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [40, 60],
        [0, 60],
      ],
      yeeDobleAt: [
        [0, 40],
        [0, 60],
      ],
    });
    const eng = makeEngine([host]);
    preserveYeeDobleAt(eng, lateral);
    // Regla consolidada (orig. usuario): borrar el LATERAL TRIBUTARIO deja la pierna abierta
    // → tapón en el puerto [0,60] (anclado en vértice insertado sobre el tronco vertical).
    expect(host.yeeDobleAt).toEqual([
      [0, 40],
      [0, 60],
    ]);
    expect(Object.values(host.accMed || {}).includes('tapon')).toBe(true);
    expect(host.pts).toEqual([
      [0, 0],
      [0, 50],
      [0, 60],
      [0, 100],
    ]);
    const hidro = getStore('tramo_hidro_data_v3');
    expect(hidro['san_RS1_1']?.accesorios?.['tapon']).toBe(1);
  });

  it('tributario sin bandera que toca un punto de yee del host → tapón en accMed (vértice intermedio)', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    const host = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [0, 50],
        [0, 100],
      ],
      diametro: '3"',
      yeeDobleAt: [
        [0, 40],
        [0, 60],
      ],
    });
    const trib = R({
      id: 'T1788',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [30, 60],
        [0, 60],
      ],
    });
    const eng = makeEngine([host]);
    // caminos reales: deleteSelected llama preserveYeeDobleAt (no aplica, sin bandera) y el
    // bloque de tapón por proximidad usa el punto de yee más cercano al borrado.
    const yp = host.yeeDobleAt![1];
    placeTaponOnHost(eng, host, yp);
    void trib;
    // (0,60) cae a mitad del segmento [0,50]-[0,100] → vértice insertado, accMed2.
    expect(host.accMed?.accMed2).toBe('tapon');
    expect(host.accesorioFin).toBeFalsy();
    const hidro = getStore('tramo_hidro_data_v3');
    expect(hidro['san_RS1_1']?.accesorios?.['tapon']).toBe(1);
  });

  it('punto de yee en extremo del host → tapón en accesorioFin con diámetro del host', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    const host = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [0, 60],
      ],
      diametro: '4"',
      yeeDobleAt: [
        [0, 40],
        [0, 60],
      ],
    });
    const eng = makeEngine([host]);
    placeTaponOnHost(eng, host, host.yeeDobleAt![1]);
    expect(host.accesorioFin).toBe('tapon');
    expect(host.diametroFin).toBe('4"');
  });

  it('flujo real: borrar el lateral T1RS2 (Supr/borrador) deja la yee en el tronco SIN tapón', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    // Tronco vertical con las dos uniones de la yee doble; la bandera vive SOLO en él
    // (networkSanitary escribe en todos los participantes, incluido el tronco).
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [0, 40],
        [0, 100],
      ],
      diametro: '4"',
      yeeDobleAt: [
        [0, 40],
        [0, 60],
      ],
    });
    const lateral = R({
      id: 'T1788',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [30, 60],
        [0, 60],
      ],
    });
    const eng = makeEngine([tronco, lateral]);
    eng.selId = 'T1788';
    eraseRamalAt(eng, lateral, 25, 60);
    // El lateral desapareció; el tronco conserva el símbolo SIN tapón (regla vigente: borrar
    // un lateral no tapa — orig. usuario revocó el tapón del lateral).
    expect(eng.ramales.some((r) => r.id === 'T1788')).toBe(false);
    expect(eng.ramales.some((r) => r.id === 'RS1')).toBe(true);
    expect(tronco.yeeDobleAt).toBeDefined();
    expect(tronco.pts.some((p) => p[0] === 0 && p[1] === 60)).toBe(false);
    expect(Object.values(tronco.accMed || {})).not.toContain('tapon');
    const hidro = getStore('tramo_hidro_data_v3');
    expect(hidro['san_RS1_1']?.accesorios?.['tapon']).toBeUndefined();
  });

  it('yee en un solo punto (4 vectores, par degenerado [P,P]): borrar el brazo principal conserva glifo + tapón', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    // Las dos salidas caen en el MISMO punto del tronco — la unión tiene 4 vectores, no forma
    // par [A,B], y su bandera es [P,P] (la escribe el render por-unión).
    const brazo = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 40],
        [0, 100],
      ],
      diametro: '4"',
      yeeDobleAt: [
        [0, 60],
        [0, 60],
      ],
    });
    const lat1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [-21.2, 81.2],
        [0, 60],
      ],
      yeeDobleAt: [
        [0, 60],
        [0, 60],
      ],
    });
    const lat2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      label: 'T2RS1',
      pts: [
        [21.2, 81.2],
        [0, 60],
      ],
      yeeDobleAt: [
        [0, 60],
        [0, 60],
      ],
    });
    const eng = makeEngine([brazo, lat1, lat2]);
    eng.selId = 'RS1';
    eraseRamalAt(eng, brazo, 0, 90);
    expect(eng.ramales.some((r) => r.id === 'RS1')).toBe(false);
    // Los sobrevivientes conservan la bandera → el glifo persistido sigue dibujándose.
    expect(lat1.yeeDobleAt).toBeDefined();
    expect(lat2.yeeDobleAt).toBeDefined();
    // Tapón en el punto liberado sobre un sobreviviente.
    const taponEn =
      lat1.accesorioFin === 'tapon' ||
      lat2.accesorioFin === 'tapon' ||
      Object.values(lat1.accMed || {}).includes('tapon') ||
      Object.values(lat2.accMed || {}).includes('tapon');
    expect(taponEn).toBe(true);
    const hidro = getStore('tramo_hidro_data_v3');
    const totalTapon = Object.values(hidro).reduce(
      (s, e) => s + (e?.accesorios?.['tapon'] || 0),
      0,
    );
    expect(totalTapon).toBeGreaterThan(0);
  });
});
