-- =========================================================================
-- CivilFlow — cierre del hueco RLS de propiedad de proyecto/plano
--
-- Problema: las policies INSERT/UPDATE de las tablas hijas solo verificaban
-- `auth.uid() = user_id`, pero el cliente manda `user_id` + `proyecto_id` /
-- `plano_id` en el payload. Un atacante podía INSERT con su propio user_id y
-- un proyecto/plano ajeno (el with-check pasa), contaminando el proyecto de
-- la víctima con filas falsas; o re-apuntar sus propias filas con UPDATE.
--
-- Fix: cada INSERT/UPDATE en tablas hijas verifica además que el proyecto o
-- plano referenciado pertenezca al caller (subconsulta EXISTS). DELETE no
-- cambia: `using (auth.uid() = user_id)` ya bloquea filas ajenas.
--
-- Rollback: recrear las policies originales (DROP + CREATE con el check
-- simple de user_id) — ver comentarios DOWN al final de cada bloque.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Tablas por proyecto_id
-- ---------------------------------------------------------------------------

drop policy if exists "pisos_propietario_insertar" on public.pisos;
drop policy if exists "pisos_propietario_actualizar" on public.pisos;
create policy "pisos_propietario_insertar" on public.pisos for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = pisos.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "pisos_propietario_actualizar" on public.pisos for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = pisos.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "proyecto_general_propietario_insertar" on public.proyecto_general;
drop policy if exists "proyecto_general_propietario_actualizar" on public.proyecto_general;
create policy "proyecto_general_propietario_insertar" on public.proyecto_general for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = proyecto_general.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "proyecto_general_propietario_actualizar" on public.proyecto_general for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = proyecto_general.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "materiales_proyecto_propietario_insertar" on public.materiales_proyecto;
drop policy if exists "materiales_proyecto_propietario_actualizar" on public.materiales_proyecto;
create policy "materiales_proyecto_propietario_insertar" on public.materiales_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = materiales_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "materiales_proyecto_propietario_actualizar" on public.materiales_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = materiales_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "profundidades_proyecto_propietario_insertar" on public.profundidades_proyecto;
drop policy if exists "profundidades_proyecto_propietario_actualizar" on public.profundidades_proyecto;
create policy "profundidades_proyecto_propietario_insertar" on public.profundidades_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = profundidades_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "profundidades_proyecto_propietario_actualizar" on public.profundidades_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = profundidades_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "criterios_proyecto_propietario_insertar" on public.criterios_proyecto;
drop policy if exists "criterios_proyecto_propietario_actualizar" on public.criterios_proyecto;
create policy "criterios_proyecto_propietario_insertar" on public.criterios_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = criterios_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "criterios_proyecto_propietario_actualizar" on public.criterios_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = criterios_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "planos_propietario_insertar" on public.planos;
drop policy if exists "planos_propietario_actualizar" on public.planos;
create policy "planos_propietario_insertar" on public.planos for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = planos.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "planos_propietario_actualizar" on public.planos for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = planos.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "gas_datos_proyecto_propietario_insertar" on public.gas_datos_proyecto;
drop policy if exists "gas_datos_proyecto_propietario_actualizar" on public.gas_datos_proyecto;
create policy "gas_datos_proyecto_propietario_insertar" on public.gas_datos_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = gas_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "gas_datos_proyecto_propietario_actualizar" on public.gas_datos_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = gas_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "ep_datos_proyecto_propietario_insertar" on public.ep_datos_proyecto;
drop policy if exists "ep_datos_proyecto_propietario_actualizar" on public.ep_datos_proyecto;
create policy "ep_datos_proyecto_propietario_insertar" on public.ep_datos_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = ep_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "ep_datos_proyecto_propietario_actualizar" on public.ep_datos_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = ep_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "bomba_datos_proyecto_propietario_insertar" on public.bomba_datos_proyecto;
drop policy if exists "bomba_datos_proyecto_propietario_actualizar" on public.bomba_datos_proyecto;
create policy "bomba_datos_proyecto_propietario_insertar" on public.bomba_datos_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = bomba_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "bomba_datos_proyecto_propietario_actualizar" on public.bomba_datos_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = bomba_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "anulaciones_bajantes_pluviales_propietario_insertar" on public.anulaciones_bajantes_pluviales;
drop policy if exists "anulaciones_bajantes_pluviales_propietario_actualizar" on public.anulaciones_bajantes_pluviales;
create policy "anulaciones_bajantes_pluviales_propietario_insertar" on public.anulaciones_bajantes_pluviales for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = anulaciones_bajantes_pluviales.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "anulaciones_bajantes_pluviales_propietario_actualizar" on public.anulaciones_bajantes_pluviales for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = anulaciones_bajantes_pluviales.proyecto_id and p.user_id = (select auth.uid()))
);

