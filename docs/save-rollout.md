# Publicación y recuperación del guardado

1. Validar las migraciones `20261123000000` a `20261123000002` en una base de *staging* con el historial y las políticas de empresa del entorno destino. El contrato local usa PostgreSQL desechable: no verifica las políticas desplegadas ni el historial remoto.
2. Probar con cuentas de dueño, miembro lector, miembro editor y tercero. El cliente nuevo requiere los RPC de guardado con versión; las firmas anteriores quedan para los clientes ya abiertos durante la transición.
3. Ante un conflicto, no se repite el guardado sin reloj. Conservar el navegador y la sesión hasta respaldar el borrador y compararlo con la nube. El respaldo vigente de CivilManager está en IndexedDB, base `CivilManagerDB`, almacén `state`, clave JSON `[userId, proyectoId]`. En CivilFlow, si se eligió la copia de nube al cargar, el borrador archivado tiene la clave local `civilflow_plano_borrador_rescate_<userId>:<planoId>`.
4. Recuperación manual del registro CivilManager anterior: en el navegador donde se creó, abrir el inspector de almacenamiento y exportar el campo `d` de la entrada histórica `civilmanager` (misma base y almacén). El registro no incluye cuenta ni proyecto fiables. Verificar localmente a quién pertenece antes de copiar datos al proyecto correcto, usando los importadores de los catálogos donde apliquen. La app no lo lee de forma automática ni lo sube al iniciar sesión.

No activar pagos sin una prueba integral en el sandbox de Paddle. Dejar por separado el resultado de Chromium emulado y el de Safari de iPadOS y Chrome de Android en dispositivos reales.

## Revisión mínima del backend para el cliente actual

El cliente CivilManager (guarda parcial + cierre) exige en el destino, como mínimo: `20261123000000`–`20261123000002` (integridad, alcance de lectura, versiones) y `20261127000000` (guarda parcial + cierre). El cliente CivilFlow exige `20261118000001` (concurrencia de planos). Un backend anterior debe bloquear la publicación del cliente nuevo; el contrato `supabase/tests/saveContracts.mjs` verifica ambas direcciones (cliente actual y firmas sin versión de clientes antiguos sobre el backend nuevo) y corre en CI antes del despliegue.

## Comprobaciones antes de publicar esta ronda

- Solicitar al responsable del entorno destino evidencia de solo lectura del historial de migraciones, políticas por fila, permisos de funciones de guardado y políticas del bucket privado de planos. No copiar credenciales, datos de proyectos ni tokens. El fixture local prueba las políticas PDF, pero simula la resolución de membresías; no certifica el despliegue.
- CivilManager solo avisa al detectar un conflicto: no sustituye la versión de la nube ni mueve el borrador local.
