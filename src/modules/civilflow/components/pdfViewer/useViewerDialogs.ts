/** Los dos modales del visor: confirmación genérica ("¿borrar todo?") y selector de accesorio en unión de ramal. Ej: triggerConfirm('Limpiar red', ...) abre el primero y ejecuta onConfirm solo al aceptar. */
import { useCallback, useState } from 'react';
import type React from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';

/** Estado de los dos modales del visor: el de confirmación genérica (borrar, limpiar) y
 *  el de accesorio en unión. Sus funciones de abrir/cerrar viajan a los componentes por props. */
export type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
};

export type AccesorioModalState = {
  isOpen: boolean;
  ramalId: string;
  ramalLabel: string;
  angleDeg: number;
  junctionIndex: number;
  point: number[];
  net: string;
  isTee?: boolean;
};

export type AccesorioModalData = {
  ramalId: string;
  angleDeg: number;
  junctionIndex: number;
  point: number[];
  net: string;
  isTee?: boolean;
};

export function useViewerDialogs(engineRef: React.RefObject<PlanoEngine | null>): {
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
  accesorioModal: AccesorioModalState;
  setAccesorioModal: React.Dispatch<React.SetStateAction<AccesorioModalState>>;
  onAccesorioModalHandler: (data: AccesorioModalData) => void;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
} {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [accesorioModal, setAccesorioModal] = useState<AccesorioModalState>({
    isOpen: false,
    ramalId: '',
    ramalLabel: '',
    angleDeg: 0,
    junctionIndex: 0,
    point: [],
    net: '',
    isTee: false,
  });
  const onAccesorioModalHandler = useCallback(
    (data: AccesorioModalData) => {
      // `ramalId` es el id interno crudo (p. ej. el `T${Date.now()}` de un tributario) — nunca
      // pensado para mostrarse. El modal debe mostrar la etiqueta real del ramal (RAF1, T3, ...),
      // igual que en el resto de la UI.
      const target = engineRef.current?.ramales.find((r) => r.id === data.ramalId);
      setAccesorioModal({
        isOpen: true,
        ramalId: data.ramalId,
        ramalLabel: target?.label || data.ramalId,
        angleDeg: data.angleDeg,
        junctionIndex: data.junctionIndex,
        point: data.point,
        net: data.net,
        isTee: data.isTee,
      });
    },
    [engineRef],
  );
  const triggerConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        },
        confirmLabel,
      });
    },
    [],
  );
  return {
    confirmState,
    setConfirmState,
    accesorioModal,
    setAccesorioModal,
    onAccesorioModalHandler,
    triggerConfirm,
  };
}