drop policy if exists "anulaciones_canales_pluviales_propietario_insertar" on public.anulaciones_canales_pluviales;
drop policy if exists "anulaciones_canales_pluviales_propietario_actualizar" on public.anulaciones_canales_pluviales;
create policy "anulaciones_canales_pluviales_propietario_insertar" on public.anulaciones_canales_pluviales for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = anulaciones_canales_pluviales.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "anulaciones_canales_pluviales_propietario_actualizar" on public.anulaciones_canales_pluviales for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.proyectos p where p.id = anulaciones_canales_pluviales.proyecto_id and p.user_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- Tablas por plano_id
-- ---------------------------------------------------------------------------

drop policy if exists "planos_ramales_propietario_insertar" on public.planos_ramales;
drop policy if exists "planos_ramales_propietario_actualizar" on public.planos_ramales;
create policy "planos_ramales_propietario_insertar" on public.planos_ramales for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_ramales.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_ramales_propietario_actualizar" on public.planos_ramales for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_ramales.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_bajantes_propietario_insertar" on public.planos_bajantes;
drop policy if exists "planos_bajantes_propietario_actualizar" on public.planos_bajantes;
create policy "planos_bajantes_propietario_insertar" on public.planos_bajantes for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_bajantes.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_bajantes_propietario_actualizar" on public.planos_bajantes for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_bajantes.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_areas_propietario_insertar" on public.planos_areas;
drop policy if exists "planos_areas_propietario_actualizar" on public.planos_areas;
create policy "planos_areas_propietario_insertar" on public.planos_areas for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_areas.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_areas_propietario_actualizar" on public.planos_areas for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_areas.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_dimensiones_propietario_insertar" on public.planos_dimensiones;
drop policy if exists "planos_dimensiones_propietario_actualizar" on public.planos_dimensiones;
create policy "planos_dimensiones_propietario_insertar" on public.planos_dimensiones for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_dimensiones.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_dimensiones_propietario_actualizar" on public.planos_dimensiones for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_dimensiones.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_anotaciones_texto_propietario_insertar" on public.planos_anotaciones_texto;
drop policy if exists "planos_anotaciones_texto_propietario_actualizar" on public.planos_anotaciones_texto;
create policy "planos_anotaciones_texto_propietario_insertar" on public.planos_anotaciones_texto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_anotaciones_texto.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_anotaciones_texto_propietario_actualizar" on public.planos_anotaciones_texto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_anotaciones_texto.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_lineas_guia_propietario_insertar" on public.planos_lineas_guia;
drop policy if exists "planos_lineas_guia_propietario_actualizar" on public.planos_lineas_guia;
create policy "planos_lineas_guia_propietario_insertar" on public.planos_lineas_guia for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_lineas_guia.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_lineas_guia_propietario_actualizar" on public.planos_lineas_guia for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_lineas_guia.plano_id and pl.user_id = (select auth.uid()))
);

drop policy if exists "planos_fantasmas_entrepisos_propietario_insertar" on public.planos_fantasmas_entrepisos;
drop policy if exists "planos_fantasmas_entrepisos_propietario_actualizar" on public.planos_fantasmas_entrepisos;
create policy "planos_fantasmas_entrepisos_propietario_insertar" on public.planos_fantasmas_entrepisos for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_fantasmas_entrepisos.plano_id and pl.user_id = (select auth.uid()))
);
create policy "planos_fantasmas_entrepisos_propietario_actualizar" on public.planos_fantasmas_entrepisos for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos pl where pl.id = planos_fantasmas_entrepisos.plano_id and pl.user_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- bajante_conexiones — sin proyecto_id/plano_id propio; las dos bajantes
-- referenciadas deben pertenecer al caller (vía planos_bajantes.user_id).
-- ---------------------------------------------------------------------------

drop policy if exists "bajante_conexiones_propietario_insertar" on public.bajante_conexiones;
drop policy if exists "bajante_conexiones_propietario_actualizar" on public.bajante_conexiones;
create policy "bajante_conexiones_propietario_insertar" on public.bajante_conexiones for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos_bajantes bo where bo.id = bajante_conexiones.bajante_origen_id and bo.user_id = (select auth.uid()))
  and exists (select 1 from public.planos_bajantes bd where bd.id = bajante_conexiones.bajante_destino_id and bd.user_id = (select auth.uid()))
);
create policy "bajante_conexiones_propietario_actualizar" on public.bajante_conexiones for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planos_bajantes bo where bo.id = bajante_conexiones.bajante_origen_id and bo.user_id = (select auth.uid()))
  and exists (select 1 from public.planos_bajantes bd where bd.id = bajante_conexiones.bajante_destino_id and bd.user_id = (select auth.uid()))
);
