-- =========================================================================
-- CivilFlow — lockdown de escrituras (defensa en profundidad)
--
--  CORRER SOLO DESPUÉS de desplegar el código con las RPC de
--    20260813000002_rls_security_definer_writes.sql. Si este archivo corre
--    antes que el código nuevo, la app guarda directo a tablas y FALLA en
--    silencio (solo se registra en consola) — pérdida silenciosa de datos.
--
-- Quita los grants de INSERT/UPDATE/DELETE a `authenticated` en todas las
-- tablas de negocio. SELECT se mantiene (lecturas directas con RLS owner).
-- Las escrituras solo pueden ocurrir vía las funciones SECURITY DEFINER
-- (que corren como postgres y bypassan grants/RLS, con validación interna).
--
-- Rollback: regrant (las RLS policies siguen existiendo y acotando por fila).
-- =========================================================================

revoke insert, update, delete on table
  public.proyectos,
  public.perfiles,
  public.pisos,
  public.proyecto_general,
  public.materiales_proyecto,
  public.profundidades_proyecto,
  public.criterios_proyecto,
  public.planos,
  public.planos_ramales,
  public.planos_bajantes,
  public.bajante_conexiones,
  public.planos_areas,
  public.planos_dimensiones,
  public.planos_anotaciones_texto,
  public.planos_lineas_guia,
  public.planos_fantasmas_entrepisos,
  public.gas_datos_proyecto,
  public.ep_datos_proyecto,
  public.bomba_datos_proyecto,
  public.anulaciones_bajantes_pluviales,
  public.anulaciones_canales_pluviales,
  public.aparatos_usuario
from authenticated;

-- Catálogos globales (solo lectura para authenticated — sin policies de
-- escritura, pero este revoke cierra la superficie por grants también).
revoke insert, update, delete on table
  public.redes,
  public.aparatos_ud_base_global,
  public.aparatos_catalogo_global
from authenticated;
