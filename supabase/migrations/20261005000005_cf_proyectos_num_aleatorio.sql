-- proyecto_num ALEATORIO para proyectos NUEVOS (ped. usuario: nada secuencial visible —
-- paridad cm_proyectos donde el id es aleatorio). Los existentes conservan su número (los
-- hijos referencian proyecto_id numérico: renumerar exigiría mapear ~10 tablas sin ganancia).
--
-- La ruta /civilflowareatrabajo/:id ya muestra el UUID (cf_proyectos.id); con esto, el
-- número interno de los proyectos nuevos también es aleatorio de 10 dígitos.
-- El PK es unique → una colisión del default (espacio ~9×10⁹) falla el insert y el usuario
-- reintenta: probabilidad despreciable. Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

alter table public.cf_proyectos alter column proyecto_num drop identity;
alter table public.cf_proyectos alter column proyecto_num
  set default 1000000000 + floor(random() * 9000000000)::bigint;

notify pgrst, 'reload schema';
