/** Guía de diseño RCI como modal: el recorrido de 9 pasos del HTML de referencia (GUIDE ~2473).
 *  Nav izquierda de pasos agrupados por fase (sticky), contenido del paso activo (los textos,
 *  tablas y esquemas SVG viven en RciGuiaPasos) y botones ◀ Anterior / Siguiente ▶. Los
 *  botones «Ir a…» saltan con irA(tab, sub, campo) y cierran el modal; Escape también cierra.
 *  Ej: RciDesign monta <RciGuiaModal ctx pisoNombre onClose /> al pulsar «Guía de diseño». */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { useNavRci, type RciCtx, type TabRci } from './RCIUI.tsx';
import { RUTA_DE } from '../../utils/rci/RCIRowsModelExtras.ts';
import { PasoGuia } from './RCIGuideSteps.tsx';

/* ---------------- Datos del recorrido (los del GUIDE del HTML) ---------------- */

/** Los 9 pasos con su fase: la agrupación gris de la nav izquierda. */
const PASOS: { fase: string; t: string }[] = [
  { fase: 'Rociadores', t: 'Clasifica el riesgo' },
  { fase: 'Rociadores', t: 'Distribuye los rociadores' },
  { fase: 'Rociadores', t: 'Organiza ramales y tramos' },
  { fase: 'Rociadores', t: 'Ubica el área de diseño' },
  { fase: 'Rociadores', t: 'Numera la ruta crítica' },
  { fase: 'Tipologías', t: 'Clasifica los pisos' },
  { fase: 'Dibujo', t: '¿Listo para dibujar?' },
  { fase: 'Dibujo', t: 'Captura la red en el plano' },
  { fase: 'Cálculo', t: 'Revisa el cálculo y las verificaciones' },
];

/** Encabezado de cada grupo de fases en la nav (el mapa del renderGuide del HTML). */
const FASES: Record<string, string> = {
  Rociadores: '1. Rociadores',
  Tipologías: '2. Tipologías',
  Dibujo: '3. Módulo de dibujo',
  Cálculo: '4. Cálculo',
};

const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt)',
  borderRadius: 'var(--r)',
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--body)',
  whiteSpace: 'nowrap',
};
const BTN_PRIMARIO: CSSProperties = {
  ...BTN,
  background: 'var(--rci)',
  borderColor: 'var(--rci)',
  color: '#fff',
  fontWeight: 700,
};

/* ---------------- Componente ---------------- */

