import { describe, expect, it } from 'vitest';
import { FP_POR_PAIS, PREST_DEFAULTS, getPaisData, perfilesPaisDefault } from '../seedData.ts';
import { calcAPU, calcMapParaPres } from '../calc.ts';
import { defaultState } from '../storage.ts';
import type { Apu, CivilManagerState, Presupuesto } from '../types.ts';

// Congela la doctrina de datos país verificados (auditoría CM 2026-11-17, M-05/M-06/M-10):
// 6 países del selector de civilflow, salarios 2026, IVA por país, FP semilla por país.

describe('perfiles de país (solo los 6 del selector de civilflow)', () => {
  it('catálogo exacto CO/PE/EC/CL/AR/BO, CO primero', () => {
    expect(perfilesPaisDefault().map((p) => p.codigo)).toEqual([
      'CO',
      'PE',
      'EC',
      'CL',
      'AR',
      'BO',
    ]);
  });

  it('salarios mínimos 2026 verificados por fuente oficial', () => {
    const smmlv = Object.fromEntries(perfilesPaisDefault().map((p) => [p.codigo, p.smmlv]));
    expect(smmlv).toEqual({
      CO: 1750905, // Decreto 1469 de 2025
      PE: 1230, // DS 015-2026-TR (desde oct-2026)
      EC: 482, // Min. Trabajo EC 2026
      CL: 553553, // Ley 21.830 (desde may-2026)
      AR: 398800, // Resolución SMVM nov-2026
      BO: 3300, // DS 5516 art. 23
    });
    expect(perfilesPaisDefault().every((p) => p.vigencia === 2026)).toBe(true);
  });

  it('IVA por país: CO 19 · PE 18 · EC 15 · CL 19 · AR 21 · BO 13', () => {
    const iva = Object.fromEntries(perfilesPaisDefault().map((p) => [p.codigo, p.iva_pct]));
    expect(iva).toEqual({ CO: 19, PE: 18, EC: 15, CL: 19, AR: 21, BO: 13 });
  });

  it('sin tope_ibc_mult ni auxilio_transporte (campos muertos eliminados, M-08/M-11)', () => {
    for (const p of perfilesPaisDefault()) {
      expect(p).not.toHaveProperty('tope_ibc_mult');
      expect(p).not.toHaveProperty('auxilio_transporte');
    }
  });

  it('getPaisData con código inexistente cae a Colombia sin romper', () => {
    const p = getPaisData('ZZ', []);
    expect(p.codigo).toBe('CO');
    expect(p.smmlv).toBe(1750905);
  });
});

describe('FP (Factores Prestacionales) por país', () => {
  it('los 6 países del dropdown tienen semilla de FP', () => {
    for (const c of ['CO', 'PE', 'EC', 'CL', 'AR', 'BO']) {
      expect(FP_POR_PAIS[c].length).toBeGreaterThan(0);
    }
  });

  it('CO es la liquidación colombiana original (FP-001..FP-016)', () => {
    expect(FP_POR_PAIS.CO).toBe(PREST_DEFAULTS);
    expect(FP_POR_PAIS.CO).toHaveLength(16);
    expect(FP_POR_PAIS.CO[0].codigo).toBe('FP-001');
  });

  it('PE trae EsSalud 9% y EC trae IESS 11.15% (aportes patronales verificados)', () => {
    const pe = Object.fromEntries(FP_POR_PAIS.PE.map((f) => [f.codigo, f.factor]));
    expect(pe['FP-101']).toBe(9);
    const ec = Object.fromEntries(FP_POR_PAIS.EC.map((f) => [f.codigo, f.factor]));
    expect(ec['FP-201']).toBe(11.15);
    const bo = Object.fromEntries(FP_POR_PAIS.BO.map((f) => [f.codigo, f.factor]));
    expect(bo['FP-501']).toBe(10); // CNS
    expect(bo['FP-504']).toBe(2); // FOVIESS pro-vivienda
  });
});

// ─── M-12: presupuesto cerrado calcula con snaps congeladas ────────────────────────────

function apu(id: string, insumoId: string, esBasico: boolean): Apu {
  return {
    id,
    codigo: 'APU-1',
    nombre: 'Excavación',
    categoria: 'C',
    unidad: 'M3',
    fecha_creacion: '',
    es_basico: esBasico,
    recursos_mo: [],
    recursos_eq: [],
    recursos_ins: [{ insumo_id: insumoId, consumo: 1, desperdicios_pct: 0 }],
    recursos_transporte: [],
  } as Apu;
}

