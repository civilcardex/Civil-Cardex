import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import type { PlanoNet } from '../../lib/PlanoEngine/PlanoState.ts';

const IsometriaToolbar_S3: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 12,
  fontFamily: 'Geist,monospace',
  borderRadius: 3,
  border: '1px solid #3a494a',
  cursor: 'pointer',
  background: '#1e2024',
  color: '#b9caca',
};
const IsometriaToolbar_S4: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 80,
};
const IsometriaToolbar_S5: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'Geist,monospace',
  border: 'none',
  background: 'transparent',
  color: '#b9caca',
  cursor: 'pointer',
  textAlign: 'left',
};
const IsometriaToolbar_S6: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'Geist,monospace',
  border: 'none',
  background: 'transparent',
  color: '#b9caca',
  cursor: 'pointer',
  textAlign: 'left',
};

interface IsometriaToolbarProps {
  nets: PlanoNet[];
  activeNets: Set<string>;
  toggleNet: (netId: string) => void;
  /** Pisos visibles (orig. usuario): null = todos; popover de checkboxes. */
  pisosVisibles: Set<number> | null;
  setPisosVisibles: Dispatch<SetStateAction<Set<number> | null>>;
  /** Pisos con contenido (nivel + etiqueta corta) para los chips. */
  pisosIso: Array<{ nivel: number; label: string }>;
  rotX: number;
  setRotX: (v: number) => void;
  rotZ: number;
  setRotZ: (v: number) => void;
  scaleZ: number;
  setScaleZ: (v: number) => void;
  zoom: number;
  setZoom: (v: number) => void;
  showExportMenu: boolean;
  setShowExportMenu: Dispatch<SetStateAction<boolean>>;
  exportRef: RefObject<HTMLDivElement | null>;
  exportPdf: () => void;
  exportPng: () => void;
}

/** Barra de herramientas de la isometría: chips de redes activas, selector de pisos visibles,
 *  rotaciones/escala Z, zoom y exportación PDF/PNG. Ej: ocultar el piso 2 -> sus ramales salen
 *  de la escena sin borrar nada del dibujo. */
export default function IsometriaToolbar({
  nets,
  activeNets,
  toggleNet,
  pisosVisibles,
  setPisosVisibles,
  pisosIso,
  rotX,
  setRotX,
  rotZ,
  setRotZ,
  scaleZ,
  setScaleZ,
  zoom,
  setZoom,
  showExportMenu,
  setShowExportMenu,
  exportRef,
  exportPdf,
  exportPng,
}: IsometriaToolbarProps) {
  return (
    <div
      data-tour="iso-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: '#0d0f12',
        borderBottom: '1px solid #3a494a',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {nets.map((n) => {
          const isOn = activeNets.has(n.id);
          return (
            <button
              type="button"
              key={n.id}
              onClick={() => toggleNet(n.id)}
              aria-pressed={isOn}
              style={{
                padding: '3px 8px',
                fontSize: 12,
                fontFamily: 'Geist,monospace',
                borderRadius: 3,
                border: '1px solid',
                cursor: 'pointer',
                background: isOn ? n.col + '33' : '#1e2024',
                borderColor: isOn ? n.col : '#3a494a',
                color: isOn ? n.col : '#849495',
                fontWeight: isOn ? 600 : 400,
              }}
            >
              {n.name}
            </button>
          );
        })}
      </div>

      {pisosIso.length > 1 && (
        <PisosPopover
          pisosIso={pisosIso}
          pisosVisibles={pisosVisibles}
          setPisosVisibles={setPisosVisibles}
        />
      )}

      <div style={{ flex: 1 }} />

      <div
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: 'Geist,monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <label htmlFor="iso-rotx" style={{ margin: 0 }}>
          Giro vertical
        </label>
        <button
          type="button"
          onClick={() => setRotX(-30)}
          style={{
            padding: '2px 4px',
            fontSize: 12,
            borderRadius: 2,
            border: '1px solid #3a494a',
            cursor: 'pointer',
            background: rotX === -30 ? '#4D8FF7' : '#1e2024',
            color: rotX === -30 ? '#fff' : '#b9caca',
          }}
        >
          -30°
        </button>
        <button
          type="button"
          onClick={() => setRotX(-45)}
          style={{
            padding: '2px 4px',
            fontSize: 12,
            borderRadius: 2,
            border: '1px solid #3a494a',
            cursor: 'pointer',
            background: rotX === -45 ? '#4D8FF7' : '#1e2024',
            color: rotX === -45 ? '#fff' : '#b9caca',
          }}
        >
          -45°
        </button>
        <input
          id="iso-rotx"
          type="range"
          min={-90}
          max={90}
          value={rotX}
          onChange={(e) => setRotX(Number(e.target.value))}
          style={{ width: 60 }}
        />
        <span style={{ width: 28, textAlign: 'right' }}>{rotX}°</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: 'Geist,monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <label htmlFor="iso-rotz" style={{ margin: 0 }}>
          Giro horizontal
        </label>
        <button
          type="button"
          onClick={() => setRotZ(30)}
          style={{
            padding: '2px 4px',
            fontSize: 12,
            borderRadius: 2,
            border: '1px solid #3a494a',
            cursor: 'pointer',
            background: rotZ === 30 ? '#4D8FF7' : '#1e2024',
            color: rotZ === 30 ? '#fff' : '#b9caca',
          }}
        >
          30°
        </button>
        <button
          type="button"
          onClick={() => setRotZ(45)}
          style={{
            padding: '2px 4px',
            fontSize: 12,
            borderRadius: 2,
            border: '1px solid #3a494a',
            cursor: 'pointer',
            background: rotZ === 45 ? '#4D8FF7' : '#1e2024',
            color: rotZ === 45 ? '#fff' : '#b9caca',
          }}
        >
          45°
        </button>
        <input
          id="iso-rotz"
          type="range"
          min={0}
          max={360}
          value={rotZ}
          onChange={(e) => setRotZ(Number(e.target.value))}
          style={{ width: 60 }}
        />
        <span style={{ width: 32, textAlign: 'right' }}>{rotZ}°</span>
      </div>
      <label
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: 'Geist,monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Distancia entre pisos{' '}
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={scaleZ}
          onChange={(e) => setScaleZ(Number(e.target.value))}
          style={{ width: 50 }}
        />
        <span style={{ width: 24, textAlign: 'right' }}>{scaleZ.toFixed(1)}</span>
      </label>
      <label
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: 'Geist,monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Zoom{' '}
        <input
          type="range"
          min={5}
          max={200}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          style={{ width: 50 }}
        />
        <span style={{ width: 36, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
      </label>

      <div ref={exportRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setShowExportMenu((p) => !p)}
          title="Descargar"
          style={IsometriaToolbar_S3}
        >
          ⬇ Descargar
        </button>
        {showExportMenu && (
          <div style={IsometriaToolbar_S4}>
            <button
              type="button"
              onClick={() => {
                setShowExportMenu(false);
                exportPdf();
              }}
              style={IsometriaToolbar_S5}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExportMenu(false);
                exportPng();
              }}
              style={IsometriaToolbar_S6}
            >
              PNG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const PisosPopover_box: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};
const PisosPopover_btn: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontFamily: 'Geist,monospace',
  borderRadius: 3,
  border: '1px solid',
  cursor: 'pointer',
  background: '#1e2024',
  fontWeight: 600,
};
const PisosPopover_menu: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 120,
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  padding: '6px 4px',
  minWidth: 170,
  maxHeight: 280,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
const PisosPopover_row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontFamily: 'Geist,monospace',
  color: '#b9caca',
  cursor: 'pointer',
  padding: '3px 8px',
  borderRadius: 3,
  userSelect: 'none',
};
const PisosPopover_Quick: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#8ab4f7',
  cursor: 'pointer',
  fontSize: 11.5,
  fontFamily: 'Geist,monospace',
  textAlign: 'left',
  padding: '3px 8px',
};

