/** Modal del ESQUEMA GUÍA del EPC (ped. 2026-11-20 — port del panel #guia del HTML de
 *  referencia, ahora centrado como los demás modales del repo): el SVG resalta con naranja
 *  el grupo `g-*` correspondiente al dato con ⓘ sobre el que se pasa el cursor (hover) o
 *  se hace click; el foco de los inputs también lo activa. Ej: <EpGuiaModal calc apcrit
 *  modo foco setFoco cerrar/> desde EPInputPage. */
import React from 'react';
import { ModalShell } from '../../../../components/shared/ModalShell.tsx';
import { svgGuia } from './epSvgGuide.ts';
import { type EpcR } from './epEngine.ts';

export function EpGuiaModal({
  calc,
  apcrit,
  modo,
  foco,
  setFoco,
  cerrar,
}: {
  calc: EpcR;
  apcrit: string;
  modo: 'red' | 'cisterna';
  /** Grupo resaltado actualmente ('g-hf', 'g-pm', …) o null. */
  foco: string | null;
  setFoco: (g: string | null) => void;
  cerrar: () => void;
}): React.JSX.Element {
  return (
    <ModalShell ariaLabel="Esquema guía de cotas y presiones" minWidth={1100} onClose={cerrar}>
      <div className="ep-imp" style={{ gap: 6, padding: 10 }}>
        <button type="button" className="ep-modal-x" aria-label="Cerrar" onClick={cerrar}>
          ✕
        </button>
        <h3 className="ep-imp-h" style={{ margin: 0 }}>
          Esquema guía ·{' '}
          <span className="ep-dim">
            {modo === 'cisterna' ? 'succión desde cisterna' : 'succión desde la red'}
          </span>
        </h3>
        {/* Hoja blanca que AJUSTA su ancho al alto disponible × proporción del dibujo: el SVG
            llena la hoja de lado a lado (el ancho del modal manda cuando la ventana es alta). */}
        <div className="ep-guia-sheet">
          <div
            className={`ep-guia-b${foco ? ' foc' : ''}`}
            data-foco={foco ?? ''}
            dangerouslySetInnerHTML={{ __html: svgGuia(calc, apcrit) }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="ep-dim" style={{ margin: 0, flex: 1 }}>
            Referencia, no a escala. Los valores son los digitados.
          </p>
          {foco ? (
            <button type="button" className="ep-btn-mini" onClick={() => setFoco(null)}>
              Quitar resaltado
            </button>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
