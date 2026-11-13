/** Modal de texto sobre el plano: escribir/editar la etiqueta de una anotación (Enter confirma, Escape/click-fuera cancela). Ej: la herramienta "texto" ('c') lo abre en el punto del clic. */
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';
const TextInputOverlay_S2: React.CSSProperties = {
  background: '#1a1c20',
  border: '2px solid #4D8FF7',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 8px 32px rgba(77,143,247,0.25)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 280,
};
const TextInputOverlay_S3: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#0d0f12',
  border: '1px solid #3a494a',
  borderRadius: 4,
  color: '#e2e2e8',
  fontSize: 14,
  fontFamily: "'Geist',monospace",
};
const TextInputOverlay_S4: React.CSSProperties = {
  padding: '5px 14px',
  background: 'transparent',
  border: '1px solid #3a494a',
  borderRadius: 4,
  color: '#849495',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const TextInputOverlay_S5: React.CSSProperties = {
  padding: '5px 14px',
  background: '#3578E5',
  border: '1px solid #3578E5',
  borderRadius: 4,
  color: '#fff',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  fontWeight: 600,
};
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

export default function TextInputOverlay({
  textOverlay,
  setTextOverlay,
  textInputRef,
}: TextInputOverlayProps) {
  if (!textOverlay) return null;

  return (
    // Migrado a ModalOverlay (dialog nativo): click-fuera y Escape llaman onClose (cancela
    // con cb('')), el foco queda atrapado y Tab cicla solo. CAMBIOS aceptados del dialog
    // nativo: (a) el mini-modal ahora se centra en el VIEWPORT (antes en el stage del
    // visor — cambio visual menor); (b) el Escape ya NO va en el onKeyDown del input: ahí
    // quedaba doble cancelación (la rama propia + el cancel nativo), hoy solo el nativo.
    <ModalOverlay
      onClose={() => {
        textOverlay.cb('');
        setTextOverlay(null);
      }}
      ariaLabel="Ingresar texto"
    >
      <div style={TextInputOverlay_S2}>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Texto
        </div>
        <input
          ref={textInputRef}
          value={textOverlay.value}
          onChange={(e) => setTextOverlay({ ...textOverlay, value: e.target.value })}
          onKeyDown={(e) => {
            // SOLO Enter confirma: el Escape lo captura antes el dialog (evento cancel
            // nativo) y llamar cb('') aquí sería la segunda llamada del mismo cierre.
            if (e.key === 'Enter') {
              textOverlay.cb(textOverlay.value);
              setTextOverlay(null);
            }
          }}
          placeholder="Escribe el texto..."
          aria-label="Texto"
          style={TextInputOverlay_S3}
          className="text-input-overlay-input"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              textOverlay.cb('');
              setTextOverlay(null);
            }}
            style={TextInputOverlay_S4}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              textOverlay.cb(textOverlay.value);
              setTextOverlay(null);
            }}
            style={TextInputOverlay_S5}
          >
            Aceptar
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
