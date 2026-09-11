import { describe, it, expect, beforeEach } from 'vitest';
import { mapUdBombaDesdeTrazos, equiposBombaDesdeTrazos } from '../bombaAssociation';

// "UD acumuladas en sótano" y la herencia a los bajantes deben leer las UDs desde los
// TRAZOS del piso de la bomba (caja + tramos asociados), aunque el piso no esté cargado.

function resetLS() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => Array.from(m.keys())[i] ?? null,
      get length() {
        return m.size;
      },
    };
  })();
}

describe('mapUdBombaDesdeTrazos / equiposBombaDesdeTrazos', () => {
  beforeEach(() => resetLS());

  it('suma caja + ramales que llegan + cadenas de tributarios, desde los trazos', () => {
    // Piso 1: caja CAN1 con RS1 y T1RS1 drenando en ella; bomba BOMAN-S1 (cajaOrigenId CAN1).
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          { id: 'RS1', net: 'san', tipo: 'ramal', padre: null },
          { id: 'T1RS1', net: 'san', tipo: 'tributario', padre: 'RS1' },
        ],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', recibeDeIds: ['RS1'] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({
        san_CAN1_1: { lvm: 1 },
        san_RS1_1: { san: 2 },
        san_T1RS1_1: { duc: 1 },
      }),
    );

    const mapa = mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san');
    expect(mapa).toEqual({ lvm: 1, san: 2, duc: 1 });

    const equipos = equiposBombaDesdeTrazos();
    expect(equipos).toHaveLength(1);
    expect(equipos[0].code).toBe('BOMAN-S1');
    expect(equipos[0].uds).toBe(12);
  });

  it('sin tramos con UDs: usa la clave espejo de la bomba como fallback', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', recibeDeIds: [] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ 'san_BOMAN-S1_1': {} }),
    );
    // sin espejo con contenido → vacío
    expect(Object.keys(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san'))).toHaveLength(0);
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ 'san_BOMAN-S1_1': { ino: 3 } }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 3 });
  });

  it('espejo en recibeDeIds NO es fuente (anti-bucle suma infinita)', () => {
    // Listas mixtas: RS2 es SALIDA (alimentaIds) pero quedó también en recibeDeIds, y su
    // clave ya contiene el agregado espejado. Sumarla de nuevo haría crecer el espejo de
    // la bomba en cada pasada.
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [100, 0],
              [0, 0],
            ],
          },
          {
            id: 'RS2',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [0, 0],
              [60, 60],
            ],
          },
        ],
        bajantes: [
          {
            id: 'CAN1',
            net: 'san',
            tipo: 'caja_san',
            x: 0,
            y: 0,
            recibeDeIds: ['RS1', 'RS2'],
            alimentaIds: ['RS2'],
          },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_1: { ino: 10 }, san_RS2_1: { ino: 10 } }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 10 });
  });

  it('la propia bomba y los LD en recibeDeIds no son fuente; tributario de otra red tampoco', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          { id: 'RS1', net: 'san', tipo: 'ramal', padre: null },
          { id: 'TV1', net: 'vent', tipo: 'tributario', padre: 'RS1' },
        ],
        bajantes: [
          {
            id: 'CAN1',
            net: 'san',
            tipo: 'caja_san',
            recibeDeIds: ['RS1', 'BOMAN-S1', 'LD_BAN9'],
          },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({
        san_RS1_1: { ino: 4 },
        'san_BOMAN-S1_1': { ino: 99 },
        san_LD_BAN9_1: { ino: 99 },
        vent_TV1_1: { lav: 5 },
      }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 4 });
  });

  it('semilla geométrica con recibeDeIds stale (autosave tardío)', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [100, 0],
              [0, 0],
            ],
          },
        ],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', x: 0, y: 0, recibeDeIds: [] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_1: { ino: 7 } }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 7 });
  });

  it('cadena extremo-con-extremo sin registro (RS5→RS4→caja) también suma', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS4',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [100, 0],
              [0, 0],
            ],
          },
          {
            id: 'RS5',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [200, 0],
              [100, 0],
            ],
          },
        ],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', x: 0, y: 0, recibeDeIds: ['RS4'] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS4_1: { ino: 4 }, san_RS5_1: { sif: 3 } }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 4, sif: 3 });
  });

  it('fuentes mergesFrom de un tramo que drena a la caja también suman', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RSD',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [50, 0],
              [0, 0],
            ],
            mergesFrom: ['RS4', 'RX'],
          },
          {
            id: 'RS4',
            net: 'san',
            tipo: 'ramal',
            padre: null,
            pts: [
              [150, 0],
              [50, 0],
            ],
          },
          {
            id: 'RX',
            net: 'san',
            tipo: 'tributario',
            padre: 'RS9',
            pts: [
              [50, 60],
              [50, 0],
            ],
          },
        ],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', x: 0, y: 0, recibeDeIds: ['RSD'] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS4_1: { ino: 4 }, san_RX_1: { lav: 2 } }),
    );
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({ ino: 4, lav: 2 });
  });

  it('equipos relee storage en cada llamada (la columna UD sigue a los datos)', () => {
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [{ id: 'RS1', net: 'san', tipo: 'ramal', padre: null }],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', recibeDeIds: ['RS1'] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_1: { san: 3 } }),
    );
    expect(equiposBombaDesdeTrazos()[0].uds).toBe(12);
    // Cambios posteriores (visor, asociación, prefetch) se reflejan sin caché vieja
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_1: { san: 3 }, san_CAN1_1: { lvm: 2 } }),
    );
    const equipos = equiposBombaDesdeTrazos();
    expect(equipos[0].uds).toBe(16);
    expect(equipos.reduce((a, e) => a + e.uds, 0)).toBe(16);
  });

  it('pool vivo: trazos en disco stale con motor al día dan el total completo', () => {
    // Disco: caja sin recibeDeIds ni coords (stale). Vivo: RS1 conectado con UDs.
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [],
        bajantes: [
          { id: 'CAN1', net: 'san', tipo: 'caja_san', recibeDeIds: [] },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_1: { ino: 6 } }),
    );
    // Sin vivo: no hay de dónde sumar → vacío (luego valdría el espejo)
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san')).toEqual({});
    // Con vivo (piso cargado): el ramal conectado aparece
    const live = {
      bajantes: [{ id: 'CAN1', net: 'san', x: 0, y: 0, recibeDeIds: ['RS1'] }],
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
        },
      ],
    };
    expect(mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san', live as never)).toEqual({ ino: 6 });
  });
});
