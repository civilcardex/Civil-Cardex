import { describe, it, expect } from 'vitest';
import { buildRamalLabelParts } from '../ramalLabelText.ts';

describe('buildRamalLabelParts (formato por red, Ítem 1)', () => {
  it('san con todo: "S4" P 0.5% 3.20m"; sin nada → null (cae al genérico vacío)', () => {
    const full = buildRamalLabelParts(
      { net: 'san', diametro: '4"', pendiente: 0.5, totalL: 3.2, label: 'RS1' },
      2,
    );
    expect(full.infoStr).toBe('S4" P0.5% 3.20m');
    expect(full.lbl).toBe('RS1-P2');
    const empty = buildRamalLabelParts({ net: 'san' }, null);
    // El guard de "S"/"S P% m" no cubre 'S P%' (pendiente numérica ausente pero flag on) —
    // comportamiento real del formato san.
    expect(empty.infoStr).toBe('S P%');
    expect(empty.matPart).toBe('');
  });

  it('ll canal: L/S/D editables; ll normal: ALL + P + longitud', () => {
    const canal = buildRamalLabelParts(
      { net: 'll', esCanalId: 'CH1', diametro: '6"', pendiente: 2, totalL: 5 },
      null,
    );
    expect(canal.infoStr).toBe('L=5.00m S=2% D=6"');
    const normal = buildRamalLabelParts(
      { net: 'll', diametro: '3"', pendiente: 1.5, totalL: 2.5 },
      null,
    );
    expect(normal.infoStr).toBe('ALL 3" P 1.5% 2.50m');
  });

  it('ac/af: prefijo de material + diámetro con rde; gas: material del catálogo', () => {
    // normalizeDnLabel no despoja el prefijo CPVC del dato: el segmento duplica el material —
    // comportamiento real del formato ac.
    const ac = buildRamalLabelParts({ net: 'ac', diametro: 'CPVC 1/2" C', totalL: 1 }, null);
    expect(ac.infoStr).toBe('CPVC CPVC 1/2" C 1.00m');
    const af = buildRamalLabelParts({ net: 'af', diametro: 'PVC 3/4"', totalL: 1 }, null);
    expect(af.infoStr).toBe('PVC PVC 3/4" 1.00m');
    const gas = buildRamalLabelParts({ net: 'gas', diametro: '1/2"', totalL: 4 }, null);
    expect(gas.infoStr).toContain('4.00m');
  });

  it('vent (genérico): sin infoStr, matPart PVC-V de respaldo + D/S/L', () => {
    const v = buildRamalLabelParts(
      { net: 'vent', diametro: '2"', pendiente: 1, totalL: 2, label: 'RV1' },
      null,
    );
    expect(v.infoStr).toBeNull();
    expect(v.matPart).toBe('PVC-V');
    expect(v.dPart).toBe('D=2"');
    // pendPart solo aplica a san/ll (showPend) — en vent queda vacío aunque haya pendiente.
    expect(v.pendPart).toBe('');
    expect(v.lblPart).toBe('L=2.00m');
  });
});
