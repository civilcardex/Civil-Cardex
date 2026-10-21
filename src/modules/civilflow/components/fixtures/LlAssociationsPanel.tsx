import type React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ProbedElement } from '../pdfViewer/tramoEditor/context.ts';
import type { SelectableTarget } from '../fixturesStorage.ts';
import type { BajanteLL } from '../../context/RainwaterContext.tsx';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { NETS } from '../../lib/PlanoEngine/PlanoState.ts';
import { vetarSelloCanal, levantarVetoSelloCanal } from '../../lib/PlanoEngine/channelAssociation';
import {
  ASSOC_CHECKBOX_STYLE,
  ASSOC_ROW_STYLE,
} from '../pdfViewer/drawingElementContextMenu/associatedChannels';
import { camposAsocManual } from '../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import { bajanteLabel, ramalLabel } from '../../utils/accessoryAbbreviations.ts';

/** Panel de asociaciones de aguas lluvias (ll): canales, ramales y bajantes. Cada casilla
 *  escribe en el motor, respeta el veto de sello del canal y refresca la selección. */
export function LlAssociationsPanel(args: {
  netId: string;
  selElement: SelectableTarget | null;
  setSelElement?: Dispatch<SetStateAction<ProbedElement | null>>;
  engineRef: MutableRefObject<PlanoEngine | null>;
  bajantesLl: BajanteLL[];
}): React.ReactNode {
  const { netId, selElement, setSelElement, engineRef, bajantesLl } = args;

  // AGUAS LLUVIAS (ped. usuario): el panel no cuantifica aparatos, pero SÍ muestra
  // secciones de asociación (canales/ramales) cuando hay un bajante o ramal seleccionado.
  if (netId === 'll') {
    const esBaj = selElement?.tipo === 'bajante' || selElement?.id?.startsWith('BALL');
    const esCanalSel = selElement?.tipo === 'canal';
    const esRamal = !!selElement?.pts && !esBaj;
    if (!esBaj && !esRamal && !esCanalSel) {
      return (
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
          <div
            style={{
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              color: 'var(--txt3)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Asociaciones
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--txt2)',
              fontFamily: "'Geist',monospace",
              padding: '4px 0',
            }}
          >
            Selecciona un bajante, canal o ramal de aguas lluvias.
          </div>
        </div>
      );
    }
    const targetIdLl = selElement?.id || '';
    const canales =
      engineRef?.current?.bajantes.filter((b) => b.tipo === 'canal' && b.net === 'll') || [];
    const ramalesLl =
      engineRef?.current?.ramales.filter(
        (r) => r.net === 'll' && r.tipo !== 'tributario' && r.id !== targetIdLl,
      ) || [];
    const bajObj = esBaj
      ? engineRef?.current?.bajantes.find((b) => b.id === targetIdLl)
      : undefined;
    if (esBaj && !bajObj) {
      return (
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: "'Geist',monospace" }}>
            Bajante no encontrado en el motor.
          </div>
        </div>
      );
    }
    const targetLbl = (() => {
      if (esBaj && bajObj) return bajanteLabel(bajObj, bajObj.pisoBase);
      const r = engineRef.current?.ramales.find((x) => x.id === targetIdLl);
      return ramalLabel(r, engineRef.current?.nivelActual?.label || undefined) || targetIdLl;
    })();
    const accentNet = NETS.find((n) => n.id === netId)?.col || '#2563EB';
    const canalActual = bajObj?.canalId || '';
    const Qq = (() => {
      // Q = C·I·A/3600 con los insumos del override del bajante (misma fórmula del chequeo).
      const bll = bajantesLl.find(
        (x) => x.bajante === (bajObj?.code || targetIdLl) || x.id === targetIdLl,
      );
      if (!bll || (bll.areaAcumulada ?? 0) <= 0) return 0;
      return (
        Math.round(
          (((bll.coeficienteC || 0) * (bll.intensidad || 0) * bll.areaAcumulada) / 3600) * 100,
        ) / 100
      );
    })();
    const toggleCanalBaj = (canalId: string): void => {
      const eng = engineRef?.current;
      const baj = bajObj;
      if (!eng || !baj) return;
      const desmarcando = canalActual === canalId;
      const pid = String(engineRef?.current?._loadedPlanId ?? '');
      if (desmarcando) vetarSelloCanal(pid, 'baj', baj.id, canalId);
      else levantarVetoSelloCanal(pid, 'baj', baj.id, canalId);
      eng.updateElementById(baj.id, { canalId: desmarcando ? null : canalId });
      eng.render();
      eng._markDirty();
      if (selElement) setSelElement?.({ ...selElement } as never);
    };
    const toggleRamalBaj = (rid: string): void => {
      const eng = engineRef?.current;
      const baj = bajObj;
      if (!eng || !baj) return;
      const r = eng.ramales.find((x) => x.id === rid);
      if (!r) return;
      const ya = (baj.recibeDeIds || []).includes(rid);
      eng.updateElementById(baj.id, camposAsocManual(baj, rid, !ya));
      eng.render();
      eng._markDirty();
      if (selElement) setSelElement?.({ ...selElement } as never);
    };
    const toggleCanalRamal = (canalId: string): void => {
      const eng = engineRef?.current;
      if (!eng) return;
      const r = eng.ramales.find((x) => x.id === targetIdLl);
      if (!r) return;
      const ya = r.esCanalId === canalId;
      const pid = String(engineRef?.current?._loadedPlanId ?? '');
      if (ya) vetarSelloCanal(pid, 'ram', targetIdLl, canalId);
      else levantarVetoSelloCanal(pid, 'ram', targetIdLl, canalId);
      eng.updateElementById(targetIdLl, { esCanalId: ya ? null : canalId });
      eng.render();
      eng._markDirty();
      if (selElement) setSelElement?.({ ...selElement } as never);
    };
    const fila = (
      checked: boolean,
      label: string,
      onToggle: () => void,
      key: string,
    ): React.ReactNode => (
      <label key={key} style={{ ...ASSOC_ROW_STYLE, marginBottom: 2 }}>
        <input type="checkbox" checked={checked} onChange={onToggle} style={ASSOC_CHECKBOX_STYLE} />
        {label}
      </label>
    );
    return (
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: 'var(--txt3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Asociaciones aguas lluvias
        </div>
        <div
          style={{
            fontSize: 12,
            color: accentNet,
            fontFamily: "'Geist',monospace",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {targetLbl}
        </div>
        {esBaj && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 3 }}>
              CANALES ASOCIADOS
            </div>
            {canales.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '2px 0 6px' }}>
                Sin canales dibujados en este piso.
              </div>
            )}
            {canales.map((c) =>
              fila(canalActual === c.id, c.code || c.id, () => toggleCanalBaj(c.id), c.id),
            )}
            <div
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', margin: '8px 0 3px' }}
            >
              RAMALES ASOCIADOS
            </div>
            {ramalesLl.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '2px 0 6px' }}>
                Sin ramales de lluvias dibujados.
              </div>
            )}
            {ramalesLl.map((r) =>
              fila(
                (bajObj?.recibeDeIds || []).includes(r.id),
                r.id,
                () => toggleRamalBaj(r.id),
                'r_' + r.id,
              ),
            )}
            {esBaj && bajObj && Qq > 0 && (
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  color: 'var(--txt2)',
                  marginTop: 8,
                }}
              >
                Q = <b style={{ color: 'var(--acc)' }}>{Qq.toFixed(2)}</b> L/s
              </div>
            )}
          </>
        )}
        {esRamal && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 3 }}>
              CANALES ASOCIADOS
            </div>
            {canales.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '2px 0 6px' }}>
                Sin canales dibujados en este piso.
              </div>
            )}
            {canales.map((c) => {
              const r = engineRef?.current?.ramales.find((x) => x.id === targetIdLl);
              return fila(
                r?.esCanalId === c.id,
                c.code || c.id,
                () => toggleCanalRamal(c.id),
                c.id,
              );
            })}
          </>
        )}
        {esCanalSel && (
          <>
            {/* BIDIRECCIONAL (orig. usuario): la asociación vive en b.canalId — desde el canal
              se ven y editan los mismos bajantes que marcaron desde el lado del bajante. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 3 }}>
              BAJANTES ASOCIADOS
            </div>
            {(() => {
              const bajantesLlSel =
                engineRef?.current?.bajantes.filter(
                  (b) => b.net === 'll' && b.tipo === 'bajante',
                ) || [];
              if (bajantesLlSel.length === 0)
                return (
                  <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '2px 0 6px' }}>
                    Sin bajantes de lluvias dibujados.
                  </div>
                );
              return bajantesLlSel.map((b) =>
                fila(
                  b.canalId === targetIdLl,
                  b.code || b.id,
                  () => {
                    const eng = engineRef?.current;
                    if (!eng) return;
                    const desmarcando = b.canalId === targetIdLl;
                    const pid = String(engineRef?.current?._loadedPlanId ?? '');
                    if (desmarcando) vetarSelloCanal(pid, 'baj', b.id, targetIdLl);
                    else levantarVetoSelloCanal(pid, 'baj', b.id, targetIdLl);
                    eng.updateElementById(b.id, {
                      canalId: desmarcando ? null : targetIdLl,
                    });
                    eng.render();
                    eng._markDirty();
                    if (selElement) setSelElement?.({ ...selElement } as never);
                  },
                  'b_' + b.id,
                ),
              );
            })()}
          </>
        )}
      </div>
    );
  }
  return null;
}
