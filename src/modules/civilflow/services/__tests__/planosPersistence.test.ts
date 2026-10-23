import { describe, it, expect, beforeEach, vi } from 'vitest';

// PERSISTENCIA DE PLANOS: asociación montante↔ramal y elementos por piso.
//
// Qué se verifica aquí (los 5 escenarios que pidió el usuario):
//  A) Asociar un montante con un ramal, "cerrar" (borrar la caché local) y "abrir de nuevo"
//     (leer de BD) → la asociación y sus aparatos siguen ahí.
//  B) Varios pisos con elementos → cada uno recupera SUOS y no los del vecino.
//  C) Modificar en un piso no toca el otro.
//  D) El cambio de piso (persistTrazosSnapshot) deja el doc con ts FRESCO y lo sube a BD.
//  E) El guardado se completa (await) antes de darlo por persistido; el local se escribe
//     de inmediato y la BD confirma.
//
// Causa raíz que estos tests fijan: la asociación a mano vivía en `asocManual` + en los ids de
// RAMAL dentro de recibeDeIds/alimentaIds. El RPC `save_plano_data` sólo reconstruye
// `cf_bajante_conexiones` (BAJANTE→BAJANTE) y no tenía columna para `asocManual` → ambos se
// perdían en el viaje a BD. La columna `asoc_links` los lleva; el simulador de BD de este
// archivo replica la semántica real del RPC (las conexiones sólo resuelven bajante→bajante).

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: mockRpc,
  },
}));

import { saveTrazosToDB, loadTrazosFromDB } from '../storageService.ts';
import { persistTrazosSnapshot } from '../../components/pdfViewer/persistStrokes.ts';
import { aplicarEnDocDePlan } from '../../utils/writePlanDoc.ts';

type Row = Record<string, unknown>;

/** BD simulada: guarda el payload de cada plano y lo sirve como lo haría el RPC real. */
const db: Record<string, { bajantes: Row[]; ramales: Row[]; header: Row }> = {};

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
  (globalThis as unknown as { window: unknown }).window = {
    ...globalThis,
    dispatchEvent: () => true,
  };
}

const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));
const getLS = (k: string) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(k);
const delLS = (k: string) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.removeItem(k);

/** El RPC real devuelve la fila de la tabla (to_jsonb) → la fila es el payload sin las
 *  columnas de servidor. */
function filaDeBajante(b: Row): Row {
  const f = { ...b };
  delete f.plano_id;
  delete f.user_id;
  return f;
}

beforeEach(() => {
  resetStorage();
  for (const k of Object.keys(db)) delete db[k];
  mockRpc.mockReset();
  mockRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'save_plano_data') {
      const payload = args.p_data as {
        header: Row;
        bajantes: Row[];
        ramales: Row[];
      };
      db[String(args.p_plano_id)] = {
        header: payload.header,
        bajantes: (payload.bajantes ?? []).map(filaDeBajante),
        ramales: (payload.ramales ?? []).map(filaDeBajante),
      };
      return { data: null, error: null };
    }
    if (name === 'get_plano_data') {
      const planId = String(args.p_plano_id);
      const stored = db[planId];
      if (!stored) return { data: null, error: null };
      // Réplica del RPC: `cf_bajante_conexiones` sólo enlaza BAJANTE→BAJANTE del mismo plano
      // (el join contra el mapa de bajantes descarta los ids de RAMAL).
      const bajIds = new Set(stored.bajantes.map((b) => b.client_id as string));
      const conexiones: Row[] = [];
      for (const b of stored.bajantes) {
        for (const dest of (b.recibe_de_ids as string[]) ?? []) {
          if (bajIds.has(dest))
            conexiones.push({
              origen_client_id: b.client_id,
              destino_client_id: dest,
              tipo: 'recibe',
            });
        }
        for (const dest of (b.alimenta_ids as string[]) ?? []) {
          if (bajIds.has(dest))
            conexiones.push({
              origen_client_id: b.client_id,
              destino_client_id: dest,
              tipo: 'alimenta',
            });
        }
      }
      return {
        data: {
          plano: { version: 6, ts: stored.header.ts, scale_m: stored.header.scaleM },
          bajantes: stored.bajantes,
          ramales: stored.ramales,
          bajante_conexiones: conexiones,
          areas: [],
          dimensiones: [],
          anotaciones_texto: [],
          lineas_guia: [],
          fantasmas_entrepisos: [],
        },
        error: null,
      };
    }
    return { data: null, error: null };
  });
  // Proyecto activo (uuid) — sin esto el push a BD aborta con 'sin-proyecto'. OJO: crudo
  // (sin JSON.stringify): getActiveProyectoId valida el UUID tal cual.
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_active_proyecto_id',
    '11111111-1111-4111-8111-111111111111',
  );
});

