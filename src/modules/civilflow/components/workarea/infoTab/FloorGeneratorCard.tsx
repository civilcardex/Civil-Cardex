/** Tarjeta generadora de pisos: crea N pisos iguales (nombre, altura, npt (nivel de piso
 *  topográfico)) de una vez. Ej: «8 pisos de 3.0 m» -> 8 planos listos para dibujar. */
import React from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import EditButton from '../../shared/EditButton.tsx';

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

/** Campo etiqueta+input de la grilla 2×3: misma pinta para los 5 valores numéricos.
 *  Ej: <Campo id="fg-pisos" label="Pisos" value="8" set={setNPisos} ... /> (int) y
 *  <Campo id="fg-altpiso" label="Altura entrepiso" decimal ... /> (dec, usa los handlers dec). */
function Campo(props: {
  id: string;
  label: string;
  /** decimal -> inputMode "decimal" + handlers onDec; entero -> "numeric" + handlers onInt. */
  decimal?: boolean;
  value: string;
  set: (v: string) => void;
  editing: boolean;
  styleInput: React.CSSProperties;
  onIntChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onDecChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onIntBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
  onDecBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
}) {
  const onChange = props.decimal ? props.onDecChange : props.onIntChange;
  const onBlur = props.decimal ? props.onDecBlur : props.onIntBlur;
  return (
    <div className="f" style={{ marginBottom: 0 }}>
      <label htmlFor={props.id} style={{ fontSize: 12 }}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        autoComplete="off"
        disabled={!props.editing}
        inputMode={props.decimal ? 'decimal' : 'numeric'}
        value={props.value}
        style={props.styleInput}
        onChange={onChange(props.set)}
        onBlur={onBlur(props.set)}
      />
    </div>
  );
}

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
  // ponytail: 1 style derivado para las 6 superficies que se atenúan fuera de edición (0.5 el botón).
  const opacidadEdicion = isEditing ? 1 : 0.7;
  const styleInput: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 12,
    padding: '3px 5px',
    opacity: opacidadEdicion,
  };
  // Orden de la grilla 2 col: pisos/altura, sótanos/altura sótano, NPT y el toggle al final.
  const campos: {
    id: string;
    label: string;
    decimal?: boolean;
    value: string;
    set: (v: string) => void;
  }[] = [
    { id: 'fg-pisos', label: 'Pisos', value: props.nPisos, set: props.setNPisos },
    {
      id: 'fg-altpiso',
      label: 'Altura entrepiso',
      decimal: true,
      value: props.altPiso,
      set: props.setAltPiso,
    },
    { id: 'fg-sotanos', label: 'Sótanos', value: props.nSotanos, set: props.setNSotanos },
    {
      id: 'fg-altsot',
      label: 'Altura sótano',
      decimal: true,
      value: props.altSotano,
      set: props.setAltSotano,
    },
    {
      id: 'fg-npt',
      label: 'NPT P1',
      decimal: true,
      value: props.nptPiso1,
      set: props.setNptPiso1,
    },
  ];
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
          {campos.map((c) => (
            <Campo
              key={c.id}
              id={c.id}
              label={c.label}
              decimal={c.decimal}
              value={c.value}
              set={c.set}
              editing={isEditing}
              styleInput={styleInput}
              onIntChange={props.onIntChange}
              onDecChange={props.onDecChange}
              onIntBlur={props.onIntBlur}
              onDecBlur={props.onDecBlur}
            />
          ))}
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
                opacity: opacidadEdicion,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 15,
                  borderRadius: 8,
                  // Celeste fijo del toggle (orig. usuario): NO ligado al color de la red ll.
                  background: props.conCubierta ? '#38bdf8' : 'var(--line)',
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
