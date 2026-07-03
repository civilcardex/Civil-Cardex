import { useState, useCallback, useEffect } from "react";
import TextInputOverlay from "./TextInputOverlay";
import BajanteContextMenu from "./BajanteContextMenu";
import ConfirmDialog from "./ConfirmDialog";
import AlertDialog from "./AlertDialog";

interface PdfViewerDialogsProps {
  engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  setSelElement: React.Dispatch<React.SetStateAction<Record<string, any> | null>>;
  selectedNivel: number | null;
  pisos: any[];
  lowerFloorsRamales: any[];
  planosCtx: { plans: any[] };
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  textOverlay: { x: number; y: number; value: string; cb: (text: string) => void } | null;
  setTextOverlay: React.Dispatch<React.SetStateAction<{ x: number; y: number; value: string; cb: (text: string) => void } | null>>;
  textInputRef: React.RefObject<HTMLInputElement | null>;
  onRegisterContextMenu: (cb: (bajante: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: any) => void) => void;
  onRegisterSetConfirmState: (setter: React.Dispatch<React.SetStateAction<any>>) => void;
  onRegisterSetAlertDialogState: (setter: React.Dispatch<React.SetStateAction<any>>) => void;
}

export default function PdfViewerDialogs(props: PdfViewerDialogsProps) {
  const [contextMenuState, setContextMenuState] = useState<{ visible: boolean; x: number; y: number; bajante: any; isGhostClick?: boolean; ramalEndpoint?: { idx: number; x: number; y: number } | null } | null>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [alertDialogState, setAlertDialogState] = useState<{isOpen: boolean; title: string; message: string}>({isOpen: false, title: '', message: ''});

  const onContextMenuCb = useCallback((bajante: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: { idx: number; x: number; y: number } | null) => {
    setContextMenuState({ visible: true, x, y, bajante, isGhostClick, ramalEndpoint });
  }, []);

  useEffect(() => { props.onRegisterContextMenu(onContextMenuCb); }, [onContextMenuCb, props.onRegisterContextMenu]);
  useEffect(() => { props.onRegisterSetConfirmState(setConfirmState); }, [props.onRegisterSetConfirmState]);
  useEffect(() => { props.onRegisterSetAlertDialogState(setAlertDialogState); }, [props.onRegisterSetAlertDialogState]);

  return (
    <>
      <TextInputOverlay
        textOverlay={props.textOverlay}
        setTextOverlay={props.setTextOverlay}
        textInputRef={props.textInputRef}
      />
      <BajanteContextMenu
        contextMenuState={contextMenuState}
        setContextMenuState={setContextMenuState}
        selectedNivel={props.selectedNivel}
        pisos={props.pisos}
        engineRef={props.engineRef}
        selElement={props.selElement}
        setSelElement={props.setSelElement}
        lowerFloorsRamales={props.lowerFloorsRamales}
        planosCtx={props.planosCtx}
        mats={props.mats}
        activeNet={props.activeNet}
        setDiamSel={props.setDiamSel}
      />
      <ConfirmDialog confirmState={confirmState} setConfirmState={setConfirmState} />
      <AlertDialog alertDialogState={alertDialogState} setAlertDialogState={setAlertDialogState} />
    </>
  );
}
