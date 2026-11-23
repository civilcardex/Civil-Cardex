import { useLayoutEffect, useRef } from 'react';

/* Soporte del atributo closedby (light-dismiss declarativo): Chrome/Edge 134+, Firefox 141+;
 *  Safari aún no lo trae. Se resuelve UNA vez por módulo (no por render). */
const CLOSED_BY_OK =
  typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/**
 * Capa de modal NATIVA: <dialog> + showModal (top layer). El navegador da gratis lo que
 * antes se programaba a mano: foco atrapado dentro, Escape (evento `cancel`) y foco
 * devuelto al elemento que abrió. Ej:
 * <ModalOverlay onClose={() => setAbierta(false)}><div style={...}>...</div></ModalOverlay>.
 *
 * Clic-fuera: con `closedby="any"` el navegador lo maneja declarativo (el clic en el
 * backdrop dispara `cancel`, mismo camino que Escape — un solo handler). En navegadores
 * sin closedby (Safari) cae al onClick manual. Con `closedby="any"` SOLO el backdrop real
 * cierra: antes, un clic en el padding del dialog también cerraba (target===currentTarget).
 *
 * OJO top layer: showModal SIEMPRE pinta por ENCIMA de cualquier z-index — por eso los
 * portales a body (menús, tours) que antes ganaban por z-index ahora quedan DEBAJO de la
 * modal abierta; si un modal necesita algo flotante encima, debe vivir DENTRO del dialog.
 */
export function ModalOverlay(props: {
  /** Cerrar al Escape o al hacer clic fuera del contenido. Omitir = sin cierre propio
   *  (checkout/confirmación no se descartan por un clic fuera ni por Escape). */
  onClose?: () => void;
  /** Permite conservar Escape sin descartar el formulario al tocar fuera. */
  dismissOnBackdrop?: boolean;
  /** Deja que el navegador enfoque el primer control, en vez del contenedor. */
  nativeInitialFocus?: boolean;
  /** NO-OP desde la migración a <dialog>: el top layer va encima de todo z-index. Se acepta
   *  porque 12+ consumidores lo pasan (visores 9999/99999, tabs rci 60) — no borrar. */
  zIndex?: number;
  /** aria-label del diálogo cuando el consumidor no trae título propio (ModalShell). */
  ariaLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { onClose, dismissOnBackdrop = true, nativeInitialFocus, ariaLabel, children } = props;
  const closeFromBackdrop = dismissOnBackdrop ? onClose : undefined;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg || dlg.open) return;
    dlg.showModal();
    // Si se pide el foco nativo, el contenedor no es enfocable y se conserva la elección del navegador.
    focoRef.current?.focus();
    return () => {
      // Cerrar antes de que React retire el nodo para que el navegador devuelva el foco.
      if (dlg.open) dlg.close();
    };
  }, []);

  return (
    // El dialog ES la capa completa (centrado + aire de 20px por .civ-modal); el fondo
    // oscuro lo pinta dialog.civ-modal::backdrop en index.css. El requisito de teclado lo
    // cumple el dialog NATIVO: Escape dispara `cancel` — las reglas jsx-a11y no ven esa
    // semántica y se silencian.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      className="civ-modal"
      aria-label={ariaLabel}
      // Sin cierre por backdrop se conserva "closerequest", el valor nativo de un modal.
      // React 19 aún no tipa el atributo: cast.
      {...(closeFromBackdrop && CLOSED_BY_OK ? ({ closedby: 'any' } as object) : {})}
      // Escape Y clic-fuera (con closedby="any" el backdrop dispara `cancel`): preventDefault
      // frena el cierre nativo y deja el cierre en manos del consumidor (su unmount dispara
      // el close del cleanup).
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      // Fallback del clic-fuera para navegadores sin closedby (Safari): el clic sobre el
      // dialog mismo (el backdrop) y no dentro del contenido cierra. Con closedby soportado
      // este handler sobra (y el padding de 20px ya NO cierra — win del atributo).
      onClick={
        closeFromBackdrop && !CLOSED_BY_OK
          ? (e) => {
              if (e.target === e.currentTarget) closeFromBackdrop();
            }
          : undefined
      }
    >
      <div
        ref={nativeInitialFocus ? undefined : focoRef}
        tabIndex={nativeInitialFocus ? undefined : -1}
        className="modal-overlay-focus"
      >
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
  /** Opcional: al pasarla, click fuera y Escape cierran el modal (los informativos del EPC
   *  la usan; checkout/confirmación la omiten para NO descartarse por un clic fuera). */
  onClose?: () => void;
  dismissOnBackdrop?: boolean;
  nativeInitialFocus?: boolean;
}): React.ReactElement {
  const {
    minWidth = 360,
    ariaLabel,
    children,
    onClose,
    dismissOnBackdrop,
    nativeInitialFocus,
  } = props;
  // Sin onClose el backdrop NO cierra — el checkout ni la confirmación se descartan por un
  // clic fuera. El aria-label va sobre el <dialog> (su rol dialog es nativo, sin aria-modal
  // a mano: showModal ya la implica).
  return (
    <ModalOverlay
      ariaLabel={ariaLabel}
      onClose={onClose}
      dismissOnBackdrop={dismissOnBackdrop}
      nativeInitialFocus={nativeInitialFocus}
    >
      {/* minWidth solo se pisa por estilo cuando el consumidor lo pide (360 es el default de la clase). */}
      <div className="modal-shell-card" style={{ minWidth }}>
        {children}
      </div>
    </ModalOverlay>
  );
}
