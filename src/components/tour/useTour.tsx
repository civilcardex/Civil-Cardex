// Disparo del tour la PRIMERA vez que se entra a una pantalla (por navegador): si la marca
// `cardex_tour_<clave>` no existe y hay espacio de escritorio (≥1024px, donde los apartados
// anclables existen), monta el overlay. Clave CRUDA (patrón cookie-consent): sobrevive al
// logout y al cambio de proyecto — salir del visor NO relanza el tour.
// `listo` (opcional) pospone el arranque (p. ej. hasta que baje la pantalla de carga).
import { useEffect, useState } from 'react';
import { TourOverlay } from './TourOverlay.tsx';
import { TOURS, type TourClave } from './tourSteps.ts';

const marcaDe = (clave: TourClave): string => `cardex_tour_${clave.replace(/[:]/g, '_')}`;

/** Evento «Repetir tour» (HelpPanel): la pantalla correspondiente lo lanza al vuelo. */
const EV_TOUR_REPETIR = 'cardex_tour_repetir';

function marcarTourVisto(clave: TourClave): void {
  try {
    localStorage.setItem(marcaDe(clave), '1');
  } catch {
    /* sin storage: se verá otra vez, no rompe */
  }
}

/** Borra la marca y avisa a la pantalla activa para que el tour vuelva a salir ahora. */
export function repetirTour(clave: TourClave): void {
  try {
    localStorage.removeItem(marcaDe(clave));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EV_TOUR_REPETIR, { detail: clave }));
}

export function useTour(clave: TourClave, listo = true): React.ReactElement | null {
  const [activo, setActivo] = useState(false);
  const pasos = TOURS[clave];

  useEffect(() => {
    if (!listo || activo || !pasos) return;
    let visto = true;
    try {
      visto = localStorage.getItem(marcaDe(clave)) != null;
    } catch {
      /* sin storage: no lanzar */
    }
    // <1024px los anclas colapsan (sidebars) — el tour iría todo centrado; se pospone.
    const debeSalir = !visto && window.matchMedia('(min-width: 1024px)').matches;
    if (!debeSalir) return;
    // Fuera del cuerpo síncrono del effect (regla react-compiler): una microtarea basta —
    // el tour arranca un tick después del primer paint de la pantalla.
    const t = window.setTimeout(() => setActivo(true), 0);
    return () => window.clearTimeout(t);
  }, [clave, listo, activo, pasos]);

  // «Repetir tour» desde el panel de Ayuda de ESTA pantalla.
  useEffect(() => {
    const onRepetir = (e: Event) => {
      if ((e as CustomEvent<TourClave>).detail === clave) setActivo(true);
    };
    window.addEventListener(EV_TOUR_REPETIR, onRepetir);
    return () => window.removeEventListener(EV_TOUR_REPETIR, onRepetir);
  }, [clave]);

  // Marca al ARRANCAR (no al terminar): recargar a mitad no relanza el tour.
  useEffect(() => {
    if (activo) marcarTourVisto(clave);
  }, [activo, clave]);

  if (!pasos || !activo) return null;
  // key={clave}: cambio de pestaña remonta el overlay → idx nace en el primer paso.
  return <TourOverlay key={clave} steps={pasos} onEnd={() => setActivo(false)} />;
}
