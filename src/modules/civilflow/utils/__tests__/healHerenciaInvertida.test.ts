import { describe, it, expect, beforeEach } from 'vitest';
import { healHerenciaInvertida } from '../bajanteAssociation';

// Sanador del trinquete de herencia invertida (orig. usuario: 12 UD abajo → 16 al reentrar).
// Con el guard de dirección muerto, el efecto en vivo con el piso INFERIOR cargado trataba al
// bajante inferior como fuente: sumó sus UD locales (sifón+lavamanos = 4) a la herencia y
// escribió el resultado (16) en el piso SUPERIOR — claves de ramales + libro falso + espejo
// LD falso `san_LD_BAN1_<pisoSuperior>`. El sanador revierte EXACTO por libro y preserva los
// libros legítimos.

function resetStorage() {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));
const getLS = (k: string) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(k);
const parseLS = (k: string) => JSON.parse(getLS(k) || '{}');

// Piso 1 (superior, nivel 1) y piso 0 (inferior). BAN2 = bajante del piso superior que
// SUFRIÓ la inversión (libro falso 16 = 12 heredados + 4 locales del inferior); BAN1 =
// bajante inferior con libro legítimo (12 desde arriba).
function seedEnvenenado() {
  // Libro falso en el titular superior: escribió extra=16 en la clave de SU ramal RS2 del
  // piso 1 (que ya tenía 2 inodoros propios) y espejo LD falso en el piso 1.
  setLS('civilflow_trazos_1', {
    bajantes: [
      {
        id: 'BAN2',
        net: 'san',
        descargaEnId: '0|BAN1',
        ucAcum: 16,
        ucAplicado: { san_RS2_1: { sif: 3, lvm: 2, ino: 1, duc: 1 } },
      },
    ],
  });
  setLS('civilflow_trazos_0', {
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        origenId: '1|BAN2',
        ucAcum: 12,
        ucAplicado: { san_RS1_0: { sif: 2, lvm: 1, ino: 1, duc: 1 } },
      },
    ],
  });
  setLS('civilflow_aparatos_by_tramo_v2', {
    // Piso 1: RS2 tenía 2 inodoros propios + 16 escritos por la inversión
    san_RS2_1: { sif: 3, lvm: 2, ino: 3, duc: 1 },
    san_LD_BAN2_1: { sif: 3, lvm: 2, ino: 1, duc: 1 }, // espejo LD falso (piso equivocado)
    // Piso 0: herencia legítima intacta
    san_RS1_0: { sif: 2, lvm: 1, ino: 1, duc: 1 },
    san_LD_BAN2_0: { sif: 2, lvm: 1, ino: 1, duc: 1 },
  });
}

const plans = [
  { id: 1, nivel: 1 },
  { id: 0, nivel: 0 },
];

describe('healHerenciaInvertida', () => {
  beforeEach(resetStorage);

  it('revierte EXACTO el libro falso del titular superior (claves, libro y espejo LD)', () => {
    seedEnvenenado();
    expect(healHerenciaInvertida(plans)).toBe(true);
    const apos = parseLS('civilflow_aparatos_by_tramo_v2');
    // RS2 del piso 1 vuelve a sus 2 inodoros propios (16 restados por el libro)
    expect(apos.san_RS2_1).toEqual({ ino: 2 });
    // Espejo LD falso (piso equivocado) eliminado; el legítimo del piso 0 sigue
    expect(apos.san_LD_BAN2_1).toBeUndefined();
    expect(apos.san_RS1_0).toEqual({ sif: 2, lvm: 1, ino: 1, duc: 1 });
    expect(apos.san_LD_BAN2_0).toEqual({ sif: 2, lvm: 1, ino: 1, duc: 1 });
    // Libro falso fuera del trazos del piso 1; el legítimo del piso 0 intacto
    const t1 = parseLS('civilflow_trazos_1');
    expect(t1.bajantes[0].ucAplicado).toBeUndefined();
    const t0 = parseLS('civilflow_trazos_0');
    expect(t0.bajantes[0].ucAplicado).toEqual({
      san_RS1_0: { sif: 2, lvm: 1, ino: 1, duc: 1 },
    });
  });

  it('es idempotente (segunda pasada no cambia nada)', () => {
    seedEnvenenado();
    healHerenciaInvertida(plans);
    const snapshot = getLS('civilflow_aparatos_by_tramo_v2');
    const t1 = getLS('civilflow_trazos_1');
    expect(healHerenciaInvertida(plans)).toBe(false);
    expect(getLS('civilflow_aparatos_by_tramo_v2')).toBe(snapshot);
    expect(getLS('civilflow_trazos_1')).toBe(t1);
  });

  it('preserva el libro legítimo de la bomba (bombaEnId) y el de origenId a nivel superior', () => {
    setLS('civilflow_trazos_1', {
      bajantes: [
        {
          id: 'BANB',
          net: 'san',
          origenId: '2|BANC',
          ucAplicado: { san_RS9_1: { ino: 1 } },
        },
        {
          id: 'BANP',
          net: 'san',
          bombaEnId: '-1|BOMAN1-1',
          ucAplicado: { san_RS8_1: { ino: 2 } },
        },
      ],
    });
    setLS('civilflow_aparatos_by_tramo_v2', {
      san_RS9_1: { ino: 1 },
      san_RS8_1: { ino: 2 },
    });
    expect(healHerenciaInvertida([...plans, { id: 2, nivel: 2 }])).toBe(false);
    const apos = parseLS('civilflow_aparatos_by_tramo_v2');
    expect(apos.san_RS9_1).toEqual({ ino: 1 });
    expect(apos.san_RS8_1).toEqual({ ino: 2 });
    expect(parseLS('civilflow_trazos_1').bajantes[0].ucAplicado).toEqual({ san_RS9_1: { ino: 1 } });
    expect(parseLS('civilflow_trazos_1').bajantes[1].ucAplicado).toEqual({ san_RS8_1: { ino: 2 } });
  });

  it('sin niveles conocidos no hace nada (conservador)', () => {
    seedEnvenenado();
    expect(healHerenciaInvertida([{ id: 1, nivel: null }])).toBe(false);
    expect(parseLS('civilflow_aparatos_by_tramo_v2').san_RS2_1).toEqual({
      sif: 3,
      lvm: 2,
      ino: 3,
      duc: 1,
    });
  });
});
