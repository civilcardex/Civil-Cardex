import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AyudaContexto } from './ayudaContext';
import { GUIA, iconoDeGrupo, type GuiaGrupo } from './ayudaGuide';

// Panel de ayuda IN-PLACE (orig. usuario: el botón AYUDA de la navbar NO redirige a otra
// página): modal con portal — mismo patrón que ModalProtocolo (backdrop, Escape, foco
// inicial) — que muestra la GUÍA de la pestaña activa: para qué sirve cada parte de la UI.
// Acordeones propios con estilos inline (sin Tailwind/SectionAccordion: dentro del modal
// esas clases apilaban mal, orig. usuario "pestañas superpuestas").

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.7)',
  padding: 16,
};

const BOX_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r3, 12px)',
  width: 'min(680px, 94vw)',
  height: 'min(60vh, 600px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: '12px 16px',
};

interface Props {
  ctx: AyudaContexto;
  onClose: () => void;
}

/** Nombres cortos de las 5 sub-vistas de isometría (espejo de SUBTABS en IsometriaTab;
 *  duplicados aquí para no crear dependencia components→modules). */
const ISO_SUBS = [
  'Redes',
  'Aparatos',
  'Bomba red contra incendio',
  'Equipo de presión',
  'Red contra incendio',
];

/** Envuelve atajos (`(S)`, `Ctrl+Z`) en chips <kbd> — el texto guía trae varios. */
function conKbd(texto: string): React.JSX.Element {
  const partes = texto.split(/(\([A-Za-z]\)|Ctrl\+[A-Za-z])/g);
  if (partes.length === 1) return <>{texto}</>;
  return (
    <>
      {partes.map((p, i) =>
        /^(\([A-Za-z]\)|Ctrl\+[A-Za-z])$/.test(p) ? (
          <kbd
            key={i}
            style={{
              fontFamily: 'Geist, monospace',
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--bg3)',
              border: '1px solid var(--line)',
              borderBottomWidth: 2,
              borderRadius: 4,
              padding: '0 5px',
              margin: '0 1px',
              whiteSpace: 'nowrap',
            }}
          >
            {p}
          </kbd>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function AyudaPanel({ ctx, onClose }: Props): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  /** Trap de foco + restauración: `aria-modal="true"` promete fondo inerte, así que Tab
   *  cicla solo por los focusables del panel (shift+Tab invertido) y al desmontar el
   *  foco vuelve al elemento que abrió el diálogo en lugar de caer a <body>. */
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  // Guía detallada de la pestaña (inventario funcional real de la UI), primer grupo abierto.
  // En isometría se combinan las 5 sub-guías de una vez (pedido usuario: no página por página).
  const esIso = ctx.key.startsWith('cf:iso:');
  const guia: Array<GuiaGrupo & { sub?: string }> = esIso
    ? [1, 2, 3, 4, 5].flatMap((sub) =>
        (GUIA[`cf:iso:${sub}`] || []).map((g) => ({ ...g, sub: ISO_SUBS[sub - 1] })),
      )
    : GUIA[ctx.key] || [];

  return (
    // Backdrop con cierre por click-fuera: patrón estándar de modal (cierre por Escape ya
    // cubierto por el listener de teclado de este componente).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div style={PANEL_STYLE} onClick={onClose}>
      {/* stopPropagation: los clics del contenido NO deben cerrar el modal (orig. usuario). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        ref={panelRef}
        style={BOX_STYLE}
        role="dialog"
        aria-modal="true"
        aria-label={`Ayuda: ${ctx.modulo} — ${ctx.seccion}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg2)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                color: 'var(--acc2)',
                fontWeight: 700,
                fontFamily: 'Geist, monospace',
                textTransform: 'uppercase',
              }}
            >
              Ayuda · {ctx.modulo}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--txt)',
                fontFamily: 'var(--head, sans-serif)',
                marginTop: 2,
              }}
            >
              {ctx.seccion}
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4, lineHeight: 1.5 }}>
              {ctx.intro}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar ayuda"
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--line)',
              borderRadius: '50%',
              color: 'var(--txt2)',
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background .15s, color .15s, border-color .15s, transform .15s',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget;
              b.style.background = 'var(--acc)';
              b.style.color = '#101216';
              b.style.borderColor = 'var(--acc)';
              b.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget;
              b.style.background = 'var(--bg3)';
              b.style.color = 'var(--txt2)';
              b.style.borderColor = 'var(--line)';
              b.style.transform = 'none';
            }}
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div className="docs-scroll" style={BODY_STYLE}>
          {esIso && (
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontFamily: 'Geist, monospace',
                fontWeight: 700,
                color: 'var(--acc2)',
                margin: '2px 2px 10px',
              }}
            >
              Todas las vistas de isometría
            </div>
          )}
          {guia.map((g) => {
            const key = `guia:${g.sub || ''}:${g.titulo}`;
            const isOpen = open[key] ?? false;
            return (
              <React.Fragment key={key}>
                {g.sub && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'Geist, monospace',
                      color: 'var(--txt2)',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      margin: '10px 2px 6px',
                    }}
                  >
                    {g.sub}
                  </div>
                )}
                <div
                  style={{
                    border: '1px solid var(--line)',
                    borderLeft: `3px solid ${isOpen ? 'var(--acc2)' : 'var(--line)'}`,
                    borderRadius: 'var(--r2, 8px)',
                    background: 'var(--bg2)',
                    overflow: 'hidden',
                    marginBottom: 8,
                    transition: 'border-color .15s',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 18,
                        color: 'var(--acc2)',
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform .15s',
                      }}
                    >
                      chevron_right
                    </span>
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined"
                      style={{ fontSize: 20, color: isOpen ? 'var(--acc2)' : 'var(--txt3)' }}
                    >
                      {iconoDeGrupo(g.titulo)}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--txt)',
                        fontFamily: 'var(--body, sans-serif)',
                      }}
                    >
                      {g.titulo}
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: '4px 14px 12px',
                        borderTop: '1px solid var(--line)',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      {g.items.map((it) => (
                        <div
                          key={it.nombre}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(130px, 40%) 1fr',
                            gap: 10,
                            alignItems: 'start',
                            padding: '5px 6px',
                            borderRadius: 6,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,.025)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--txt)',
                              fontFamily: 'var(--mono, monospace)',
                              lineHeight: 1.4,
                            }}
                          >
                            {conKbd(it.nombre)}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--txt2)',
                              lineHeight: 1.55,
                            }}
                          >
                            {conKbd(it.desc)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {guia.length === 0 && (
            <div style={{ color: 'var(--txt3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Aún no hay contenido de ayuda para esta pestaña.
            </div>
          )}
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg2)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Link
            to="/docs"
            onClick={onClose}
            style={{
              fontSize: 12,
              fontFamily: 'Geist, monospace',
              color: 'var(--acc2)',
              textDecoration: 'none',
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            VER TODA LA DOCUMENTACIÓN →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AyudaPanel;
