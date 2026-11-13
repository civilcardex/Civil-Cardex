import { useEffect, useRef } from 'react';

/**
 * Capa de modal NATIVA: <dialog> + showModal (top layer). El navegador da gratis lo que
 * antes se programaba a mano: foco atrapado dentro, Escape (evento `cancel`) y foco
 * devuelto al elemento que abrió. Ej:
 * <ModalOverlay onClose={() => setAbierta(false)}><div style={...}>...</div></ModalOverlay>.
 *
 * OJO top layer: showModal SIEMPRE pinta por ENCIMA de cualquier z-index — por eso los
 * portales a body (menús, tours) que antes ganaban por z-index ahora quedan DEBAJO de la
 * modal abierta; si un modal necesita algo flotante encima, debe vivir DENTRO del dialog.
 */
export function ModalOverlay(props: {
  /** Cerrar al Escape o al hacer clic fuera del contenido. Omitir = sin cierre propio
   *  (checkout/confirmación no se descartan por un clic fuera). */
  onClose?: () => void;
  /** NO-OP desde la migración a <dialog>: el top layer va encima de todo z-index. Se acepta
   *  porque 12+ consumidores lo pasan (visores 9999/99999, tabs rci 60) — no borrar. */
  zIndex?: number;
  /** aria-label del diálogo cuando el consumidor no trae título propio (ModalShell). */
  ariaLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { onClose, ariaLabel, children } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg || dlg.open) return;
    dlg.showModal();
    // Foco inicial al CONTENEDOR del contenido (no al primer botón, que saltaría dentro de
    // la card): el consumidor que quiere otro foco lo mueve con su propio rAF.
    focoRef.current?.focus();
    return () => {
      // Cerrar explícito (aunque venga de unmount): close() es lo que devuelve el foco al
      // opener; si solo se elimina el nodo, el foco se pierde al body. Guard open por
      // doble-montaje (StrictMode).
      if (dlg.open) dlg.close();
    };
  }, []);

  return (
    // El dialog ES la capa completa (centrado + aire de 20px por .civ-modal); el fondo
    // oscuro lo pinta dialog.civ-modal::backdrop en index.css. El click-fuera cierra con
    // onClick, pero el requisito de teclado lo cumple el dialog NATIVO: Escape dispara
    // `cancel` (manejado arriba) — las reglas jsx-a11y no ven esa semántica y se silencian.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="civ-modal"
      aria-label={ariaLabel}
      // Escape: el navegador dispara `cancel` y cerraría el dialog; preventDefault + onClose
      // deja el cierre en manos del consumidor (su unmount dispara el close del cleanup).
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      // Click-fuera: solo cierra si el clic no fue dentro del contenido (target===
      // currentTarget); si no, cualquier clic dentro burbujea y cierra (bug guía RCI).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* Contenedor de foco inicial: tabIndex -1 = enfocable por código, fuera del ciclo Tab. */}
      <div ref={focoRef} tabIndex={-1} className="modal-overlay-focus">
        {children}
      </div>
    </dialog>
  );
}

/**
 * Overlay + card compartidos por los modales de la app: dialog nativo a pantalla completa
 * con backdrop oscuro y card centrada con la superficie estándar. Ej:
 * <ModalShell ariaLabel="Checkout de pago">...contenido...</ModalShell>.
 */
export function ModalShell(props: {
  minWidth?: number;
  ariaLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { minWidth = 360, ariaLabel, children } = props;
  // Sin onClose: el backdrop NO cierra — el checkout ni la confirmación se descartan por un
  // clic fuera. El aria-label va sobre el <dialog> (su rol dialog es nativo, sin aria-modal
  // a mano: showModal ya la implica).
  return (
    <ModalOverlay ariaLabel={ariaLabel}>
      {/* minWidth solo se pisa por estilo cuando el consumidor lo pide (360 es el default de la clase). */}
      <div className="modal-shell-card" style={{ minWidth }}>
        {children}
      </div>
    </ModalOverlay>
  );
}
