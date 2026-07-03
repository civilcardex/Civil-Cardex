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
    <div role="presentation" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(17,19,23,0.5)',
    }} onClick={() => { textOverlay.cb(''); setTextOverlay(null); }}>
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
        }} style={{
        background: '#1a1c20', border: '2px solid #4D8FF7', borderRadius: 8,
        padding: '16px 20px', boxShadow: '0 8px 32px rgba(77,143,247,0.25)',
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280,
      }}>
        <div style={{ fontSize: 11, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>Texto</div>
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
          style={{
            width: '100%', padding: '8px 12px', background: '#0d0f12',
            border: '1px solid #3a494a', borderRadius: 4,
            color: '#e2e2e8', fontSize: 14, fontFamily: "'Geist',monospace",
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => { textOverlay.cb(''); setTextOverlay(null); }} style={{
            padding: '5px 14px', background: 'transparent', border: '1px solid #3a494a',
            borderRadius: 4, color: '#849495', fontSize: 11, fontFamily: "'Geist',monospace",
            cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={() => { textOverlay.cb(textOverlay.value); setTextOverlay(null); }} style={{
            padding: '5px 14px', background: '#4D8FF7', border: '1px solid #4D8FF7',
            borderRadius: 4, color: '#fff', fontSize: 11, fontFamily: "'Geist',monospace",
            cursor: 'pointer', fontWeight: 600,
          }}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}