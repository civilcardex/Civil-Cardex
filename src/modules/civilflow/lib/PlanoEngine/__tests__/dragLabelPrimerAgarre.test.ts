import { describe, expect, it } from 'vitest';
import { dragLabel } from '../drags/dragAnnotations.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

/** Ramal san horizontal con etiqueta NUNCA movida: ancla en el punto medio (100,0),
 *  caja pintada DESPLAZADA por el des-tapado (declutter) a (150,−60). Canvas ≡ plano. */
function ramalConCajaDesplazada(labelMoved = false): PlanoRamal {
  return {
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    pts: [
      [0, 0],
      [200, 0],
    ],
    labelX: 100,
    labelY: 0,
    labelMoved,
    _labelBox: {
      cx: 150,
      cy: -60,
      w: 80,
      h: 30,
      angle: 0,
      minX: 110,
      minY: -75,
      maxX: 190,
      maxY: -45,
      corners: [],
    },
  } as unknown as PlanoRamal;
}

function motor(ramal: PlanoRamal, offX: number, offY: number) {
  // Canvas ≡ plano (zoom 1, sin cámara): toCvs/toPlane son identidad. mm2cvs ≈ 3 px/mm.
  return {
    ramales: [ramal],
    bajantes: [],
    areas: [],
    dims: [],
    lblDrag: { id: 'RS1', offX, offY },
    zoom: 1,
    mm2cvs: (mm: number) => mm * 3,
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    scheduleRender: () => {},
  } as unknown as IPlanoEngineCore;
}

/** El usuario AGARRA la caja pintada en (155,−65): off original = grab − ancla = (55,−65).
 *  Gap con h=30, zoom=1: labelClear = max(18, 10.5, 16) = 18 → gap = (0, −33).
 *  Re-anclaje: ancla nueva = caja − gap = (150, −27); dAncla = (50, −27) → off = (5, −38).
 *  Move del cursor +40,+10 → (195,−55): p = (190, −17) → caja nueva = (190, −50)
 *  = cajaVieja + delta del cursor EXACTO — la caja siguió al cursor sin teleport. */
describe('dragLabel · primer agarre de etiqueta des-tapada', () => {
  it('re-ancla al centro agarrado: la caja sigue al cursor sin salto', () => {
    const r = ramalConCajaDesplazada();
    const eng = motor(r, 55, -65); // off = grab(155,−65) − ancla(100,0)
    dragLabel(eng, 195, -55); // grab + (40,10)
    expect(r.labelMoved).toBe(true);
    expect(r.labelX).toBeCloseTo(190, 0);
    const cajaNuevaCy = r.labelY! - 33; // la caja se pinta a ancla − 33 en y (angle 0)
    expect(cajaNuevaCy).toBeCloseTo(-50, 0); // cajaVieja.cy (−60) + delta (10)
  });

  it('etiqueta YA movida: sin re-anclaje (comportamiento previo intacto)', () => {
    const r = ramalConCajaDesplazada(true);
    const eng = motor(r, 55, -65);
    dragLabel(eng, 195, -55);
    expect(eng.lblDrag!.offX).toBe(55);
    expect(eng.lblDrag!.offY).toBe(-65);
    // p = cursor − off, sin corrección: (140, 10)
    expect(r.labelX).toBe(140);
    expect(r.labelY).toBe(10);
  });
});