/** Montante con un ramal asociado a mano (checkbox "Ramales asociados"). */
function docConMontanteAsociado() {
  return {
    v: 6,
    scaleM: 0.5,
    ramales: [
      {
        id: 'RAF1',
        net: 'af',
        tipo: 'ramal',
        padre: null,
        pts: [
          [0, 0],
          [100, 0],
        ],
        totalL: 3,
        label: 'RAF1',
        ini: '',
        fin: 'MAC1',
        piso: 'P1',
        fixtures: { lavamanos: 1 },
      },
    ],
    bajantes: [
      {
        id: 'MAC1_af',
        net: 'af',
        tipo: 'montante',
        code: 'MAC1',
        x: 100,
        y: 0,
        pisoBase: 'P1',
        pisoCima: 'P1',
        nptBase: 0,
        nptCima: 0,
        hVert: 0,
        dNominal: '1"',
        // LA ASOCIACIÓN: el ramal RAF1 queda en la lista de "recibe" y en la manual.
        recibeDeIds: ['RAF1'],
        alimentaIds: [],
        asocManual: ['RAF1'],
        descargaEnId: null,
        ucAcum: 0,
        ucExtra: 0,
        area_m2: 0,
        desplazamientos: {},
        lblOffX: 0,
        lblOffY: 0,
        labelAngle: 0,
        labelX: 100,
        labelY: 20,
        bajR: 0.29,
      },
    ],
    areas: [],
    dims: [],
    textAnnots: [],
    guideLines: [],
    crossFloorGhosts: [],
  };
}

describe('A) la asociación montante↔ramal sobrevive al cierre y la reapertura', () => {
  it('el payload manda la asociación completa (asoc_links) — la columna que la guarda', async () => {
    await saveTrazosToDB('501', { ...docConMontanteAsociado(), ts: Date.now() });
    const payload = (mockRpc.mock.calls[0][1] as { p_data: { bajantes: Row[] } }).p_data;
    const baj = payload.bajantes[0] as Row;
    expect(baj.asoc_links).toMatchObject({
      recibe: ['RAF1'],
      alimenta: [],
      manual: ['RAF1'],
    });
  });

  it('reabrir en otra pestaña (caché local vacía) devuelve la asociación', async () => {
    await saveTrazosToDB('501', { ...docConMontanteAsociado(), ts: Date.now() });
    // "Cerrar la sesión": la caché local del piso desaparece (otra pestaña / otro equipo).
    delLS('civilflow_trazos_501');

    const work = await loadTrazosFromDB('501');
    const baj = work?.bajantes?.find((b) => (b as { id?: string }).id === 'MAC1_af') as
      { asocManual?: string[]; recibeDeIds?: string[] } | undefined;
    expect(baj).toBeDefined();
    expect(baj!.asocManual).toEqual(['RAF1']);
    expect(baj!.recibeDeIds).toContain('RAF1');
    // El ramal vuelve con su geometría y su vínculo al montante por `fin`.
    const ramal = work?.ramales?.find((r) => (r as { id?: string }).id === 'RAF1') as
      { fin?: string } | undefined;
    expect(ramal).toBeDefined();
    expect(ramal!.fin).toBe('MAC1');
  });

  it('sin la columna asoc_links la asociación se pierde (por eso la columna es necesaria)', async () => {
    // Se simula una fila guardada por la versión vieja (sin asoc_links): el RPC solo resuelve
    // enlaces bajante→bajante, así que el id de RAMAL se cae.
    db['502'] = {
      header: { ts: new Date().toISOString(), scaleM: 0.5 },
      bajantes: [
        {
          client_id: 'MAC1_af',
          net: 'af',
          tipo: 'montante',
          code: 'MAC1',
          recibe_de_ids: ['RAF1'],
          alimenta_ids: [],
        },
      ],
      ramales: [],
    };
    const work = await loadTrazosFromDB('502');
    const baj = work?.bajantes?.find((b) => (b as { id?: string }).id === 'MAC1_af') as
      { recibeDeIds?: string[]; asocManual?: string[] } | undefined;
    expect(baj!.recibeDeIds ?? []).not.toContain('RAF1');
    expect(baj!.asocManual ?? []).toEqual([]);
  });
});

