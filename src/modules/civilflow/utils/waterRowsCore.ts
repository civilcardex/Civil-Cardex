/**
 * Diseño hidráulico de las redes af (Agua Fria)/ac (Agua Caliente): UC (Unidades de Consumo) y Q (Caudal) Hunter (método de probabilidad de uso simultáneo), diámetros y pérdidas por Hazen-Williams, con chequeo de presión por aparato.
 * Ej: RS1 con 2 lavamanos (1 UC) → fila con Qprob 0.116 L/s, diámetro 3/4" y Pin por pmax del aparato.
 *
 * Fachada (des-monolitización 2026-11-13): la implementación vive en waterRows/ —
 * types.ts (fila WnRow), connectivity.ts (grafo de conectividad desde los planos), loads.ts
 * (raíz + UC/Hunter acumulado), acometida.ts (bloque acometida af), pressures.ts (presiones por
 * tramo) y rows.ts (filas finales). Re-exporta TODO con los mismos nombres: los consumidores
 * siguen importando de aquí.
 */
export * from './waterRows/index.ts';
