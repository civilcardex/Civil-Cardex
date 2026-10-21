// Contexto de ayuda (orig. usuario): cada área de trabajo reporta módulo + pestaña activa y
// la navbar muestra el botón AYUDA contextual. Pub-sub mínimo en vez de re-wire de providers:
// la navbar vive FUERA de los providers de las rutas y los componentes que YA conocen su
// pestaña solo la reportan con un useEffect. setAyudaContext es idempotente (compara por
// JSON) para que un emisor repetido no dispare renders.
import { useSyncExternalStore } from 'react';

export interface AyudaContexto {
  /** Clave de la guía detallada (cf:<tab> · cf:iso:<sub> · cm:catalogos:<tab> · cm:<seccion>). */
  key: string;
  /** Módulo visible al usuario («Civil Flow», «Civil Manager»). */
  modulo: string;
  /** Pestaña/sección activa legible («Dibujo de redes», «Análisis de precios unitarios»…). */
  seccion: string;
  /** 1-2 líneas de qué se hace en esa pestaña. */
  intro: string;
}

let ctx: AyudaContexto | null = null;
let json = 'null';
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Reporta el contexto actual de la pestaña (o null al desmontarse la vista). */
export function setAyudaContext(next: AyudaContexto | null): void {
  const nj = JSON.stringify(next);
  if (nj === json) return;
  json = nj;
  ctx = next;
  emit();
}

function getAyudaContext(): AyudaContexto | null {
  return ctx;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Suscripción reactiva para la navbar. */
export function useAyudaContext(): AyudaContexto | null {
  return useSyncExternalStore(subscribe, getAyudaContext, getAyudaContext);
}
