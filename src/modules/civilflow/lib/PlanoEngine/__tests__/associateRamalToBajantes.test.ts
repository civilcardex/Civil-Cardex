import { describe, it, expect } from 'vitest';
import { asociarRamalABajantes } from '../drawingUtils';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

// La asociación a bajantes al crear (llegada/salida + ini/fin + diámetros + Y doble) es UNA
// sola función compartida entre dibujo manual (finishRamal) y conversiones desde línea
// guía ("Crear ramal/tributario"), que antes no asociaban: el trazo quedaba suelto.

function makeEngine(
  ramales: PlanoRamal[],
  bajantes: PlanoBajante[],
  alerts: string[],
): IPlanoEngineCore {
  return {
    ramales,
    bajantes,
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    getBajantesFantasma: () => [],
    _hiddenNets: new Set<string>(),
    zoom: 1,
    triggerAlert: (t: string, m: string) => {
      alerts.push(`${t}|${m}`);
    },
  } as unknown as IPlanoEngineCore;
}

const ramal = (o: Partial<PlanoRamal> & { id: string; pts: number[][] }): PlanoRamal =>
  ({
    net: 'san',
    tipo: 'ramal',
    padre: null,
    totalL: 10,
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
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const bajante = (o: Partial<PlanoBajante> & { id: string }): PlanoBajante =>
  ({
    net: 'san',
    tipo: 'bajante',
    code: o.id,
    x: 0,
    y: 0,
    dNominal: '',
    recibeDeIds: [],
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    ...o,
  }) as unknown as PlanoBajante;

describe('asociarRamalABajantes', () => {
  it('inicio sobre el bajante asocia vía alimentaIds + ini (caso RS7/BAN2)', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2' });
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    const res = asociarRamalABajantes(eng, r, false);
    expect(res.rejected).toBe(false);
    expect(alerts).toEqual([]);
    expect(ban.alimentaIds).toEqual(['RS7']);
    expect(r.ini).toBe('BAN2');
  });

  it('llegada al bajante asocia vía recibeDeIds + fin', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2' });
    const r = ramal({
      id: 'RS7',
      pts: [
        [-100, 0],
        [0, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    const res = asociarRamalABajantes(eng, r, false);
    expect(res.rejected).toBe(false);
    expect(ban.recibeDeIds).toEqual(['RS7']);
    expect(r.fin).toBe('BAN2');
  });

  it('bajante lleno rechaza con alerta (sin escribir)', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2', recibeDeIds: ['RS1', 'RS2'] });
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    const res = asociarRamalABajantes(eng, r, false);
    expect(res.rejected).toBe(true);
    expect(res.alert?.title).toBe('Bajante completo');
    // La función no dispara la alerta (la dispara el caller: finishRamal o menú guía).
    expect(alerts).toEqual([]);
    expect(ban.alimentaIds || []).toEqual([]);
  });

  it('tributario sobre bajante se rechaza (regla central)', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2' });
    const r = ramal({
      id: 'T1RS1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    const res = asociarRamalABajantes(eng, r, false);
    expect(res.rejected).toBe(true);
    expect(ban.recibeDeIds).toEqual([]);
  });

  it('llegada a caja marca llegaACaja sin tocar diámetros', () => {
    const alerts: string[] = [];
    const caja = bajante({ id: 'CAN1', tipo: 'caja_san', code: 'CAN1', dNominal: '4"' });
    const r = ramal({
      id: 'RS7',
      pts: [
        [-100, 0],
        [0, 0],
      ],
    });
    const eng = makeEngine([r], [caja], alerts);
    const res = asociarRamalABajantes(eng, r, false);
    expect(res.rejected).toBe(false);
    expect(res.llegaACaja).toBe(true);
    expect(caja.recibeDeIds).toEqual(['RS7']);
    expect(r.diametro).toBe('');
  });
});
