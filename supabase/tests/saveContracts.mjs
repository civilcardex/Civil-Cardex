import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
const owner = '10000000-0000-4000-8000-000000000001';
const reader = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
const editor = '10000000-0000-4000-8000-000000000004';
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
    grant usage on schema auth to authenticated, anon;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(bucket_id text, name text primary key);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array($1, '/') $$;
    grant usage on schema storage to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
    create function public.acceso_modulo(uuid, text) returns boolean language sql as $$ select true $$;
    create function public.empresa_escritura(uuid, text) returns boolean language sql as
      $$ select $1 = '${owner}' and auth.uid() = '${editor}' $$;
    create function public.empresa_lectura(uuid, text) returns boolean language sql as
      $$ select $1 = '${owner}' and auth.uid() in ('${reader}', '${editor}') $$;
    create table public.cf_proyectos(id uuid primary key, user_id uuid);
    create table public.cf_planos(
      id bigint primary key, user_id uuid, updated_at timestamptz, payload jsonb,
      proyecto_id uuid, name text, nivel integer, scale numeric, status text,
      origen_x_px numeric, origen_y_px numeric, factor_x numeric, factor_y numeric,
      cal_global boolean, defined_scale numeric
    );
    create function public.save_plano_data_impl(bigint, jsonb) returns void language sql as
      $$ update public.cf_planos set payload = $2 where id = $1 $$;
    insert into auth.users values ('${owner}'), ('${reader}'), ('${stranger}'), ('${editor}');
  `);
  await apply('20260730000002_civilflow_storage');
  // Aplicar el bloque real de Storage; empresa_* es el contrato simulado de membresía.
  const company = await readFile(new URL('../migrations/20261005000000_empresa_escritura.sql', import.meta.url), 'utf8');
  const storage = company.match(/create or replace function public\.uuid_seguro[\s\S]*?(?=-- ═══ VERIFICACIÓN)/);
  assert.ok(storage, 'bloque de políticas PDF');
  await db.exec(storage[0]);
  await apply('20260814000001_cm_schema');
  // Las policies de empresa reales se despliegan por separado. El fixture representa un miembro con lectura.
  await db.exec(`
    alter table public.cm_config add column if not exists config_listas jsonb default '{}'::jsonb;
    alter table public.cm_config add column if not exists categorias_apu jsonb default '[]'::jsonb;
    grant select on all tables in schema public to authenticated;
    grant insert on public.cm_config to authenticated;
    grant update on public.cm_proyectos to authenticated;
    create policy cm_fixture_shared on public.cm_proyectos for select to authenticated
      using (public.empresa_lectura(user_id, 'manage'));
    create policy cm_fixture_shared on public.cm_proveedores for select to authenticated
      using (public.empresa_lectura(user_id, 'manage'));
    insert into public.cm_proyectos(id,user_id,codigo,nombre) values
      ('${project}','${owner}','P1','Prueba'), ('${otherProject}','${stranger}','P2','Otro');
    insert into public.cm_proveedores(id,user_id,proyecto_id,codigo)
      values ('otro','${stranger}','${otherProject}','otro');
    insert into public.cf_proyectos values ('${project}','${owner}');
    insert into public.cf_planos (id,user_id,updated_at,payload,proyecto_id)
      values (1,'${owner}','2026-01-01T00:00:00Z','{}','${project}');
    insert into storage.objects values ('plan_pdfs', '${owner}/plano.pdf');
  `);
  await apply('20260903000000_cm_presupuesto_snaps');
  await apply('20261118000000_cm_doctrina_fixes');
  await apply('20261123000000_cm_save_integrity');
  await apply('20261123000001_cm_read_scope');
  await apply('20261123000002_save_versions');
  await apply('20261127000000_cm_save_parcial_y_cierre');
  const metaSql = await readFile(new URL('../migrations/20260925000000_repara_rpcs_reaplicacion_vieja.sql', import.meta.url), 'utf8');
  const metaRpc = metaSql.match(/create or replace function public\.save_planos_meta\([\s\S]*?\$\$;/);
  assert.ok(metaRpc, 'definición de guardado de metadatos');
  await db.exec(metaRpc[0].replace('p_proyecto_id bigint', 'p_proyecto_id uuid'));
  await apply('20261124000000_cf_separate_drawing_version');
  await db.exec('set role authenticated');
  await as(owner);
  const rename = () => db.query('update public.cm_proyectos set nombre = nombre where id = $1 returning id', [project]);
  assert.equal((await rename()).rows.length, 1);
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
  let third = await save(
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

  /* SAVE PARCIAL (2026-11-27): colección AUSENTE conserva sus filas — una pestaña vieja deja
   * de reponer lo que nunca editó; la colección enviada manda (LWW sobre lo enviado). */
  const tokenParcial = (
    await db.query('select public.cm_save_state_versioned($1, $2, $3) as token', [
      project,
      JSON.stringify({ insumos: [{ id: 'ins', proveedor_id: null, costo_unitario: 2222 }] }),
      third,
    ])
  ).rows[0].token;
  snapshot = await read(project);
  assert.equal(snapshot.proveedores[0].nombre, 'Conservar');
  assert.equal(snapshot.proveedores[0].tipo[0], 'material');
  assert.equal(snapshot.insumos[0].costo_unitario, 2222);
  assert.equal(await version(), tokenParcial);

  /* Preferencias de cuenta: solo se escriben si el payload las trae. */
  await db.query("insert into public.cm_config(user_id, config) values ($1, $2)", [
    owner,
    JSON.stringify({ pais: 'CO' }),
  ]);
  const tokenParcial2 = (
    await db.query('select public.cm_save_state_versioned($1, $2, $3) as token', [
      project,
      JSON.stringify({ insumos: [{ id: 'ins', costo_unitario: 3333 }] }),
      tokenParcial,
    ])
  ).rows[0].token;
  const cfg = (
    await db.query('select config from public.cm_config where user_id = $1', [owner])
  ).rows[0].config;
  assert.equal(cfg.pais, 'CO');
  // H-13: configuraciones DISJUNTAS de la misma cuenta sobreviven (merge por clave en
  // cm_config) — guardar config y config_listas por separado conserva ambas ediciones.
  const tCfg = (
    await db.query('select public.cm_save_state_versioned($1, $2, $3) as token', [
      project,
      JSON.stringify({ config: { pais: 'CO' } }),
      tokenParcial2,
    ])
  ).rows[0].token;
  const tCfg2 = (
    await db.query('select public.cm_save_state_versioned($1, $2, $3) as token', [
      project,
      JSON.stringify({ config_listas: { bandera: true } }),
      tCfg,
    ])
  ).rows[0].token;
  const cfg2 = (
    await db.query('select config, config_listas from public.cm_config where user_id = $1', [owner])
  ).rows[0];
  assert.equal(cfg2.config.pais, 'CO');
  assert.equal(cfg2.config_listas.bandera, true);

  // El reloj avanzó con los guardados parciales: los tests de roles siguen desde el token nuevo.
  third = tCfg2;

  const savePlan = async (token) =>
    (
      await db.query('select public.save_plano_data_versioned(1, \'{"v":1}\', $1) as token', [
        token,
      ])
    ).rows[0].token;
  const plan1 = await savePlan('2026-01-01T00:00:00Z');
  await db.query('select public.save_planos_meta($1, $2)', [
    project,
    JSON.stringify([{ id: 1, name: 'Piso 1', scale: 66.6667, origen_x_px: 12 }]),
  ]);
  const { rows: [metaGuardada] } = await db.query('select name, scale from public.cf_planos where id = 1');
  assert.equal(metaGuardada.name, 'Piso 1');
  assert.equal(Number(metaGuardada.scale), 66.6667);
  // El guardado de calibración cambió el meta, pero no invalida la versión de los trazos.
  let plan2 = await savePlan(plan1);
  assert.notEqual(plan1, plan2);
  await assert.rejects(savePlan(plan1), /conflicto_concurrencia/);
  // Cliente ANTERIOR sobre el backend nuevo (H-08, G3): las firmas sin versión siguen
  // funcionando durante la transición. cm_save_state a 2 args (sin reloj) y
  // save_plano_data con el token QUE EL CLIENTE LEYÓ (get_plano_data trae updated_at).
  await as(owner);
  await db.query(
    'select public.cm_save_state($1, $2)',
    [project, JSON.stringify({ ...state, proveedores: [{ id: 'prov', nombre: 'Antiguo' }] })],
  );
  const snapAntiguo = await read(project);
  assert.equal(snapAntiguo.proveedores[0].nombre, 'Antiguo');
  await db.query("select public.save_plano_data(1, '{\"v\":2}', null)");
  const planoTs = (
    await db.query('select updated_at from public.cf_planos where id=1')
  ).rows[0].updated_at.toISOString();
  const plan3 = (
    await db.query("select public.save_plano_data_versioned(1, '{\"v\":3}', $1) as token", [
      planoTs,
    ])
  ).rows[0].token;
  assert.notEqual(plan3, planoTs);
  console.log('Cliente anterior (firmas sin versión) sobre el backend nuevo: OK');
  // El cliente antiguo adelantó AMBOS relojes: los tokens de las pruebas de roles se
  // re-leen para que el editor siga teniendo una base vigente.
  third = await version();
  plan2 = (
    (await db.query('select updated_at from public.cf_planos where id=1'))
  ).rows[0].updated_at.toISOString();
  await as(owner);
  await as(reader);
  assert.equal((await read(project)).proveedores.length, 1);
  await assert.rejects(save({}, third), /no_autorizado/);
  assert.equal((await rename()).rows.length, 0);
  await assert.rejects(savePlan(plan2), /plano_no_encontrado_o_sin_acceso/);
  const pdfs = () => db.query("select name from storage.objects where bucket_id = 'plan_pdfs'");
  assert.equal((await pdfs()).rows.length, 1);
  const addPdf = () => db.query("insert into storage.objects values ('plan_pdfs', $1)", [`${owner}/nuevo.pdf`]);
  await assert.rejects(addPdf(), /row-level security/i);
  await as(editor);
  const edited = await save({}, third);
  assert.notEqual(edited, third);
  assert.notEqual(await savePlan(plan2), plan2);
  assert.equal((await rename()).rows.length, 0);
  await addPdf();
  assert.equal((await pdfs()).rows.length, 2);
  await as(stranger);
  assert.equal(await read(project), null);
  assert.equal((await rename()).rows.length, 0);
  assert.equal((await pdfs()).rows.length, 0);
  await db.exec('set role anon');
  await as('');
  assert.equal((await pdfs()).rows.length, 0);
  await assert.rejects(read(project), /permission denied/i);
  console.log('Contratos SQL: omisión, nulos, rollback, lectura por rol y versiones OK');
} finally {
  await db.close();
}