describe('B) los elementos de cada piso se recuperan en SU piso', () => {
  const docPiso = (idRamal: string, x: number) => ({
    v: 6,
    scaleM: 0.5,
    ramales: [
      {
        id: idRamal,
        net: 'af',
        tipo: 'ramal',
        padre: null,
        pts: [
          [x, 0],
          [x + 50, 0],
        ],
        totalL: 2,
        label: idRamal,
        ini: '',
        fin: '',
        piso: 'P1',
      },
    ],
    bajantes: [],
    areas: [],
    dims: [],
    textAnnots: [],
    guideLines: [],
    crossFloorGhosts: [],
  });

  it('dos pisos → cada uno recupera lo suyo y nada del vecino', async () => {
    await saveTrazosToDB('601', { ...docPiso('RAF1', 0), ts: Date.now() });
    await saveTrazosToDB('602', { ...docPiso('RAF2', 500), ts: Date.now() });
    delLS('civilflow_trazos_601');
    delLS('civilflow_trazos_602');

    const p1 = await loadTrazosFromDB('601');
    const p2 = await loadTrazosFromDB('602');
    expect(p1?.ramales?.map((r) => (r as { id?: string }).id)).toEqual(['RAF1']);
    expect(p2?.ramales?.map((r) => (r as { id?: string }).id)).toEqual(['RAF2']);
    // La geometría viaja intacta (posición y longitud).
    expect((p1?.ramales?.[0] as { pts: number[][] }).pts).toEqual([
      [0, 0],
      [50, 0],
    ]);
  });
});

describe('C) modificar en un piso no toca el otro', () => {
  it('el push de un piso no altera el doc guardado del vecino', async () => {
    const base = {
      v: 6,
      scaleM: 0.5,
      ramales: [{ id: 'RAF1', net: 'af', tipo: 'ramal', pts: [[0, 0]], label: 'RAF1', piso: 'P1' }],
      bajantes: [],
      areas: [],
      dims: [],
      textAnnots: [],
      guideLines: [],
      crossFloorGhosts: [],
    };
    await saveTrazosToDB('701', { ...base, ts: Date.now() });
    await saveTrazosToDB('702', { ...base, ts: Date.now() });

    // Se modifica SOLO el piso 701 (diámetro nuevo) y se vuelve a guardar.
    const doc701 = {
      ...base,
      ramales: [{ ...base.ramales[0], diametro: '2"' }],
      ts: Date.now(),
    };
    await saveTrazosToDB('701', doc701);

    const p1 = await loadTrazosFromDB('701');
    const p2 = await loadTrazosFromDB('702');
    expect((p1?.ramales?.[0] as { diametro?: string }).diametro).toBe('2"');
    // El vecino NO se toca: su diámetro sigue vacío (el push del 701 no lo pisó).
    expect((p2?.ramales?.[0] as { diametro?: string }).diametro).not.toBe('2"');
  });
});

describe('D) el cambio de piso deja el doc con ts fresco y lo sube a BD', () => {
  it('persistTrazosSnapshot escribe local (ts fresco) y empuja a BD', async () => {
    const eng = {
      saveWork: () => ({
        v: 6,
        scaleM: 0.5,
        ramales: [{ id: 'RAF1', net: 'af', tipo: 'ramal', pts: [[0, 0]], label: 'RAF1' }],
        bajantes: [],
        areas: [],
        dims: [],
        textAnnots: [],
        guideLines: [],
        crossFloorGhosts: [],
      }),
    };
    const antes = Date.now();
    persistTrazosSnapshot(eng as never, '801');
    const local = JSON.parse(getLS('civilflow_trazos_801') || '{}') as { ts?: number };
    expect(typeof local.ts).toBe('number');
    expect(local.ts!).toBeGreaterThanOrEqual(antes);
    // Y el push a BD se pidió (el RPC corre en microtask → se espera un turno).
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRpc).toHaveBeenCalledWith(
      'save_plano_data',
      expect.objectContaining({ p_plano_id: 801 }),
    );
  });
});

