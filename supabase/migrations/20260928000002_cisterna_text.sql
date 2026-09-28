-- CISTERNA: columnas a la convención de la tabla (auditoría ronda 7 R-3).
--
-- Las 25 columnas de cf_ep_datos_proyecto son `text not null default ''` (20260807000001) y
-- todo EPData del cliente es string. Las 7 de cisterna nacieron `numeric` desnudas (nullable,
-- sin default) en 20260925000004:
--   save: EP_DEFAULTS trae '' → jsonb_populate_recordset castea ''::numeric → excepción →
--         el RPC falla en silencio (devError only) y nada persiste.
--   load: PostgREST devuelve number → dec() llama .replace sobre un number → TypeError →
--         crash de la página al recargar tras un guardado válido.
-- Fix: text not null default '' — el cliente no cambia (dec() parsea al calcular).
-- Requiere 20260925000004 aplicada (las columnas existen). Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

alter table public.cf_ep_datos_proyecto
  alter column dot_l type text using coalesce(dot_l::text, ''),
  alter column dot_l set default '',
  alter column dot_l set not null,
  alter column n_usuarios type text using coalesce(n_usuarios::text, ''),
  alter column n_usuarios set default '',
  alter column n_usuarios set not null,
  alter column dias_aut type text using coalesce(dias_aut::text, ''),
  alter column dias_aut set default '',
  alter column dias_aut set not null,
  alter column bci_l type text using coalesce(bci_l::text, ''),
  alter column bci_l set default '',
  alter column bci_l set not null,
  alter column patm type text using coalesce(patm::text, ''),
  alter column patm set default '',
  alter column patm set not null,
  alter column pv type text using coalesce(pv::text, ''),
  alter column pv set default '',
  alter column pv set not null,
  alter column npshr type text using coalesce(npshr::text, ''),
  alter column npshr set default '',
  alter column npshr set not null;
