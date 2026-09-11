import { describe, it, expect, beforeEach } from 'vitest';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys';
import { copyDrawingFromPlan } from '../copyDrawingFromPlan';

// Copiar elementos solo copia la POSICIÓN: geometría + estructura remapeada, sin ningún
// dato hidráulico (diámetros, materiales, accesorios, aparatos, conteos).

function seedSource() {
  localStorage.setItem(
    'civilflow_trazos_99',
    JSON.stringify({
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          padre: null,
          pts: [
            [0, 0],
            [100, 0],
          ],
          totalL: 100,
          label: 'RS1',
          diametro: '4"',
          material: 'PVC-S',
          pendiente: 2,
          accesorioFin: 'codo90rmSube',
          aparatoInicio: 'san',
          uc: 3,
          labelX: 50,
          labelY: 0,
          labelAngle: 0,
          bloqueado: false,
        },
        {
          id: 'TOPAQUE1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [50, 0],
            [50, 40],
          ],
          totalL: 40,
          label: 'T1RS1',
          diametro: '2"',
          material: 'PVC-S',
          labelX: 0,
          labelY: 0,
          labelAngle: 0,
          bloqueado: true,
        },
      ],
      bajantes: [
        {
          id: 'BAN1',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN1',
          x: 0,
          y: 0,
          dNominal: '4"',
          recibeDeIds: ['RS1'],
          ucAcum: 7,
          ucExtra: 0,
          area_m2: 1,
          descargaEnId: '1|BAN9',
          desplazamientos: { P9: { dx: 1, dy: 1 } },
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ san_RS1_99: { san: 1 }, san_BAN1_99: { duc: 2 } }),
  );
  localStorage.setItem(
    'civilflow_' + HYDRO_DATA_STORAGE_KEY,
    JSON.stringify({ san_RS1_99: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 0 } }),
  );
  localStorage.setItem('civilflow_' + GAS_ACC_KEY, JSON.stringify({}));
}

function makeEngine() {
  const eng = {
    ramales: [] as Record<string, unknown>[],
    bajantes: [] as Record<string, unknown>[],
    crossFloorGhosts: [],
    _netCounts: { san: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    _dirty: false,
    _markDirty: () => {},
    render: () => {},
    saveWork: () => ({ ramales: eng.ramales, bajantes: eng.bajantes }),
  };
  return eng;
}

const readApos = () =>
  JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
const readHidro = () =>
  JSON.parse(localStorage.getItem('civilflow_' + HYDRO_DATA_STORAGE_KEY) || '{}');

beforeEach(() => {
  localStorage.clear();
  seedSource();
});

describe('copyDrawingFromPlan solo posición', () => {
  it('geometría idéntica, datos reseteados, conteos sin claves nuevas, estructura remapeada', () => {
    const eng = makeEngine();
    // El piso destino ya tiene su RS1: la copia toma el consecutivo siguiente
    eng.ramales.push({
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      label: 'RS1',
      pts: [
        [0, 100],
        [10, 100],
      ],
    });
    const res = copyDrawingFromPlan(eng as never, '100', '99', [
      { netId: 'san', tipos: new Set(['ramal', 'tributario', 'bajante']) },
    ]);
    expect(res.copied).toBe(3);

    const rs = eng.ramales.find((r) => r.tipo === 'ramal' && r.id !== 'RS1') as unknown as Record<
      string,
      unknown
    >;
    expect(rs.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(rs.id).toBe('RS2');
    expect(rs.diametro).toBe('');
    expect(rs.material).toBe('');
    expect(rs.accesorioFin || '').toBe('');
    expect(rs.aparatoInicio || '').toBe('');
    expect(rs.uc).toBe(0);

    const trib = eng.ramales.find((r) => r.tipo === 'tributario') as unknown as Record<
      string,
      unknown
    >;
    expect(trib.pts).toEqual([
      [50, 0],
      [50, 40],
    ]);
    // Estructura: el padre apunta al ramal NUEVO, no al viejo RS1
    expect(trib.padre).toBe(rs.id);
    expect(trib.diametro).toBe('');

    const bj = eng.bajantes.find((b) => b.id !== undefined) as unknown as Record<string, unknown>;
    expect([bj.x, bj.y]).toEqual([0, 0]);
    expect(bj.dNominal).toBe('');
    expect(bj.ucAcum).toBe(0);
    expect(bj.recibeDeIds).toEqual([rs.id]);
    // Punteros entre pisos fuera
    expect(bj.descargaEnId ?? null).toBeNull();
    expect(bj.desplazamientos).toBeUndefined();

    // Sin claves nuevas de conteos en el piso destino
    expect(Object.keys(readApos()).filter((k) => k.endsWith('_100'))).toEqual([]);
    expect(Object.keys(readHidro()).filter((k) => k.endsWith('_100'))).toEqual([]);
    // Origen intacto
    expect(readApos()['san_RS1_99']).toEqual({ san: 1 });
  });
});