describe('E) el guardado se completa antes de dar por persistido', () => {
  it('la caché local se escribe de inmediato y la BD confirma al resolver', async () => {
    const eng = {
      saveWork: () => ({
        v: 6,
        scaleM: 0.5,
        ramales: [{ id: 'RAF1', net: 'af', tipo: 'ramal', pts: [[0, 0]], label: 'RAF1' }],
        bajantes: [],
        areas: [],
        dims: [],
        textAnnots: [],
        guideLines: [],
        crossFloorGhosts: [],
      }),
    };
    persistTrazosSnapshot(eng as never, '901');
    // Local escrito de forma SINCRONA (no espera a la red).
    expect(getLS('civilflow_trazos_901')).toBeTruthy();
    const promesa = saveTrazosToDB('901', { ramales: [{ id: 'RAF2' }], ts: Date.now() });
    await promesa;
    expect(mockRpc).toHaveBeenCalled();
  });

  it('aplicar una asociación deja el doc local con ts fresco (el más nuevo)', () => {
    setLS('civilflow_trazos_1001', { v: 6, ts: 1, ramales: [], bajantes: [{ id: 'MAC1' }] });
    const eng = {
      _loadedPlanId: '1001',
      bajantes: [{ id: 'MAC1' }],
      ramales: [],
      saveWork: () => ({
        v: 6,
        scaleM: 0.5,
        ramales: [],
        bajantes: [{ id: 'MAC1', recibeDeIds: ['RAF1'], asocManual: ['RAF1'] }],
        areas: [],
        dims: [],
        textAnnots: [],
        guideLines: [],
        crossFloorGhosts: [],
      }),
    };
    aplicarEnDocDePlan(eng as never, '1001', (doc) => {
      const b = doc.bajantes?.[0] as { recibeDeIds?: string[]; asocManual?: string[] };
      b.recibeDeIds = ['RAF1'];
      b.asocManual = ['RAF1'];
    });
    const local = JSON.parse(getLS('civilflow_trazos_1001') || '{}') as { ts?: number };
    expect(local.ts).toBeGreaterThan(1);
  });
});

describe('F) quitar aparatos y cambiar de piso NO resucita los conteos', () => {
  it('la lápida {} bloquea el merge de fixtures de la BD; la clave borrada sí se resucita', async () => {
    // 1) Piso 5 con RS2 y sus aparatos en el disco local → saveTrazosToDB los lleva a la BD
    //    (el RPC adjunta fixtures desde aparatos_by_tramo_v2 antes de subir).
    setLS('civilflow_trazos_5', {
      v: 6,
      scaleM: 0.5,
      ramales: [
        {
          id: 'RS2',
          net: 'san',
          tipo: 'ramal',
          padre: null,
          pts: [
            [0, 0],
            [100, 0],
          ],
          totalL: 3,
          label: 'RS2',
          ini: '',
          fin: 'BAN1',
          piso: 'P2',
        },
      ],
      bajantes: [],
      areas: [],
      dims: [],
      textAnnots: [],
      guideLines: [],
      crossFloorGhosts: [],
    });
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_5: { lavamanos: 1, inodoro: 1, ducha: 1 } });
    await saveTrazosToDB('5', JSON.parse(getLS('civilflow_trazos_5') || '{}'));
    const fila = db['5'].ramales.find((r) => r.client_id === 'RS2') as Row | undefined;
    expect((fila?.fixtures as Row) ?? null).toEqual({ lavamanos: 1, inodoro: 1, ducha: 1 });

    // 2) El usuario los QUITA: mutarDec deja la clave como {} (lápida — el estado nuevo).
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_5: {} });

    // 3) Cambio de piso = loadTrazosFromDB: el merge NO debe re-agregar los quitados.
    await loadTrazosFromDB('5');
    let disk = JSON.parse(getLS('civilflow_aparatos_by_tramo_v2') || '{}');
    expect(disk.san_RS2_5).toEqual({});

    // 4) Contraste (el bug original, documentado): con la clave BORRADA el merge sí
    //    resucita el snapshot viejo de la BD — por eso la lápida es necesaria.
    delLS('civilflow_aparatos_by_tramo_v2');
    await loadTrazosFromDB('5');
    disk = JSON.parse(getLS('civilflow_aparatos_by_tramo_v2') || '{}');
    expect(disk.san_RS2_5).toEqual({ lavamanos: 1, inodoro: 1, ducha: 1 });
  });
});
