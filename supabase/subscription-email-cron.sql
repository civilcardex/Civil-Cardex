-- Ejecutar en el proyecto que aloja la Edge Function. Antes, guardar en Vault
-- subscription_email_url (URL completa de la función) y subscription_email_cron_secret
-- (mismo valor que SUBSCRIPTION_EMAIL_CRON_SECRET en los secrets de Edge).
-- El job queda pausado hasta comprobar la configuración de Resend.
begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('subscription-emails', '* * * * *', $cron$
  select net.http_post(
    url := destino.decrypted_secret,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'X-Subscription-Email-Secret', credencial.decrypted_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 95000
  )
  from vault.decrypted_secrets destino
  cross join vault.decrypted_secrets credencial
  where destino.name = 'subscription_email_url'
    and credencial.name = 'subscription_email_cron_secret';
$cron$);

select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'subscription-emails';

commit;

-- Tras comprobar los secrets de correo, activar:
-- select cron.alter_job(jobid, active := true)
-- from cron.job where jobname = 'subscription-emails';
