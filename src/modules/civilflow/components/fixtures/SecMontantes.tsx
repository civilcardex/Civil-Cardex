import {
  ASSOC_CHECKBOX_STYLE,
  ASSOC_ROW_STYLE,
} from '../pdfViewer/drawingElementContextMenu/canalesAsociados';
import { camposAsocManual } from '../../lib/PlanoEngine/PlanoEngineSelectionEdit';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { SelectableTarget } from '../fixturesStorage';
import type { ProbedElement } from '../pdfViewer/tramoEditor/context';

// ASOCIACIONES af/ac (orig. usuario): tramo → MONTANTES ASOCIADOS; montante → RAMALES
// ASOCIADOS (la inversa). Extraído verbatim de FixturesPanel (IIFE secMontantes) — misma
// semántica, mismos estilos que las secciones del menú contextual.
export function SecMontantes({
  netId,
  engineRef,
  targetId,
  targetLbl,
  accent,
  selElement,
  setSelElement,
}: {
  netId: string;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  targetId: string | null;
  targetLbl: string;
  accent: string;
  selElement: SelectableTarget | null;
  setSelElement?: React.Dispatch<React.SetStateAction<ProbedElement | null>> | undefined;
}) {
  if (!(netId === 'af' || netId === 'ac')) return null;
  const eng = engineRef.current;
  if (!eng || !targetId) return null;
  const esMontanteSel = selElement?.tipo === 'montante';
  const esRamalSel = !!selElement?.pts && !esMontanteSel;
  if (!esMontanteSel && !esRamalSel) return null;

  const refrescar = (): void => {
    if (selElement) setSelElement?.({ ...selElement } as never);
  };
  const toggleBaj = (bajId: string, ramalId: string): void => {
    const vivo = eng.bajantes.find((x) => x.id === bajId);
    if (!vivo) return;
    const ya =
      (vivo.recibeDeIds || []).includes(ramalId) || (vivo.alimentaIds || []).includes(ramalId);
    eng.updateElementById(bajId, camposAsocManual(vivo, ramalId, !ya));
    eng.render();
    eng._markDirty();
    refrescar();
  };

  const filas = esMontanteSel
    ? eng.ramales
        .filter((r) => r.net === netId && r.tipo !== 'tributario')
        .map((r) => ({ id: r.id, label: r.label || r.id }))
    : eng.bajantes
        .filter((b) => b.net === netId && b.tipo === 'montante')
        .map((m) => ({ id: m.id, label: m.code || m.id }));
  if (filas.length === 0) return null;
  const titulo = esMontanteSel ? 'RAMALES ASOCIADOS' : 'MONTANTES ASOCIADOS';

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
          color: accent,
          fontFamily: "'Geist',monospace",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {targetLbl}
      </div>
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: '#849495',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {titulo}
      </div>
      {filas.map((f) => {
        const activo = esMontanteSel
          ? (() => {
              const vivo = eng.bajantes.find((x) => x.id === targetId);
              return (
                (vivo?.recibeDeIds || []).includes(f.id) || (vivo?.alimentaIds || []).includes(f.id)
              );
            })()
          : (() => {
              const vivo = eng.bajantes.find((x) => x.id === f.id);
              return (
                (vivo?.recibeDeIds || []).includes(targetId) ||
                (vivo?.alimentaIds || []).includes(targetId)
              );
            })();
        return (
          <label key={f.id} style={{ ...ASSOC_ROW_STYLE, marginBottom: 2 }}>
            <input
              type="checkbox"
              checked={activo}
              onChange={() =>
                toggleBaj(esMontanteSel ? targetId : f.id, esMontanteSel ? f.id : targetId)
              }
              style={ASSOC_CHECKBOX_STYLE}
            />
            {f.label}
          </label>
        );
      })}
    </div>
  );
}
