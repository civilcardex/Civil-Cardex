/**
 * Guard de diálogos y overlays (sucesor en disco plano de los G9/G10 del architecture.test
 * eliminado): todo MODAL pasa por ModalShell/ModalOverlay (`<dialog>` nativo con showModal —
 * foco atrapado, Escape dispara cancel, foco devuelto al opener).
 *  - PROHIBIDO `role="dialog"` manual: el rol lo da nativo el `<dialog>`. Única excepción
 *    PERMANENTE: TourOverlay (spotlight del tour, la app queda viva — no es modal).
 *  - PROHIBIDO overlay hand-rolled: `createPortal` + `position: 'fixed'` + `inset: 0` en el
 *    mismo archivo (el patrón exacto de los overlays viejos a body).
 * Ej: un modal nuevo con <div role="dialog" style={{position:'fixed'}}> hace fallar este test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(process.cwd(), 'src');
/** Excepción PERMANENTE: spotlight NO modal (la app queda viva detrás). */
const DIALOG_ROL_OK = ['components/tour/TourOverlay.tsx'];
const OVERLAY_OK = ['components/tour/TourOverlay.tsx'];
/** Este propio test contiene los patrones como strings — se excluye del barrido. */
const AUTO = 'test/__tests__/dialogGuard.test.ts';

function recorrer(dir: string, acc: string[]): void {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta, acc);
    else if (/\.(ts|tsx)$/.test(nombre)) acc.push(ruta);
  }
}

const relativos = (): string[] => {
  const archivos: string[] = [];
  recorrer(RAIZ, archivos);
  return archivos
    .map((a) => a.slice(RAIZ.length + 1).replace(/\\/g, '/'))
    .filter((a) => !a.includes(AUTO));
};

describe('guard de diálogos nativos (G9/G10 en disco plano)', () => {
  it('ningún archivo usa role="dialog" manual (solo TourOverlay, permanente)', () => {
    const malos = relativos()
      .filter((a) => !DIALOG_ROL_OK.some((ok) => a.includes(ok)))
      .filter((a) => /role\s*=\s*["']dialog["']/.test(readFileSync(join(RAIZ, a), 'utf8')));
    expect(
      malos,
      `role="dialog" manual en: ${malos.join(', ')} — usa ModalShell/ModalOverlay`,
    ).toEqual([]);
  });

  it('ningún overlay hand-rolled (createPortal + fixed + inset:0) fuera de TourOverlay', () => {
    const malos = relativos()
      .filter((a) => !OVERLAY_OK.some((ok) => a.includes(ok)))
      .filter((a) => {
        const src = readFileSync(join(RAIZ, a), 'utf8');
        return (
          src.includes('createPortal') &&
          /position:\s*['"]fixed['"]/.test(src) &&
          /inset:\s*0/.test(src)
        );
      });
    expect(
      malos,
      `overlay hand-rolled (portal + fixed + inset:0) en: ${malos.join(', ')} — usa ModalOverlay`,
    ).toEqual([]);
  });
});
