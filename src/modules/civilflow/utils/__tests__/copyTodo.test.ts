import { describe, it, expect, beforeEach } from 'vitest';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys';
import { copyDrawingFromPlan } from '../copyDrawingFromPlan';

// Copiar elementos copia TODO: geometría + estructura remapeada + datos hidráulicos
// (diámetros, materiales, accesorios, aparatos, fixtures) y conteos remapeados a los ids
// nuevos del piso destino (orig. usuario).

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
          ucAplicado: { RS1: { san: 1 }, RS9: { san: 5 } },
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
  localStorage.setItem('civilflow_' + GAS_ACC_KEY, JSON.stringify({ gas_RS1_99: { acc: 1 } }));
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
const readGas = () => JSON.parse(localStorage.getItem('civilflow_' + GAS_ACC_KEY) || '{}');

beforeEach(() => {
  localStorage.clear();
  seedSource();
});

describe('copyDrawingFromPlan copia todo', () => {
  it('geometría + hidráulicos + conteos remapeados; estructura y origen intactos', () => {
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
    // Datos hidráulicos viajan
    expect(rs.diametro).toBe('4"');
    expect(rs.material).toBe('PVC-S');
    expect(rs.accesorioFin).toBe('codo90rmSube');
    expect(rs.aparatoInicio).toBe('san');
    expect(rs.uc).toBe(3);

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
    expect(trib.diametro).toBe('2"');

    const bj = eng.bajantes.find((b) => b.id !== undefined) as unknown as Record<string, unknown>;
    expect([bj.x, bj.y]).toEqual([0, 0]);
    expect(bj.dNominal).toBe('4"');
    expect(bj.ucAcum).toBe(7);
    expect(bj.recibeDeIds).toEqual([rs.id]);
    // Libro de herencia remapeado (RS1→RS2) y sin el id no copiado (RS9 fuera)
    expect(bj.ucAplicado).toEqual({ [rs.id as string]: { san: 1 } });
    // Punteros entre pisos fuera
    expect(bj.descargaEnId ?? null).toBeNull();
    expect(bj.desplazamientos).toBeUndefined();

    // Conteos remapeados al piso destino con los ids nuevos
    expect(readApos()[`san_${rs.id}_100`]).toEqual({ san: 1 });
    expect(readApos()[`san_${bj.id}_100`]).toEqual({ duc: 2 });
    expect(readHidro()[`san_${rs.id}_100`]).toEqual({
      accesorios: { codo90rmSube: 1 },
      Lh: 0,
      nSalidas: 0,
    });
    expect(readGas()[`gas_${rs.id}_100`]).toEqual({ acc: 1 });
    // Origen intacto
    expect(readApos()['san_RS1_99']).toEqual({ san: 1 });
    expect(readApos()['san_BAN1_99']).toEqual({ duc: 2 });
  });
});
