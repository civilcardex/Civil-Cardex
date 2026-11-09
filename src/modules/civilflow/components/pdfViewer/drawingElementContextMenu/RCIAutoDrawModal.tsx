/** Modal de "Dibujar ramales paralelos" rci (Red Contra Incendio): SOLO pregunta n.º de ramales
 *  y lado — la separación L NO se pregunta (ped. usuario): sale SIEMPRE de la tabla «Datos del
 *  rociador» y llega ya resuelta en `lTxt` para mostrarla como info. Ej: 3 ramales lado ◀. */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalOverlay, useEscapeKey } from '../../../../../components/shared/ModalShell.tsx';
import type { LadoParalelo } from '../../../lib/PlanoEngine/RCIAutoDraw.ts';

const IN: React.CSSProperties = {
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  color: 'var(--txt)',
  padding: '2px 6px',
  fontSize: 12,
  fontFamily: 'var(--mono)',
  width: 52,
  textAlign: 'center',
};
const BTN: React.CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt)',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 11,
  cursor: 'pointer',
};
const BTN_PRIM: React.CSSProperties = {
  ...BTN,
  background: 'var(--rci, #f87171)',
  borderColor: 'var(--rci, #f87171)',
  color: '#fff',
  fontWeight: 700,
};

export function RciAutoDrawModal({
  lTxt,
  etiquetas,
  onConfirm,
  onClose,
}: {
  /** L de la tabla Datos del rociador (solo para mostrarla como info). */
  lTxt: string;
  /** Etiqueta de cada lado según la GEOMETRÍA del trazo (ped. usuario): horizontal →
   *  {izq:'Abajo'|'Arriba', der:'Arriba'|'Abajo'}; vertical → Izquierda/Derecha. */
  etiquetas: { izq: string; der: string };
  onConfirm: (v: { n: number; lado: LadoParalelo }) => void;
  onClose: () => void;
}) {
  const [nTxt, setNTxt] = useState('2');
  const [lado, setLado] = useState<LadoParalelo>('izq');
  const [err, setErr] = useState('');
  useEscapeKey(onClose);

  const confirmar = (): void => {
    const nv = Math.round(parseFloat(nTxt.replace(',', '.')));
    if (!(nv >= 1 && nv <= 50)) return setErr('N.º de ramales entre 1 y 50.');
    onConfirm({ n: nv, lado });
  };
  /* Glifo de flecha según la etiqueta: Izquierda ◀ / Derecha ▶ / Arriba ▲ / Abajo ▼. */
  const glifo = (txt: string): string =>
    txt.startsWith('Izq')
      ? '◀ '
      : txt.startsWith('Der')
        ? '▶ '
        : txt.startsWith('Arriba')
          ? '▲ '
          : '▼ ';
  const etiquetaLado = lado === 'izq' ? etiquetas.izq : etiquetas.der;
  const alternar = (): void => setLado((l) => (l === 'izq' ? 'der' : 'izq'));

  return createPortal(
    /* ModalOverlay compartida (backdrop-click con guard target===currentTarget) en vez de un
     * overlay propio — mismo cierre por fondo y Escape vía useEscapeKey como todo modal. */
    <ModalOverlay zIndex={100000} onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dibujar ramales paralelos"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '8px 12px',
          width: 'min(300px, 100%)',
          fontSize: 12,
          color: 'var(--txt)',
        }}
      >
        <b style={{ fontSize: 13, color: 'var(--rci)' }}>Dibujar ramales paralelos</b>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: 'var(--txt3)',
            fontFamily: 'var(--mono)',
          }}
        >
          L = {lTxt || '—'} m (tabla Datos del rociador)
        </div>
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            N.º de ramales
            <input
              inputMode="numeric"
              value={nTxt}
              onChange={(e) => setNTxt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmar()}
              style={IN}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            ¿En qué sentido?
            <button
              type="button"
              onClick={alternar}
              style={{ ...BTN, fontWeight: 700 }}
              title="Alterna el lado hacia donde salen los ramales paralelos"
            >
              {glifo(etiquetaLado)}
              {etiquetaLado}
            </button>
          </label>
        </div>
        {err ? <div style={{ color: 'var(--err, #F04545)', fontSize: 11 }}>{err}</div> : null}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={BTN}>
            Cancelar
          </button>
          <button type="button" onClick={confirmar} style={BTN_PRIM}>
            Dibujar
          </button>
        </div>
      </div>
    </ModalOverlay>,
    document.body,
  );
}
