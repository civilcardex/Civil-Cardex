/** Polyfill de crypto.randomUUID (ped. usuario 2026-11-25: tablet por LAN/HTTP):
 *  randomUUID SOLO existe en contexto seguro (HTTPS/localhost) — por IP de red local el
 *  navegador no lo expone y cualquier id nuevo (borrador, split de ramal, filas CM…) crashea
 *  con «crypto.randomUUID is not a function». El fallback v4 usa getRandomValues, que SÍ
 *  está disponible en contextos inseguros. Importar UNA vez en el entry, antes de la app. */
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  (crypto as { randomUUID?: () => string }).randomUUID = (): string =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))) >>>
        0
      ).toString(16),
    );
}
