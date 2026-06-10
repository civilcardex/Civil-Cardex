import RainInputPanel from "./RainInputPanel";

export default function PanelCanalesLluvias({ onClose }: { onClose: () => void }) {
  return <RainInputPanel type="channels" onClose={onClose} />;
}