export default function RciGuiaModal({
  ctx,
  pisoNombre,
  onClose,
}: {
  ctx: RciCtx;
  pisoNombre: string;
  onClose: () => void;
}) {
  const { irA } = useNavRci();
  const [paso, setPaso] = useState(0);
  const cuerpoRef = useRef<HTMLDivElement | null>(null);

  /* Escape cierra el modal (listener a nivel documento, patrón HelpPanel). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Cada cambio de paso vuelve arriba (el renderGuide del HTML hacía scrollIntoView). */
  useEffect(() => {
    cuerpoRef.current?.scrollTo({ top: 0 });
  }, [paso]);

  /* Bloqueo del scroll de la PÁGINA mientras el modal está abierto: la rueda solo mueve el
   * cuerpo del modal, jamás la página de atrás. Se restaura el valor previo al desmontar. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** «Ir a…»: salta y cierra el modal. Los go del HTML se adaptan a donde VIVE el dato en el
   *  repo (S/L/Dmuro se mudaron de Entradas a Rociadores; la pestaña 'pisos' es 'tipologías'). */
  const irGo = (go: string[]): void => {
    const campo = go[1];
    if (go[0] === 'pisos') {
      irA('tipologias');
    } else if (go[0] === 'entradas' && (campo?.startsWith('roc.') || campo === 'clas.qr')) {
      irA('rociadores', 'datos', campo);
    } else if (go[0] === 'rociadores') {
      irA('rociadores', 'rectangulo');
    } else {
      const r = RUTA_DE(go);
      irA(r.tab as TabRci, r.sub, r.campo);
    }
    onClose();
  };

  /** Un «Ir a…» del GUIDE: botón pequeño con su destino. */
  const BotonIr = ({ txt, go }: { txt: string; go: string[] }) => (
    <button type="button" style={BTN} onClick={() => irGo(go)}>
      {txt}
    </button>
  );

  /* Acciones del paso activo (los goBtn del GUIDE, en el orden del HTML). */
  const acciones = (): ReactNode => {
    switch (paso) {
      case 0:
        return <BotonIr txt="Ir a la clasificación" go={['entradas', 'clas.riesgo']} />;
      case 1:
        return <BotonIr txt="Ir a S y L" go={['entradas', 'roc.S']} />;
      case 3:
        return <BotonIr txt="Ver el rectángulo de fuego" go={['rociadores']} />;
      case 4:
        return <BotonIr txt="Ir a Ramales" go={['hidraulica']} />;
      case 5:
        return <BotonIr txt="Ir a Tipologías" go={['pisos']} />;
      case 8:
        return (
          <>
            <BotonIr txt="Ir a Hidráulica" go={['hidraulica']} />{' '}
            <BotonIr txt="Ir a Verificaciones" go={['verificaciones']} />
          </>
        );
      default:
        return null;
    }
  };

  const fase = PASOS[paso].fase;
  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.6)',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guía de diseño contra incendio"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          width: 'min(1120px, 100%)',
          height: 'auto',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(0,0,0,.5)',
        }}
      >
        {/* Encabezado: título + piso activo + posición del recorrido + cerrar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--rci)' }}>
            Guía de diseño
          </h3>
          {pisoNombre ? (
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
              Piso activo: {pisoNombre}
            </span>
          ) : null}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)' }}>
            Paso {paso + 1} de {PASOS.length} · {FASES[fase]}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía de diseño"
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 4,
              color: 'var(--txt2)',
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
        {/* Nav de los 9 pasos (sticky) + tarjeta del paso activo */}
        <div
          ref={cuerpoRef}
          style={{
            display: 'grid',
            gridTemplateColumns: '185px minmax(0, 1fr)',
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '10px 12px',
          }}
        >
          <nav style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {PASOS.map((p, i) => {
                const cambiaFase = i === 0 || PASOS[i - 1].fase !== p.fase;
                return (
                  <li key={p.t}>
                    {cambiaFase ? (
                      <div
                        style={{
                          margin: '10px 0 3px',
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--txt3)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {FASES[p.fase]}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPaso(i)}
                      aria-current={i === paso ? 'step' : undefined}
                      style={{
                        display: 'flex',
                        gap: 7,
                        width: '100%',
                        textAlign: 'left',
                        border: 0,
                        background: 'none',
                        padding: '4px 8px',
                        borderRadius: 5,
                        cursor: 'pointer',
                        color: i === paso ? 'var(--txt)' : 'var(--txt2)',
                        fontWeight: i === paso ? 600 : 400,
                        borderLeft: `3px solid ${i === paso ? 'var(--rci)' : 'transparent'}`,
                        fontSize: 13.5,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          minWidth: 14,
                          color: 'var(--txt3)',
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ flex: 1 }}>{p.t}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                {PASOS[paso].t}
              </h2>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
                {FASES[fase]}
              </div>
            </div>
            <PasoGuia paso={paso} ctx={ctx} irGo={irGo} />
          </div>
        </div>
        {/* Acciones del paso + Anterior / Siguiente (Enter no hace nada: no hay form) */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            borderTop: '1px solid var(--line)',
            padding: '6px 12px',
          }}
        >
          {acciones()}
          <span style={{ flex: 1 }} />
          {paso > 0 ? (
            <button type="button" style={BTN} onClick={() => setPaso(paso - 1)}>
              ◀ Anterior
            </button>
          ) : null}
          {paso < PASOS.length - 1 ? (
            <button type="button" style={BTN_PRIMARIO} onClick={() => setPaso(paso + 1)}>
              Siguiente ▶
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
