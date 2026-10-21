import { describe, it, expect, beforeEach } from 'vitest';
import {
  unirOverrides,
  claveBajante,
  claveCanal,
  baseDeChip,
  agregarTumba,
  quitarTumba,
  leerEspejo,
  guardarEspejo,
  claveEspejo,
} from '../lluviasOverrideAlmacen.ts';
import type { BajanteLL, CanalLL } from '../../context/LluviasContexto.tsx';

const PID_A = '123e4567-e89b-12d3-a456-426614174000';
const PID_B = '123e4567-e89b-12d3-a456-426614174001';
const PID_KEY = 'civilflow_active_proyecto_id';

const bajante = (id: string, baj: string, areaParcial = 0): BajanteLL => ({
  id,
  bajante: baj,
  areaParcial,
  areaOtras: 0,
  areaAcumulada: areaParcial,
  intensidad: 100,
  coeficienteC: 0,
  R: '',
  manning: 0,
  diamPropuesto: 0,
});

const canal = (id: string, sector: string): CanalLL => ({
  id,
  sector,
  areaParcial: 0,
  areaOtras: 0,
  areaAcumulada: 0,
  intensidad: 100,
  coeficienteC: 0,
  manning: 0.009,
  pendiente: 2,
  b: 0,
  h: 0,
});

beforeEach(() => {
  localStorage.clear();
});

describe('unirOverrides', () => {
  it('local manda y el remoto solo aporta ausentes', () => {
    const out = unirOverrides([bajante('BLL-1', 'BALL1', 5)], claveBajante, [
      bajante('BLL-9', 'BALL1', 99),
      bajante('BLL-2', 'BALL2', 7),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((b) => claveBajante(b) === 'BALL1')?.areaParcial).toBe(5);
    expect(out.find((b) => claveBajante(b) === 'BALL2')?.areaParcial).toBe(7);
  });

  it('tumba bloquea al remoto (borrado no resucita)', () => {
    const out = unirOverrides(
      [],
      claveBajante,
      [bajante('BLL-1', 'BALL1'), bajante('BLL-2', 'BALL2')],
      ['BALL1'],
    );
    expect(out.map(claveBajante)).toEqual(['BALL2']);
  });

  it('upsert levanta la tumba (quitarTumba) y el remoto vuelve a unir', () => {
    let tumbas = agregarTumba([], 'BALL1');
    expect(tumbas).toEqual(['BALL1']);
    expect(agregarTumba(tumbas, 'BALL1')).toEqual(['BALL1']);
    tumbas = quitarTumba(tumbas, 'BALL1');
    expect(tumbas).toEqual([]);
    const out = unirOverrides([], claveBajante, [bajante('BLL-1', 'BALL1')], tumbas);
    expect(out.map(claveBajante)).toEqual(['BALL1']);
  });
});

describe('espejo por proyecto', () => {
  it('ignora el espejo de un proyecto distinto', () => {
    localStorage.setItem(PID_KEY, PID_A);
    guardarEspejo(PID_A, [bajante('BLL-1', 'BALL1', 5)], [canal('CLL-1', 'CNL1')], []);
    localStorage.setItem(PID_KEY, PID_B);
    expect(leerEspejo()).toBeNull();
    localStorage.setItem(PID_KEY, PID_A);
    expect(leerEspejo()?.bajantes?.map(claveBajante)).toEqual(['BALL1']);
  });

  it('filtra filas efímeras sin clave al escribir', () => {
    localStorage.setItem(PID_KEY, PID_A);
    guardarEspejo(
      PID_A,
      [bajante('BLL-1', ''), bajante('BLL-2', 'BALL2')],
      [canal('CLL-1', '')],
      [],
    );
    const raw = JSON.parse(localStorage.getItem(`civilflow_${claveEspejo(PID_A)}`) ?? '{}') as {
      bajantes: BajanteLL[];
      canales: CanalLL[];
      proyectoId: string;
    };
    expect(raw.bajantes.map(claveBajante)).toEqual(['BALL2']);
    expect(raw.canales).toEqual([]);
    expect(raw.proyectoId).toBe(PID_A);
  });

  it('persiste y devuelve las tumbas del proyecto activo', () => {
    localStorage.setItem(PID_KEY, PID_A);
    guardarEspejo(PID_A, [], [], ['BALL1', 'CNL1']);
    expect(leerEspejo()?.tumbas).toEqual(['BALL1', 'CNL1']);
  });
});

describe('claves', () => {
  it('baseDeChip no caza BALL11 con base BALL1', () => {
    expect(baseDeChip('BALL11-P1')).toBe('BALL11');
    expect(baseDeChip('BALL11-P1')).not.toBe('BALL1');
    expect(baseDeChip('BALL1-P1')).toBe('BALL1');
  });

  it('claveCanal usa sector o id', () => {
    expect(claveCanal(canal('CLL-9', 'CNL1'))).toBe('CNL1');
    expect(claveCanal(canal('CLL-9', ''))).toBe('CLL-9');
  });
});
