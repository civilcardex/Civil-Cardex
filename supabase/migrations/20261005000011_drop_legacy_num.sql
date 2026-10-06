-- Fin del ciclo legacy: correr DESPUÉS de scripts/migrar-storage-uuid.mjs (los PDFs deben
-- estar ya movidos a carpetas uuid — el script imprime el resumen). Elimina la columna de
-- legado y su RPC de apoyo. El cliente (fallback legacy) se actualiza en el mismo deploy.
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable (la columna ya no existe → no-op).

drop function if exists public.get_proyectos_para_migrar_storage();

alter table public.cf_proyectos drop column if exists legacy_num;
