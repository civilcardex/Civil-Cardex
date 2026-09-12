import { describe, it, expect, beforeEach, vi } from 'vitest';

const captured = vi.hoisted(() => [] as Array<{ table: string; rows: unknown; opts: unknown }>);
// Resultado configurable del select de integrantes existentes (flujo upsert→delete-stale).
const integrantesExistentes = vi.hoisted(() => ({
  data: [] as Array<{ id: string }>,
  fail: false,
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: (table: string) => ({
      upsert: async (rows: unknown, opts: unknown) => {
        captured.push({ table, rows, opts });
        return { error: null };
      },
      select: () => ({
        in: async () =>
          integrantesExistentes.fail
            ? { data: null, error: { message: 'select fail' } }
            : { data: integrantesExistentes.data, error: null },
      }),
      delete: () => ({
        in: (_col: string, ids: string[]) => {
          captured.push({ table, rows: ids, opts: 'delete' });
          return { error: null };
        },
      }),
      insert: async (rows: unknown) => {
        captured.push({ table, rows, opts: 'insert' });
        return { error: null };
      },
    }),
  },
}));

// El upsert debe viajar con defaultToNull:false (Prefer: missing=default): sin él, PostgREST
// rellena las claves omitidas por el saneo con NULL (23502) en vez del default de la columna.
function upsertOptsOf(table: string): { defaultToNull?: boolean } | null {
  const c = captured.find((x) => x.table === table && x.opts !== 'insert');
  return (c?.opts as { defaultToNull?: boolean } | undefined) ?? null;
}

import { defaultState, civilManagerSave } from '../storage';

const PROYECTO = '11111111-1111-4111-8111-111111111111';

