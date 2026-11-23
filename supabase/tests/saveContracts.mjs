import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
const owner = '10000000-0000-4000-8000-000000000001';
const reader = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
const project = '20000000-0000-4000-8000-000000000001';
const otherProject = '20000000-0000-4000-8000-000000000002';
const state = {
  factoresPrestaciones: [],
  cargos: [],
  proveedores: [],
  cuadrillas: [],
  equipos: [],
  insumos: [],
  apus: [],
  presupuestos: [],
};

async function apply(name) {
  const sql = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
  try {
    await db.exec(sql.replace('create extension if not exists pgcrypto;', ''));
  } catch (error) {
    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
}

const as = (id) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
const version = async () =>
  (
    await db.query(
      "select to_jsonb(updated_at) #>> '{}' as token from public.cm_proyectos where id=$1",
      [project],
    )
  ).rows[0].token;
const save = async (patch, base) =>
  (
    await db.query('select public.cm_save_state_versioned($1, $2, $3) as token', [
      project,
      JSON.stringify({ ...state, ...patch }),
      base,
    ])
  ).rows[0].token;
const read = async (id) =>
  (await db.query('select public.cm_get_data($1) as snapshot', [id])).rows[0].snapshot;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid stable language sql as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create function public.acceso_modulo(uuid, text) returns boolean language sql as $$ select true $$;
    create function public.empresa_escritura(uuid, text) returns boolean language sql as $$ select false $$;
    create table public.cf_planos(id bigint primary key, user_id uuid, updated_at timestamptz, payload jsonb);
    create function public.save_plano_data_impl(bigint, jsonb) returns void language sql as
      $$ update public.cf_planos set payload = $2 where id = $1 $$;
    insert into auth.users values ('${owner}'), ('${reader}'), ('${stranger}');
  `);
  await apply('20260814000001_cm_schema');
  // Las policies de empresa reales se despliegan por separado. El fixture representa un miembro con lectura.
  await db.exec(`
    alter table public.cm_config add column if not exists config_listas jsonb default '{}'::jsonb;
    alter table public.cm_config add column if not exists categorias_apu jsonb default '[]'::jsonb;
    grant select on all tables in schema public to authenticated;
    create policy cm_fixture_shared on public.cm_proyectos for select to authenticated
      using (auth.uid() = '${reader}' and user_id = '${owner}');
    create policy cm_fixture_shared on public.cm_proveedores for select to authenticated
      using (auth.uid() = '${reader}' and user_id = '${owner}');
    insert into public.cm_proyectos(id,user_id,codigo,nombre) values
      ('${project}','${owner}','P1','Prueba'), ('${otherProject}','${stranger}','P2','Otro');
    insert into public.cm_proveedores(id,user_id,proyecto_id,codigo)
      values ('otro','${stranger}','${otherProject}','otro');
    insert into public.cf_planos values (1,'${owner}','2026-01-01T00:00:00Z','{}');
  `);
  await apply('20260903000000_cm_presupuesto_snaps');
  await apply('20261118000000_cm_doctrina_fixes');
  await apply('20261123000000_cm_save_integrity');
  await apply('20261123000001_cm_read_scope');
  await apply('20261123000002_save_versions');
  await db.exec('set role authenticated');
  await as(owner);
  const start = await version();
  const first = await save(
    {
      proveedores: [{ id: 'prov', nombre: 'Conservar', tipo: ['material'] }],
      insumos: [{ id: 'ins', proveedor_id: 'prov', costo_unitario: 1250 }],
    },
    start,
  );
  const second = await save({ proveedores: [{ id: 'prov' }], insumos: [{ id: 'ins' }] }, first);
  assert.notEqual(second, first);
  let snapshot = await read(project);
  assert.equal(snapshot.proveedores[0].nombre, 'Conservar');
  assert.deepEqual(snapshot.proveedores[0].tipo, ['material']);
  assert.equal(snapshot.insumos[0].proveedor_id, 'prov');
  assert.equal(snapshot.insumos[0].costo_unitario, 1250);
  await assert.rejects(save({}, first), /conflicto_concurrencia/);
  const third = await save(
    {
      proveedores: [{ id: 'prov' }],
      insumos: [{ id: 'ins', proveedor_id: null }],
    },
    second,
  );
  assert.equal((await read(project)).insumos[0].proveedor_id, null);
  // Cambiar nombres y referenciar un registro de otro proyecto aborta toda la transacción.
  await assert.rejects(
    save(
      {
        proveedores: [{ id: 'prov', nombre: 'No persistir' }],
        insumos: [{ id: 'ins', proveedor_id: 'otro' }],
      },
      third,
    ),
    /referencia_fuera_de_proyecto/,
  );
  snapshot = await read(project);
  assert.equal(snapshot.proveedores[0].nombre, 'Conservar');
  assert.equal(snapshot.insumos[0].proveedor_id, null);
  assert.equal(await version(), third);
  const savePlan = async (token) =>
    (
      await db.query('select public.save_plano_data_versioned(1, \'{"v":1}\', $1) as token', [
        token,
      ])
    ).rows[0].token;
  const plan1 = await savePlan('2026-01-01T00:00:00Z');
  const plan2 = await savePlan(plan1);
  assert.notEqual(plan1, plan2);
  await assert.rejects(savePlan(plan1), /conflicto_concurrencia/);
  await as(reader);
  assert.equal((await read(project)).proveedores.length, 1);
  await assert.rejects(save({}, third), /no_autorizado/);
  await as(stranger);
  assert.equal(await read(project), null);
  console.log('Contratos SQL: omisión, nulos, rollback, lectura por rol y versiones OK');
} finally {
  await db.close();
}
