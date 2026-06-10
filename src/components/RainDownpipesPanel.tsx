import RainInputPanel from "./RainInputPanel";

export default function PanelBajantesLluvias({ onClose }: { onClose: () => void }) {
  return <RainInputPanel type="downpipes" onClose={onClose} />;
}
