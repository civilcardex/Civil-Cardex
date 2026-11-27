import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');

test('CivilFlow crea proyecto y perfil juntos, solo con una sesión autorizada', async () => {
  const db = new PGlite();
  const owner = '10000000-0000-4000-8000-000000000001';
  const other = '10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid stable language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function public.acceso_modulo(uuid, text) returns boolean stable language sql as
        $$ select $1 = '${owner}' and $2 = 'flow' $$;
      create function public.empresa_escritura(uuid, text) returns boolean stable language sql as
        $$ select false $$;
      create table public.cf_proyectos (
        id uuid primary key default gen_random_uuid(), user_id uuid not null,
        codigo text unique not null, nombre text not null
      );
      create table public.cf_proyecto_general (
        proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
        user_id uuid not null, nombre text, pais text, uso text, mat_rci text, mat_gas text,
        updated_at timestamptz default now(),
        constraint fixture_rollback check (uso <> 'Mixto')
      );
      alter table public.cf_proyectos enable row level security;
      alter table public.cf_proyecto_general enable row level security;
      grant select on public.cf_proyectos, public.cf_proyecto_general to authenticated;
      create policy owned on public.cf_proyectos for select to authenticated using (auth.uid() = user_id);
      create policy owned on public.cf_proyecto_general for select to authenticated using (auth.uid() = user_id);
      grant usage on schema auth to authenticated, anon;
      create function public.save_proyecto(text, text) returns jsonb language sql as $$ select '{}'::jsonb $$;
    `);
    const migration = await readFile(new URL('../migrations/20261126000000_cf_project_required_profile.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const cuota = await readFile(new URL('../migrations/20261128000000_cf_save_proyecto_cuota.sql', import.meta.url), 'utf8');
    await db.exec(cuota);
    const as = (id) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    const save = (codigo, pais, uso) => db.query(
      'select public.save_proyecto($1,$2,$3,$4) as proyecto', [codigo, ' Edificio de prueba ', pais, uso],
    );
    await db.exec('set role anon');
    await assert.rejects(save('ANON', 'Colombia', 'Comercial'), /permission denied/);
    await db.exec('set role authenticated');
    await as('');
    await assert.rejects(save('SIN-SESION', 'Colombia', 'Comercial'), /no_autenticado/);
    await as(other);
    await assert.rejects(save('SIN-ACCESO', 'Colombia', 'Comercial'), /suscripcion_requerida/);
    await as(owner);
    await assert.rejects(save('SIN-PAIS', null, 'Comercial'), /pais_invalido/);
    await assert.rejects(save('PAIS-INVALIDO', 'No existe', 'Comercial'), /pais_invalido/);
    await assert.rejects(save('SIN-USO', 'Colombia', null), /uso_invalido/);
    await assert.rejects(save('USO-INVALIDO', 'Colombia', 'Otro'), /uso_invalido/);
    await assert.rejects(save('ROLLBACK', 'Colombia', 'Mixto'), /fixture_rollback/);
    assert.equal((await db.query('select id from public.cf_proyectos')).rows.length, 0);
    /* Relleno de cuota (H-03) como dueño de la tabla: ANTERIOR + CF-01 + 197 = 199 al llegar
     * a CF-200 (la 200ª); CF-201 rebota. */
    await db.exec('set role postgres');
    await db.exec(
      "insert into public.cf_proyectos(user_id, codigo, nombre) select '" + owner +
      "', 'C'||g, 'Relleno '||g from generate_series(1,197) g",
    );
    await db.exec('set role authenticated');
    // El wrapper de TRANSICIÓN (2 args) sigue vivo — crea proyecto sin perfil.
    const anterior = (await db.query("select public.save_proyecto('ANTERIOR', 'Sin perfil')")).rows[0].save_proyecto;
    assert.equal(anterior.user_id, owner);
    const row = (await save('CF-01', 'Perú', 'Comercial')).rows[0].proyecto;
    assert.equal(row.user_id, owner);
    assert.deepEqual((await db.query('select nombre,pais,uso from public.cf_proyecto_general where proyecto_id=$1', [row.id])).rows,
      [{ nombre: 'Edificio de prueba', pais: 'Perú', uso: 'Comercial' }]);
    const material = (red, valor) => db.query('select public.save_cf_network_material($1,$2,$3)', [row.id, red, valor]);
    await assert.rejects(material('rci', 'Fuera del catálogo'), /material_invalido/);
    await material('rci', 'PVC C900 RDE 18');
    await material('gas', 'PE al PE');
    // H-03: cuota de 200 proyectos propios, serializada por cuenta (relleno sembrado
    // arriba como dueño de la tabla: ANTERIOR + CF-01 + 197 = 199 al llegar aquí).
    await save('CF-200', 'Colombia', 'Comercial');
    await assert.rejects(save('CF-201', 'Colombia', 'Comercial'), /demasiados_proyectos/);
    // Wrapper de transición (2 args): sigue vivo y con la misma cuota.
    await assert.rejects(db.query("select public.save_proyecto('WRAP-201', 'X')"), /demasiados_proyectos/);
    assert.equal((await db.query('select count(*)::int as n from public.cf_proyectos')).rows[0].n, 200);

    assert.deepEqual((await db.query('select pais,uso,mat_rci,mat_gas from public.cf_proyecto_general where proyecto_id = $1', [row.id])).rows,
      [{ pais: 'Perú', uso: 'Comercial', mat_rci: 'PVC C900 RDE 18', mat_gas: 'PE al PE' }]);
    await as(other);
    assert.equal((await db.query('select proyecto_id from public.cf_proyecto_general')).rows.length, 0);
  } finally {
    await db.close();
  }
});

test('el material de un montante viaja en el guardado y sobrevive un cliente anterior', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create table public.cf_planos_bajantes (
        plano_id bigint, client_id text, alt_deriv numeric, primary key (plano_id, client_id)
      );
      create function public.save_plano_data_impl(p_plano_id bigint, p_data jsonb) returns void
      language plpgsql security definer set search_path = public as $$
      begin
        insert into public.cf_planos_bajantes (plano_id, client_id, alt_deriv)
        select p_plano_id, r.client_id, r.alt_deriv
        from jsonb_populate_recordset(null::public.cf_planos_bajantes, p_data->'bajantes') r
        on conflict (plano_id, client_id) do update set alt_deriv = excluded.alt_deriv, client_id = excluded.client_id;
      end $$;
      revoke all on function public.save_plano_data_impl(bigint, jsonb) from public, authenticated;
    `);
    const migration = await readFile(new URL('../migrations/20261126000001_cf_standpipe_material.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    async function save(montante) {
      await db.query('select public.save_plano_data_impl(1, $1)', [JSON.stringify({ bajantes: [montante] })]);
    }
    await save({ client_id: 'MON-1', alt_deriv: 3, material: 'Acero SCH 40' });
    await save({ client_id: 'MON-1', alt_deriv: 4 });
    assert.deepEqual((await db.query('select alt_deriv, material from public.cf_planos_bajantes')).rows,
      [{ alt_deriv: '4', material: 'Acero SCH 40' }]);
    await save({ client_id: 'MON-1', alt_deriv: 5, material: 'Acero SCH 10' });
    assert.equal((await db.query('select material from public.cf_planos_bajantes')).rows[0].material, 'Acero SCH 10');
    await db.exec('set role authenticated');
    await assert.rejects(save({ client_id: 'MON-2' }), /permission denied/);
  } finally {
    await db.close();
  }
});