/** Selector de pisos visibles ("Pisos: Todos ▾"): popover con checkbox por piso + accesos
 *  Todos/Ninguno — escala a cualquier cantidad de pisos sin engordar la barra (patrón del
 *  selector de redes de las memorias). Ocultar un piso quita su PLANO y sus elementos; las
 *  piezas asociadas a pisos visibles siguen dibujándose. */
function PisosPopover({
  pisosIso,
  pisosVisibles,
  setPisosVisibles,
}: {
  pisosIso: Array<{ nivel: number; label: string }>;
  pisosVisibles: Set<number> | null;
  setPisosVisibles: Dispatch<SetStateAction<Set<number> | null>>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [open]);
  const total = pisosIso.length;
  const visibles = pisosVisibles ? pisosVisibles.size : total;
  const etiqueta =
    visibles === total
      ? `Pisos: todos (${total})`
      : visibles === 0
        ? 'Pisos: ninguno'
        : `Pisos: ${visibles} de ${total} visibles`;
  return (
    <div ref={ref} style={PisosPopover_box}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Elige qué pisos ver en la isometría: los pisos desmarcados quitan su plano y sus elementos (las tuberías conectadas a pisos visibles siguen dibujándose)."
        style={{
          ...PisosPopover_btn,
          borderColor: visibles === total ? '#3a494a' : '#4D8FF7',
          color: visibles === total ? '#b9caca' : '#8ab4f7',
        }}
      >
        {etiqueta} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={PisosPopover_menu}>
          <button type="button" onClick={() => setPisosVisibles(null)} style={PisosPopover_Quick}>
            Todos
          </button>
          <button
            type="button"
            onClick={() => setPisosVisibles(new Set())}
            style={PisosPopover_Quick}
          >
            Ninguno
          </button>
          {pisosIso.map((p) => {
            const isOn = !pisosVisibles || pisosVisibles.has(p.nivel);
            return (
              <label key={p.nivel} style={PisosPopover_row}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() =>
                    setPisosVisibles((prev) => {
                      const todos = pisosIso.map((x) => x.nivel);
                      const base = prev ?? new Set(todos);
                      const nx = new Set(base);
                      if (nx.has(p.nivel)) nx.delete(p.nivel);
                      else nx.add(p.nivel);
                      return nx.size === todos.length ? null : nx;
                    })
                  }
                  style={{ accentColor: '#4D8FF7', margin: 0, cursor: 'pointer' }}
                />
                {p.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
