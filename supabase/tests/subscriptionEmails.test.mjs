import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const sandboxUser = '10000000-0000-4000-8000-000000000001';
const productionUser = '10000000-0000-4000-8000-000000000002';

test('la cola distingue entornos y envía un aviso por cada vigencia', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create table public.app_pagos (
        id bigint primary key, user_id uuid, estado text, paddle_customer_id text,
        modulos text[], monto_centavos bigint, moneda text, referencia text, aprobado_at timestamptz
      );
      create table public.app_suscripciones (
        id bigint primary key, user_id uuid, modulo text, estado text, fecha_fin timestamptz
      );
      create table public.app_paddle_customers (customer_id text, entorno text);
      insert into auth.users values
        ('${sandboxUser}', 'sandbox@example.test', now()),
        ('${productionUser}', 'production@example.test', now());
    `);
    const migration = await readFile(
      new URL('../migrations/20261124000003_subscription_emails.sql', import.meta.url), 'utf8',
    );
    await db.exec(migration);
    await db.exec(`
      insert into public.app_pagos values
        (1, '${sandboxUser}', 'pendiente', null, array['flow'], 2500, 'USD', 'test', now(), 'sandbox'),
        (2, '${productionUser}', 'pendiente', null, array['manage'], 2500, 'USD', 'live', now(), 'production'),
        (3, '${sandboxUser}', 'pendiente', null, array['manage'], 2500, 'USD', 'decline', null, 'sandbox');
      insert into public.app_suscripciones values
        (1, '${sandboxUser}', 'flow', 'activa', now() + interval '7 days'),
        (2, '${productionUser}', 'manage', 'activa', now() + interval '8 days');
      update public.app_pagos set estado = 'aprobado' where id in (1, 2);
      update public.app_pagos set estado = 'aprobado' where id in (1, 2);
      set role service_role;
    `);
    const sandbox = async () => (await db.query(
      "select * from public.reclamar_correos_suscripcion('sandbox', $1)",
      [sandboxUser],
    )).rows;
    const first = await sandbox();
    assert.deepEqual(first.map(({ tipo }) => tipo).sort(), ['pago', 'vencimiento']);
    assert.ok(first.every(({ email, modulos }) => email === 'sandbox@example.test' && modulos[0] === 'flow'));
    assert.deepEqual(await sandbox(), []);
    await db.exec(`
      reset role;
      update public.app_subscription_emails
      set procesar_desde = now() - interval '1 minute' where entorno = 'sandbox';
      update public.app_suscripciones set fecha_fin = now() + interval '1 month' where id = 1;
      set role service_role;
    `);
    const retry = await sandbox();
    assert.deepEqual(retry.map(({ clave, intentos }) => [clave, intentos]), [['pago/1', 2]]);
    const live = (await db.query(
      "select * from public.reclamar_correos_suscripcion('production', null)",
    )).rows;
    assert.deepEqual(live.map(({ clave, email }) => [clave, email]), [['pago/2', 'production@example.test']]);
    await db.exec('reset role; set role authenticated;');
    await assert.rejects(db.query('select * from public.app_subscription_emails'), /permission denied/);
    await assert.rejects(db.query(
      "select * from public.reclamar_correos_suscripcion('production', null)",
    ), /permission denied/);
  } finally {
    await db.close();
  }
});
