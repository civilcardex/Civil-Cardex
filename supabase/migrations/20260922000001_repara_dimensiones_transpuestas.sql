-- Reparación de COTAS transpuestas en cf_planos_dimensiones (incidente 2026-09-22).
--
-- Contexto: entre la migración 20260914000000 y la aplicación de 20260922000000, el RPC
-- save_plano_data insertaba (x1,y1,x2,y2) ← (x1, x2, y1, y2): el bug era un SWAP entre
-- y1 y x2 (x1 y y2 iban a su columna correcta). El fix del RPC corrige hacia adelante,
-- pero las filas ya guardadas quedaron rotas: abrir el piso desde una sesión sin caché
-- local (otro dispositivo) sirve la fila transpuesta de BD y el autosave la re-persiste
-- fielmente → corrupción PERMANENTE.
--
-- Oráculo de detección: la columna `l` guarda la longitud ORIGINAL del doc. Con el swap,
-- la distancia ALMACENADA es sqrt((x2−x1)²+(y2−y1)²) calculada sobre coords rotadas (= |y1−x1|
-- en el caso degradado), mientras que la distancia CORRECTA reconstruida es
-- sqrt((y1−x1)² + (y2−x2)²) (y1 guardado es el y1 real, x2 guardado es el x2 real).
-- Fila transpuesta = "guardada ≠ l" Y "reconstruida = l" (tolerancia 1 %): falsos positivos ≈ 0.
--
-- ⚠️ APLICAR EN SQL EDITOR: correr el SELECT de diagnóstico PRIMERO, verificar que el conteo
-- tiene sentido (solo pisos guardados entre el 14 y el 22 de sep), y recién entonces el UPDATE.
-- Re-ejecutable: filas ya reparadas no vuelven a matchear el oráculo.
--
-- Ejemplo verificado: doc P1=(0,0) P2=(3,4) L=5 → guardado (0,3,0,4):
--   dist_guardada = sqrt(0²+1²) = 1 ≠ 5 · reconstruida = sqrt(3²+4²) = 5 ✓ → swap y1↔x2 → (0,0,3,4).

-- ── 1) DIAGNÓSTICO ──────────────────────────────────────────────────────────────────
--select d.id, d.plano_id, d.client_id, d.l,
--       round(sqrt((d.x2-d.x1)^2 + (d.y2-d.y1)^2)::numeric, 2)  as dist_guardada,
--       round(sqrt((d.y1-d.x1)^2 + (d.y2-d.x2)^2)::numeric, 2)  as dist_reconstruida
--from public.cf_planos_dimensiones d
--where d.l is not null
--  and abs(d.l - sqrt((d.x2-d.x1)^2 + (d.y2-d.y1)^2)) > 0.01 * greatest(d.l, 1)
--  and abs(d.l - sqrt((d.y1-d.x1)^2 + (d.y2-d.x2)^2)) < 0.01 * greatest(d.l, 1);

-- ── 2) REPARACIÓN (deshacer el swap: y1 ↔ x2; x1 e y2 no se tocan) ─────────────────
update public.cf_planos_dimensiones d
set y1 = d.x2,
    x2 = d.y1
where d.l is not null
  and abs(d.l - sqrt((d.x2-d.x1)^2 + (d.y2-d.y1)^2)) > 0.01 * greatest(d.l, 1)
  and abs(d.l - sqrt((d.y1-d.x1)^2 + (d.y2-d.x2)^2)) < 0.01 * greatest(d.l, 1);

-- ── 3) VERIFICACIÓN: debe devolver 0 ────────────────────────────────────────────────
--select count(*) from public.cf_planos_dimensiones d
--where d.l is not null
--  and abs(d.l - sqrt((d.x2-d.x1)^2 + (d.y2-d.y1)^2)) > 0.01 * greatest(d.l, 1)
--  and abs(d.l - sqrt((d.y1-d.x1)^2 + (d.y2-d.x2)^2)) < 0.01 * greatest(d.l, 1);