function resetLS(withProject: boolean) {
  const m = new Map<string, string>();
  if (withProject) m.set('cm_proyecto_activo_id', PROYECTO);
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
    key: (_i: number) => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const rowsOf = (table: string) =>
  captured
    .filter((c) => c.table === table && c.opts !== 'insert')
    .flatMap((c) => c.rows as Record<string, unknown>[]);
const deletesOf = (table: string) =>
  captured
    .filter((c) => c.table === table && c.opts === 'delete')
    .flatMap((c) => c.rows as string[]);

// 400/409 en consola (orig. usuario): FK proveedor_id:'' (409), columnas cliente sin
// columna BD como tipoPrecioFormulario/alarmasPrecioFaltante (400), proyecto ausente
// (400 uuid inválido) y cantidad NaN (400 not-null).

function seedState() {
  const s = defaultState();
  s.equipos = [
    {
      id: 'e1',
      codigo: 'EQ-1',
      nombre: 'Andamio',
      tipo: 'Equipo menor',
      unidad: 'HR',
      costo_hora: 6000,
      fecha_cotizacion: '',
      proveedor_id: '',
    },
  ];
  s.insumos = [
    {
      id: 'i1',
      codigo: 'IN-1',
      nombre: 'Cemento',
      unidad: 'KG',
      origen: 'Local',
      categoria: 'C1',
      subcategoria: '',
      marca_referencia: '',
      costo_unitario: 100,
      fecha_cotizacion: '',
      apu_basico_id: '',
      proveedor_id: '',
    },
  ];
  s.apus = [
    {
      id: 'a1',
      codigo: 'APU-1',
      nombre: 'Zapata',
      categoria: 'C',
      unidad: 'M3',
      fecha_creacion: '',
      es_basico: false,
      recursos_mo: [],
      recursos_eq: [],
      recursos_ins: [],
      recursos_transporte: [],
    },
  ];
  s.cargos = [{ id: 'c1', codigo: 'C1', descripcion: 'Ayudante', num_salarios_base: 1 }];
  s.cuadrillas = [
    {
      id: 'q1',
      codigo: 'Q1',
      descripcion: 'Cuadrilla 1',
      integrantes: [{ id: 'it1', cargo_id: 'c1', cantidad: NaN }],
    },
  ];
  s.presupuestos = [
    {
      id: 'p1',
      codigo: 'P-1',
      nombre: 'Presupuesto 1',
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
      estado: 'borrador',
      fecha_cierre: '',
      observaciones: '',
      items: [],
      aiu_override: { activo: false, pct_a: 10, pct_i: 3, pct_u: 6, iva_pct: 19 },
      factores_snap: [],
      cargos_snap: [],
      apus_snap: [],
      insumos_snap: [],
      equipos_snap: [],
      cuadrillas_snap: [],
      perfil_pais_snap: null,
      formulario_original: null,
      tipoPrecioFormulario: 'entidad',
      alarmasPrecioFaltante: ['1.1'],
    },
  ];
  return s;
}

describe('civilManagerSave sanea payloads Supabase', () => {
  beforeEach(() => {
    captured.length = 0;
    integrantesExistentes.data = [];
    integrantesExistentes.fail = false;
    resetLS(true);
  });

  it("proveedor_id '' viaja como null (FK) y sin columnas de más", async () => {
    await civilManagerSave(seedState());
    const eq = rowsOf('cm_equipos');
    expect(eq).toHaveLength(1);
    expect(eq[0].proveedor_id).toBeNull();
    expect(eq[0].proyecto_id).toBe(PROYECTO);
    const ins = rowsOf('cm_insumos');
    expect(ins[0].proveedor_id).toBeNull();
  });

  it('presupuestos sin tipoPrecioFormulario/alarmasPrecioFaltante (columnas inexistentes)', async () => {
    await civilManagerSave(seedState());
    const pp = rowsOf('cm_presupuestos');
    expect(pp).toHaveLength(1);
    expect(pp[0]).not.toHaveProperty('tipoPrecioFormulario');
    expect(pp[0]).not.toHaveProperty('alarmasPrecioFaltante');
    expect(pp[0]).toHaveProperty('items');
    expect(pp[0]).toHaveProperty('aiu_override');
  });

  it('integrantes con cantidad NaN viaja como 0 (not-null/check)', async () => {
    await civilManagerSave(seedState());
    const ins = rowsOf('cm_cuadrilla_integrantes');
    expect(ins).toHaveLength(1);
    expect(ins[0].cantidad).toBe(0);
  });

  it('es_basico/fecha_cierre null se OMITEN para que la BD aplique su default (23502)', async () => {
    const s = seedState();
    s.apus = [{ ...s.apus[0], es_basico: null as unknown as boolean }];
    s.presupuestos = [{ ...s.presupuestos[0], fecha_cierre: null as unknown as string }];
    await civilManagerSave(s);
    const apu = rowsOf('cm_apus');
    expect(apu).toHaveLength(1);
    expect(apu[0]).not.toHaveProperty('es_basico');
    const pp = rowsOf('cm_presupuestos');
    expect(pp).toHaveLength(1);
    expect(pp[0]).not.toHaveProperty('fecha_cierre');
  });

  // NaN en columna no anulable se omite; observaciones null también; el upsert viaja con
  // defaultToNull:false para que las omitidas reciban el DEFAULT de la columna, no null.
  it('NaN en columna no anulable se omite; observaciones null también; defaultToNull:false', async () => {
    const s = seedState();
    s.apus = [{ ...s.apus[0], es_basico: NaN as unknown as boolean }];
    s.presupuestos = [{ ...s.presupuestos[0], observaciones: null as unknown as string }];
    await civilManagerSave(s);
    expect(rowsOf('cm_apus')[0]).not.toHaveProperty('es_basico');
    expect(rowsOf('cm_presupuestos')[0]).not.toHaveProperty('observaciones');
    expect(upsertOptsOf('cm_apus')?.defaultToNull).toBe(false);
    expect(upsertOptsOf('cm_presupuestos')?.defaultToNull).toBe(false);
  });

  // Columnas ANULABLES: null sí viaja (limpiar el valor del presupuesto padre/snap).
  it('null en columnas anulables (parent_id, perfil_pais_snap) se conserva', async () => {
    const s = seedState();
    s.presupuestos = [
      { ...s.presupuestos[0], parent_id: null, perfil_pais_snap: null, formulario_original: null },
    ];
    await civilManagerSave(s);
    const pp = rowsOf('cm_presupuestos')[0];
    expect(pp).toHaveProperty('parent_id', null);
    expect(pp).toHaveProperty('perfil_pais_snap', null);
    expect(pp).toHaveProperty('formulario_original', null);
  });

  it('cantidad decimal se redondea y el integrante sin cargo se salta (400 insert)', async () => {
    const s = seedState();
    s.cuadrillas = [
      {
        id: 'q1',
        codigo: 'Q1',
        descripcion: 'Cuadrilla 1',
        integrantes: [
          { id: 'it1', cargo_id: 'c1', cantidad: 1.5 },
          { id: 'it2', cargo_id: '', cantidad: 2 },
        ],
      },
    ];
    await civilManagerSave(s);
    const ins = rowsOf('cm_cuadrilla_integrantes');
    expect(ins).toHaveLength(1);
    expect(ins[0].id).toBe('it1');
    expect(ins[0].cantidad).toBe(2);
  });

  it('integrantes stale se borran tras un upsert exitoso (sin vaciado previo)', async () => {
    integrantesExistentes.data = [{ id: 'it-vieja' }];
    await civilManagerSave(seedState());
    expect(upsertOptsOf('cm_cuadrillas')).not.toBeNull();
    const borradas = deletesOf('cm_cuadrilla_integrantes');
    expect(borradas).toEqual(['it-vieja']);
  });

  it('fallo del select de existentes: sin delete (los datos previos quedan intactos)', async () => {
    integrantesExistentes.fail = true;
    await civilManagerSave(seedState());
    expect(deletesOf('cm_cuadrilla_integrantes')).toHaveLength(0);
  });

  it('sin proyecto activo no se dispara ningún upsert a la nube', async () => {
    resetLS(false);
    await civilManagerSave(seedState());
    expect(captured.filter((c) => c.table === 'cm_equipos')).toHaveLength(0);
    expect(captured.filter((c) => c.table === 'cm_presupuestos')).toHaveLength(0);
  });
});
