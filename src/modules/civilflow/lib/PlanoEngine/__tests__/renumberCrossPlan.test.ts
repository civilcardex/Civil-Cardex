import { describe, it, expect, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY } from '../../../constants/storage-keys';
import { _renumberRamales, isPlanKeyFor, keyPlanSuffixOf } from '../networkRenumber';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Renumerar/borrar en un piso NUNCA debe tocar las claves de aparatos/hidro de OTRO piso
// (cada piso numera RS1..RSn por su cuenta). Antes, cleanOrphans borraba y migrateKeys
// movía/fusionaba claves ajenas: las UDs "amanecían vacías" tras trabajar en otro piso.

const APOS = 'civilflow_' + APARATOS_BY_TRAMO_KEY;
const HIDRO = 'civilflow_' + HYDRO_DATA_STORAGE_KEY;

function R(id: string): PlanoRamal {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 5,
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
    bloqueado: true,
  } as PlanoRamal;
}

function makeEngine(ids: string[], loadedPlanId: string): IPlanoEngineCore {
  return {
    ramales: ids.map(R),
    bajantes: [],
    _netCounts: { san: { ramal: 0, tributario: 0 } },
    _loadedPlanId: loadedPlanId,
  } as unknown as IPlanoEngineCore;
}

const readApos = () => JSON.parse(localStorage.getItem(APOS) || '{}');
const readHidro = () => JSON.parse(localStorage.getItem(HIDRO) || '{}');

beforeEach(() => {
  localStorage.clear();
});

describe('isPlanKeyFor / keyPlanSuffixOf', () => {
  it('sufijo numérico manda; sin sufijo o sin plano se procesa (legado)', () => {
    expect(keyPlanSuffixOf('san_RS1_1')).toBe('1');
    expect(keyPlanSuffixOf('san_RS1')).toBeNull();
    expect(keyPlanSuffixOf('san_RS1_planA')).toBeNull();
    expect(isPlanKeyFor('san_RS1_1', '1')).toBe(true);
    expect(isPlanKeyFor('san_RS1_1', '2')).toBe(false);
    expect(isPlanKeyFor('san_RS1', '2')).toBe(true);
    expect(isPlanKeyFor('san_RS1_1', null)).toBe(true);
  });
});

describe('_renumberRamales entre pisos', () => {
  it('cleanOrphans: borrar en P2 no borra claves de P1', () => {
    localStorage.setItem(
      APOS,
      JSON.stringify({
        san_RS1_2: { lav: 1 },
        san_RS2_2: { san: 1 },
        san_RS1_1: { lvm: 1 },
        san_RS7_1: { duc: 1 },
        san_T1RS9_1: { lav: 3 },
      }),
    );
    // P2 cargado con RS1 (RS2 se borró): renumera sin cambios de id, limpia huérfanos
    _renumberRamales(makeEngine(['RS1'], '2'), 'san');
    const a = readApos();
    // Propio: el huérfano RS2_2 sí se limpia
    expect(a['san_RS2_2']).toBeUndefined();
    expect(a['san_RS1_2']).toEqual({ lav: 1 });
    // Ajeno intacto byte a byte (aunque RS7 no exista en P2)
    expect(a['san_RS1_1']).toEqual({ lvm: 1 });
    expect(a['san_RS7_1']).toEqual({ duc: 1 });
    expect(a['san_T1RS9_1']).toEqual({ lav: 3 });
  });

  it('migrateKeys: renombrar RS4→RS2 en P2 no mueve ni fusiona claves de P1', () => {
    localStorage.setItem(
      APOS,
      JSON.stringify({
        san_RS1_2: { lav: 1 },
        san_RS4_2: { san: 1 },
        san_T1RS4_2: { duc: 2 },
        san_RS4_1: { san: 9 },
        san_T1RS4_1: { lav: 3 },
        san_RS1_1: { lvm: 1 },
      }),
    );
    localStorage.setItem(
      HIDRO,
      JSON.stringify({
        san_RS4_2: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 0 },
        san_RS4_1: { accesorios: { codo90rmSube: 2 }, Lh: 0, nSalidas: 0 },
      }),
    );
    _renumberRamales(makeEngine(['RS1', 'RS4'], '2'), 'san');
    const a = readApos();
    // Propio migra (ramal + tributario por label)
    expect(a['san_RS2_2']).toEqual({ san: 1 });
    expect(a['san_RS4_2']).toBeUndefined();
    expect(a['san_T1RS2_2']).toEqual({ duc: 2 });
    expect(a['san_T1RS4_2']).toBeUndefined();
    // Ajeno intacto (sin mover ni fusionar con RS1_1)
    expect(a['san_RS4_1']).toEqual({ san: 9 });
    expect(a['san_T1RS4_1']).toEqual({ lav: 3 });
    expect(a['san_RS1_1']).toEqual({ lvm: 1 });
    const h = readHidro();
    expect(h['san_RS2_2']?.accesorios).toEqual({ codo90rmSube: 1 });
    expect(h['san_RS4_1']?.accesorios).toEqual({ codo90rmSube: 2 });
  });
});