describe('calcMapParaPres (cerrado = congelado, borrador = vivo)', () => {
  const mkPres = (estado: 'borrador' | 'cerrado'): Presupuesto =>
    ({
      id: 'p1',
      codigo: 'PPT-1',
      nombre: 'Obra',
      entidad: '',
      contrato: '',
      objeto: '',
      plazo: '',
      fecha_creacion: '',
      ciudad: '',
      departamento: '',
      elaborado_por: '',
      activo: true,
      con_sub_proyectos: false,
      parent_id: null,
      estado,
      fecha_cierre: '',
      observaciones: '',
      items: [],
      aiu_override: { activo: false, pct_a: 10, pct_i: 3, pct_u: 6, iva_pct: 19 },
      factores_snap: [],
      cargos_snap: [],
      apus_snap: [apu('a1', 'ins-snap', false)],
      insumos_snap: [
        {
          id: 'ins-snap',
          codigo: 'IN-1',
          nombre: 'Arena',
          unidad: 'm3',
          origen: 'Local',
          categoria: '',
          subcategoria: '',
          marca_referencia: '',
          costo_unitario: 10,
          fecha_cotizacion: '',
          apu_basico_id: '',
          proveedor_id: '',
        },
      ],
      equipos_snap: [],
      cuadrillas_snap: [],
      perfil_pais_snap: null,
    }) as unknown as Presupuesto;

  function stateConInsumoVivo(costo: number): CivilManagerState {
    const s = defaultState();
    s.insumos = [
      {
        id: 'ins-snap',
        codigo: 'IN-1',
        nombre: 'Arena',
        unidad: 'm3',
        origen: 'Local',
        categoria: '',
        subcategoria: '',
        marca_referencia: '',
        costo_unitario: costo,
        fecha_cotizacion: '',
        apu_basico_id: '',
        proveedor_id: '',
      },
    ];
    s.apus = [apu('a1', 'ins-snap', false)];
    return s;
  }

  it('borrador devuelve el mapa vivo (sube con el catálogo)', () => {
    const s = stateConInsumoVivo(50);
    const vivo = new Map([['a1', calcAPU(s.apus[0], [], [], s.insumos, null, 0, 0, false, false)]]);
    const mapa = calcMapParaPres(mkPres('borrador'), s, vivo);
    expect(mapa.get('a1')!.subIns).toBe(50);
  });

  it('cerrado calcula con la snap del insumo (10) aunque el catálogo vivo diga 50', () => {
    const s = stateConInsumoVivo(50);
    const vivo = new Map([['a1', calcAPU(s.apus[0], [], [], s.insumos, null, 0, 0, false, false)]]);
    const mapa = calcMapParaPres(mkPres('cerrado'), s, vivo);
    expect(mapa.get('a1')!.subIns).toBe(10);
  });

  it('cerrado sin snaps (presupuesto pre-snap) cae al mapa vivo para no quedar en cero', () => {
    const s = stateConInsumoVivo(50);
    const vivo = new Map([['a1', calcAPU(s.apus[0], [], [], s.insumos, null, 0, 0, false, false)]]);
    const pres = { ...mkPres('cerrado'), apus_snap: [] } as unknown as Presupuesto;
    expect(calcMapParaPres(pres, s, vivo).get('a1')!.subIns).toBe(50);
  });
});

// ─── Paridad motor↔export (M-01/M-04): los helpers que usa buildRows suman lo que calcAPU agrega ──

describe('helpers por recurso = subtotales agregados de calcAPU (paridad export)', () => {
  it('suma de moSubtotal/eqSubtotal/insSubtotal/transSubtotal por fila == sub* del motor', async () => {
    const { moSubtotal, eqSubtotal, insSubtotal, transSubtotal } = await import('../calc.ts');
    const apu: Apu = {
      id: 'a1',
      codigo: 'APU-1',
      nombre: 'Mixto',
      categoria: 'C',
      unidad: 'M3',
      fecha_creacion: '',
      es_basico: false,
      recursos_mo: [{ id: 'r1', cargo_id: 'c1', cant_personas: 2, rendimiento: 0.5 }],
      recursos_eq: [{ equipo_id: 'e1', rendimiento: 0.25 }],
      recursos_ins: [{ insumo_id: 'i1', consumo: 3, desperdicios_pct: 0 }],
      recursos_transporte: [{ unidad: 'M3-Km', tarifa: 200, distancia_km: 5 }],
    } as Apu;
    const cargos = [
      {
        id: 'c1',
        codigo: 'MO-1',
        descripcion: 'Oficial',
        num_salarios_base: 1,
        valorBasico: 2000,
        costo_base_dia: 80,
        costo_base_hora: 10,
        costo_total_dia: 120,
        costo_total_hora: 15,
      },
    ];
    const equipos = [
      {
        id: 'e1',
        codigo: 'EQ-1',
        nombre: 'Vibro',
        tipo: '',
        unidad: '',
        costo_hora: 40,
        fecha_cotizacion: '',
        proveedor_id: '',
      },
    ];
    const insumos = [
      {
        id: 'i1',
        codigo: 'IN-1',
        nombre: 'Concreto',
        unidad: 'm3',
        origen: 'Local',
        categoria: '',
        subcategoria: '',
        marca_referencia: '',
        costo_unitario: 100,
        fecha_cotizacion: '',
        apu_basico_id: '',
        proveedor_id: '',
      },
    ];
    const r = calcAPU(apu, cargos, equipos, insumos, null, 0, 0, false, false);
    const sumaFilas =
      cargos.reduce((s, c) => s + moSubtotal(c.costo_total_dia, apu.recursos_mo[0]), 0) +
      equipos.reduce((s, e) => s + eqSubtotal(e.costo_hora, apu.recursos_eq[0]), 0) +
      insSubtotal(insumos[0], null, apu.recursos_ins[0]) +
      transSubtotal(apu.recursos_transporte[0]);
    // MO 2×120×0.5=120 · EQ 40×0.25=10 · INS 100×3×1.0=300 · TRANS 200×5=1000 → 1430
    expect(r.subMO).toBe(120);
    expect(r.subEq).toBe(10);
    expect(r.subIns).toBe(300);
    expect(r.subTrans).toBe(1000);
    expect(sumaFilas).toBe(r.totalDirecto);
  });
});
