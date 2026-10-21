import {
  ASSOC_CHECKBOX_STYLE,
  ASSOC_ROW_STYLE,
} from '../pdfViewer/drawingElementContextMenu/canalesAsociados';
import { camposAsocManual } from '../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { SelectableTarget } from '../fixturesStorage.ts';
import type { ProbedElement } from '../pdfViewer/tramoEditor/context.ts';

/**
 * ¿El ramal es el Ldesvio (LD_<idSuperior>) del enlace entre pisos de este bajante/montante?
 * El LD llega por su `fin` (el código del bajante) y el anillo del fantasma lo referencia
 * (desplazamientos[nivel].Ldesvio). Se usa para marcarlo como asociado aunque la lista de
 * `recibeDeIds` no lo tenga (fantasma y original).
 */
function esLdesvioDeEsteMontante(
  baj:
    | {
        id: string;
        code?: string;
        desplazamientos?: Record<string, { Ldesvio?: string | null }>;
      }
    | undefined,
  ramalId: string,
  nivelLabel: string | undefined,
): boolean {
  if (!baj || !ramalId) return false;
  const desp = nivelLabel ? baj.desplazamientos?.[nivelLabel] : undefined;
  if (desp?.Ldesvio && desp.Ldesvio === ramalId) return true;
  return false;
}

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
    // Mismo criterio que el render de la fila: marcado por Ldesvio → el primer clic
    // DESASOCIA (si `ya` solo mirara listas, el clic sobre un checkbox marcado asociaba).
    const ya =
      (vivo.recibeDeIds || []).includes(ramalId) ||
      (vivo.alimentaIds || []).includes(ramalId) ||
      esLdesvioDeEsteMontante(vivo, ramalId, eng.nivelActual?.label);
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
              if (
                (vivo?.recibeDeIds || []).includes(f.id) ||
                (vivo?.alimentaIds || []).includes(f.id)
              )
                return true;
              // El Ldesvio (LD_<idSuperior>) es el ramal del ENLACE entre pisos: llega al
              // montante por su `fin` y el anillo del fantasma lo referencia. Debe salir
              // MARCADO como asociado aunque el lista no lo tenga (fantasma y original).
              return esLdesvioDeEsteMontante(vivo, f.id, eng.nivelActual?.label);
            })()
          : (() => {
              const vivo = eng.bajantes.find((x) => x.id === f.id);
              if (
                (vivo?.recibeDeIds || []).includes(targetId) ||
                (vivo?.alimentaIds || []).includes(targetId)
              )
                return true;
              return esLdesvioDeEsteMontante(vivo, targetId, eng.nivelActual?.label);
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
