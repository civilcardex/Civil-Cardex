
const TextInputOverlay_S1: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17,19,23,0.5)', };
const TextInputOverlay_S2: React.CSSProperties = { background: '#1a1c20', border: '2px solid #4D8FF7', borderRadius: 8, padding: '16px 20px', boxShadow: '0 8px 32px rgba(77,143,247,0.25)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280, };
const TextInputOverlay_S3: React.CSSProperties = { width: '100%', padding: '8px 12px', background: '#0d0f12', border: '1px solid #3a494a', borderRadius: 4, color: '#e2e2e8', fontSize: 14, fontFamily: "'Geist',monospace", outline: 'none', };
const TextInputOverlay_S4: React.CSSProperties = { padding: '5px 14px', background: 'transparent', border: '1px solid #3a494a', borderRadius: 4, color: '#849495', fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer', };
const TextInputOverlay_S5: React.CSSProperties = { padding: '5px 14px', background: '#3578E5', border: '1px solid #3578E5', borderRadius: 4, color: '#fff', fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer', fontWeight: 600, };
interface TextOverlay {
  x: number;
  y: number;
  value: string;
  cb: (text: string) => void;
}

interface TextInputOverlayProps {
  textOverlay: TextOverlay | null;
  setTextOverlay: React.Dispatch<React.SetStateAction<TextOverlay | null>>;
  textInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function TextInputOverlay({ textOverlay, setTextOverlay, textInputRef }: TextInputOverlayProps) {
  if (!textOverlay) return null;

  return (
    <div style={TextInputOverlay_S1} onClick={() => { textOverlay.cb(''); setTextOverlay(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Ingresar texto" onClick={e => e.stopPropagation()} onKeyDown={e => {
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;
            if (e.shiftKey) {
              if (document.activeElement === first) { last.focus(); e.preventDefault(); }
            } else {
              if (document.activeElement === last) { first.focus(); e.preventDefault(); }
            }
          }
        }} style={TextInputOverlay_S2}>
        <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>Texto</div>
        <input
          ref={textInputRef}
          value={textOverlay.value}
          onChange={e => setTextOverlay({ ...textOverlay, value: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              textOverlay.cb(textOverlay.value);
              setTextOverlay(null);
            } else if (e.key === 'Escape') {
              textOverlay.cb('');
              setTextOverlay(null);
            }
          }}
          placeholder="Escribe el texto..."
          style={TextInputOverlay_S3}
          className="text-input-overlay-input"
        />
        <style>{`.text-input-overlay-input:focus-visible { outline: 2px solid #4D8FF7; outline-offset: 2px; }`}</style>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { textOverlay.cb(''); setTextOverlay(null); }} style={TextInputOverlay_S4}>Cancelar</button>
          <button type="button" onClick={() => { textOverlay.cb(textOverlay.value); setTextOverlay(null); }} style={TextInputOverlay_S5}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}