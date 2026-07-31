import React from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import EditButton from '../../shared/EditButton';

const FloorGeneratorCard_cubiertaToggle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  userSelect: 'none',
  padding: '4px 8px',
  borderRadius: 4,
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  width: '100%',
  textAlign: 'inherit',
};
const FloorGeneratorCard_generarBtn: React.CSSProperties = {
  width: '100%',
  padding: '6px',
  marginTop: 6,
  background: 'var(--acc)',
  border: 'none',
  borderRadius: 'var(--r)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 12,
};

const FloorGeneratorCard = React.memo(function FloorGeneratorCard(props: {
  nSotanos: string;
  nPisos: string;
  altPiso: string;
  altSotano: string;
  nptPiso1: string;
  conCubierta: boolean;
  setConCubierta: (v: boolean) => void;
  setNSotanos: (v: string) => void;
  setNPisos: (v: string) => void;
  setAltPiso: (v: string) => void;
  setAltSotano: (v: string) => void;
  setNptPiso1: (v: string) => void;
  onIntChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onIntBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
  onDecChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onDecBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
  generarPisos: () => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section className="card" style={{ flex: '0 0 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img
              src="/iconos_civilflow/info_general/generador_de_pisos.webp"
              alt="Generador de pisos"
              width={22}
              height={22}
              style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }}
              loading="lazy"
            />
            Generador de pisos
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            Generación automática de pisos y sótanos
          </span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'end' }}>
          <div className="f" style={{ marginBottom: 0 }}>
            <label htmlFor="fg-pisos" style={{ fontSize: 12 }}>
              Pisos
            </label>
            <input
              id="fg-pisos"
              type="text"
              autoComplete="off"
              disabled={!isEditing}
              inputMode="numeric"
              value={props.nPisos}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '3px 5px',
                opacity: isEditing ? 1 : 0.7,
              }}
              onChange={props.onIntChange(props.setNPisos)}
              onBlur={props.onIntBlur(props.setNPisos)}
            />
          </div>
          <div className="f" style={{ marginBottom: 0 }}>
            <label htmlFor="fg-altpiso" style={{ fontSize: 12 }}>
              Altura entrepiso
            </label>
            <input
              id="fg-altpiso"
              type="text"
              autoComplete="off"
              disabled={!isEditing}
              inputMode="decimal"
              value={props.altPiso}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '3px 5px',
                opacity: isEditing ? 1 : 0.7,
              }}
              onChange={props.onDecChange(props.setAltPiso)}
              onBlur={props.onDecBlur(props.setAltPiso)}
            />
          </div>
          <div className="f" style={{ marginBottom: 0 }}>
            <label htmlFor="fg-sotanos" style={{ fontSize: 12 }}>
              Sótanos
            </label>
            <input
              id="fg-sotanos"
              type="text"
              autoComplete="off"
              disabled={!isEditing}
              inputMode="numeric"
              value={props.nSotanos}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '3px 5px',
                opacity: isEditing ? 1 : 0.7,
              }}
              onChange={props.onIntChange(props.setNSotanos)}
              onBlur={props.onIntBlur(props.setNSotanos)}
            />
          </div>
          <div className="f" style={{ marginBottom: 0 }}>
            <label htmlFor="fg-altsot" style={{ fontSize: 12 }}>
              Altura sótano
            </label>
            <input
              id="fg-altsot"
              type="text"
              autoComplete="off"
              disabled={!isEditing}
              inputMode="decimal"
              value={props.altSotano}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '3px 5px',
                opacity: isEditing ? 1 : 0.7,
              }}
              onChange={props.onDecChange(props.setAltSotano)}
              onBlur={props.onDecBlur(props.setAltSotano)}
            />
          </div>
          <div className="f" style={{ marginBottom: 0 }}>
            <label htmlFor="fg-npt" style={{ fontSize: 12 }}>
              NPT P1
            </label>
            <input
              id="fg-npt"
              type="text"
              autoComplete="off"
              disabled={!isEditing}
              inputMode="decimal"
              value={props.nptPiso1}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '3px 5px',
                opacity: isEditing ? 1 : 0.7,
              }}
              onChange={props.onDecChange(props.setNptPiso1)}
              onBlur={props.onDecBlur(props.setNptPiso1)}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              paddingBottom: 2,
            }}
          >
            <button
              type="button"
              disabled={!isEditing}
              role="switch"
              aria-checked={props.conCubierta}
              onClick={() => props.setConCubierta(!props.conCubierta)}
              title="Incluir cubierta"
              style={{
                ...FloorGeneratorCard_cubiertaToggle,
                cursor: isEditing ? 'pointer' : 'default',
                opacity: isEditing ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 15,
                  borderRadius: 8,
                  background: props.conCubierta ? 'var(--ll)' : 'var(--line)',
                  position: 'relative',
                  transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 2,
                    left: props.conCubierta ? 15 : 2,
                    transition: 'left .2s',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt2)' }}>
                Incluir cubierta
              </span>
            </button>
          </div>
        </div>
        <button
          type="button"
          disabled={!isEditing}
          onClick={props.generarPisos}
          style={{
            ...FloorGeneratorCard_generarBtn,
            cursor: isEditing ? 'pointer' : 'default',
            opacity: isEditing ? 1 : 0.5,
          }}
        >
          Generar niveles automáticamente
        </button>
      </div>
    </section>
  );
});

export default FloorGeneratorCard;
