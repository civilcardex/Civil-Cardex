import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AyudaContexto } from './helpContext.ts';
import { iconoDeGrupo, type GuiaGrupo } from './helpGuideTypes.tsx';
import type { GUIA_TYPE } from './helpGuideTypes.tsx';
import { GUIA_FLOW } from './helpGuideFlow.tsx';
import { GUIA_MANAGER } from './helpGuideManager.tsx';
import { GUIA_RECORTE } from './helpGuideCrop.tsx';
import { repetirTour } from '../tour/useTour.tsx';
import { tourDe } from '../tour/tourSteps.ts';
import { tutorialDe, type Tutorial } from './helpTutorials.ts';
import { ModalOverlay } from '../shared/ModalShell.tsx';

/** Guía fusionada por clave de contexto: flow + manager + recorte (el editor de recorte publica su propia clave 'cf:recorte'). */
export const GUIA: GUIA_TYPE = {
  ...GUIA_FLOW,
  ...GUIA_MANAGER,
  // El editor de recorte publica su propio contexto (cf:recorte): su Ayuda muestra esta
  // misma sección colapsable, y el «REPETIR TOUR» del pie lanza el tour del recorte.
  'cf:recorte': [{ titulo: GUIA_RECORTE.titulo, items: GUIA_RECORTE.items }],
};

// Panel de ayuda IN-PLACE (orig. usuario: el botón AYUDA de la navbar NO redirige a otra
// página): modal via ModalOverlay (dialog nativo: backdrop, Escape, foco atrapado y
// devuelto los da el navegador) que muestra la GUÍA de la pestaña activa: para qué sirve
// cada parte de la UI. Acordeones propios con estilos inline (sin Tailwind/SectionAccordion:
// dentro del modal esas clases apilaban mal, orig. usuario "pestañas superpuestas").

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

/** Fila nombre → descripción de un ítem de guía (compartida por acordeón y lista plana). */
function FilaItem({ it }: { it: { nombre: string; desc: string } }): React.JSX.Element {
  return (
    <div
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
      <span style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.55 }}>
        {conKbd(it.desc)}
      </span>
    </div>
  );
}

/** Reproductor del tutorial de la sección (mapa TUTORIALES en helpTutorials.ts).
 *  Embebido YouTube-nocookie/Vimeo — frame-src ya los permite (index.html + vercel.json). */
function VideoTutorial({ t }: { t: Tutorial }) {
  // Saneo antes de interpolar en la URL del iframe: solo [A-Za-z0-9_-] de 6-20 caracteres.
  const idSeguro = (id?: string) => (id && /^[\w-]{6,20}$/.test(id) ? id : null);
  const yt = idSeguro(t.yt);
  const vimeo = idSeguro(t.vimeo);
  const src = yt
    ? `https://www.youtube-nocookie.com/embed/${yt}`
    : vimeo
      ? `https://player.vimeo.com/video/${vimeo}`
      : null;
  if (!src) return null;
  return (
    <div style={{ marginTop: 10, padding: '10px 14px 14px', borderTop: '1px solid var(--line)' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'var(--txt3)',
          fontFamily: 'Geist, monospace',
          marginBottom: 8,
        }}
      >
        Video tutorial{t.titulo ? ` · ${t.titulo}` : ''}
      </div>
      {/* title dinámico abajo satisface jsx-a11y/iframe-has-title */}
      <iframe
        src={src}
        title={t.titulo || 'Video tutorial de la sección'}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          border: '1px solid var(--line)',
          borderRadius: 6,
          background: 'var(--bg2)',
          display: 'block',
        }}
      />
    </div>
  );
}

/** Modal de AYUDA contextual: intro de la pestaña activa + guía (grupos colapsables de elementos) + botón REPETIR TOUR. Ej: en Sanitaria lista las herramientas de la tab sanitaria. */
function AyudaPanel({ ctx, onClose }: Props): React.JSX.Element {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  // Guía detallada de la pestaña (inventario funcional real de la UI).
  // En isometría se combinan las 5 sub-guías y se muestran como LISTA PLANA (orig. usuario:
  // quitar los títulos «Redes/Aparatos/…» que duplican el nombre de la página).
  const esIso = ctx.key.startsWith('cf:iso:');
  const tutorial = tutorialDe(ctx.key);
  const guia: GuiaGrupo[] = esIso
    ? [1, 2, 3, 4, 5].flatMap((sub) => GUIA[`cf:iso:${sub}`] || [])
    : GUIA[ctx.key] || [];

  return (
    // ModalOverlay (dialog nativo): click-fuera y Escape cierran, foco atrapado dentro y
    // devuelto al opener — nada programado a mano (el trap/restore propio se borró aquí).
    <ModalOverlay onClose={onClose} ariaLabel={`Ayuda: ${ctx.modulo} — ${ctx.seccion}`}>
      {/* Los clics dentro de la caja no cierran: ModalOverlay solo cierra con target fuera
          del contenido (orig. usuario "no cerrar al hacer clic dentro"). */}
      <div style={BOX_STYLE}>
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
            const key = `guia:${g.titulo}`;
            const isOpen = open[key] ?? false;
            // Grupo SIN título → lista plana sin acordeón (isometría: sin «Redes/Aparatos/…»).
            if (!g.titulo) {
              return (
                <div
                  key={key}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r2, 8px)',
                    background: 'var(--bg2)',
                    padding: '6px 10px',
                    marginBottom: 8,
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  {g.items.map((it) => (
                    <FilaItem key={it.nombre} it={it} />
                  ))}
                </div>
              );
            }
            return (
              <div
                key={key}
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
                      <FilaItem key={it.nombre} it={it} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {guia.length === 0 && (
            <div style={{ color: 'var(--txt3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Aún no hay contenido de ayuda para esta pestaña.
            </div>
          )}
          {/* Video SIEMPRE debajo del/los acordeones (ped. usuario 2026-11-20). En desarrollo
              cae al DEMO; en producción solo se pinta si la clave tiene video en
              helpTutorials.ts. */}
          {tutorial && <VideoTutorial t={tutorial} />}
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg2)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {/* Repetir el tour de onboarding de ESTA pantalla (ped. usuario). En el editor de
              recorte el contexto es cf:recorte: el mismo botón repite el tour del recorte. */}
          {tourDe(ctx.key) && (
            <button
              type="button"
              onClick={() => {
                repetirTour(tourDe(ctx.key)!);
                onClose();
              }}
              style={{
                fontSize: 12,
                fontFamily: 'Geist, monospace',
                color: 'var(--txt3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              ⟲ REPETIR TOUR
            </button>
          )}
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
    </ModalOverlay>
  );
}

export default AyudaPanel;
