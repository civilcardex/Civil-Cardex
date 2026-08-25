import React, { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { loadFromStorage, saveToStorage } from '../../../services/storageService';
import EditButton from '../../shared/EditButton';

// Subpestaña/sección "Cómo alimentar la red" de Información general → Agua fría.
// Selección exclusiva (radio): Equipo de presión | Tanque alto | Red.
// Vinculación con la configuración general: solo con 'ep' la red "Equipo de presión" queda
// activa en "Equipos activos"; Tanque alto/Red la desactivan. Persistido en localStorage para
// que la configuración general de la red lo lea en otras sesiones.
export const AF_ALIMENTACION_KEY = 'civilflow_af_alimentacion';
export type AfAlimentacion = 'ep' | 'tanque' | 'red';

const OPTIONS: { id: AfAlimentacion; lbl: string }[] = [
  { id: 'ep', lbl: 'Equipo de presión' },
  { id: 'tanque', lbl: 'Tanque alto' },
  { id: 'red', lbl: 'Red' },
];

const radioBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 6px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
};

interface AlimentacionCardProps {
  afActiva: boolean;
  redes: Set<string>;
  setRedes: Dispatch<SetStateAction<Set<string>>>;
}

function AlimentacionCard({ afActiva, redes, setRedes }: AlimentacionCardProps) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState<AfAlimentacion>(() => {
    const v = loadFromStorage<AfAlimentacion | null>(AF_ALIMENTACION_KEY, null);
    return v === 'tanque' || v === 'red' ? v : 'ep';
  });
  // Valor EFECTIVO derivado (sin efecto): si el usuario apagó 'ep' desde "Equipos activos"
  // mientras la fuente guardada era Equipo de presión, la UI refleja Red — coherencia sin
  // cascadas de render.
  const efectivo: AfAlimentacion = afActiva && valor === 'ep' && !redes.has('ep') ? 'red' : valor;

  if (!afActiva) return null;

  const select = (v: AfAlimentacion) => {
    setValor(v);
    saveToStorage(AF_ALIMENTACION_KEY, v);
    const n = new Set(redes);
    if (v === 'ep') n.add('ep');
    else n.delete('ep');
    setRedes(n);
  };

  return (
    <section
      className="card"
      style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <h3 className="card-t" style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap' }}>
              ¿Cómo alimentar la red?
            </h3>
            <EditButton edit={editing} setEdit={setEditing} />
          </div>
          <span className="card-s" style={{ fontSize: 11 }}>
            Agua fría · fuente única
          </span>
        </div>
      </div>
      <div
        style={{ flex: 1, padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {OPTIONS.map((o) => {
          const on = efectivo === o.id;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={on}
              key={o.id}
              disabled={!editing}
              onClick={() => editing && select(o.id)}
              style={{
                ...radioBtn,
                cursor: editing ? 'pointer' : 'default',
                opacity: editing ? 1 : 0.75,
                borderColor: on ? 'var(--acc)' : 'var(--line)',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: on ? '#ffffff' : 'var(--txt2)',
                  flex: 1,
                }}
              >
                {o.lbl}
              </span>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: on ? 'var(--acc)' : 'transparent',
                  border: `1.5px solid ${on ? 'var(--acc)' : 'var(--txt3)'}`,
                }}
              />
            </button>
          );
        })}
        {efectivo === 'ep' && (
          <span style={{ fontSize: 11, color: 'var(--txt2)', padding: '2px 4px' }}>
            Fuente: Equipo de presión — sección “Equipo activo → Equipo de presión” habilitada.
          </span>
        )}
        {(efectivo === 'tanque' || efectivo === 'red') && (
          <span style={{ fontSize: 11, color: 'var(--txt2)', padding: '2px 4px' }}>
            Fuente: {efectivo === 'tanque' ? 'Tanque alto' : 'Red'} — el equipo de presión queda
            deshabilitado.
          </span>
        )}
      </div>
    </section>
  );
}

export default AlimentacionCard;
