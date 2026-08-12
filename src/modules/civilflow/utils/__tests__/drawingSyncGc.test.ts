import { describe, it, expect } from 'vitest';
import { hasNumericPlanSuffix, isOrphanKey } from '../drawingSync';

describe('hasNumericPlanSuffix', () => {
  it('detects numeric trailing plan segment', () => {
    expect(hasNumericPlanSuffix('af_R1_5')).toBe(true);
    expect(hasNumericPlanSuffix('san_RS2_12')).toBe(true);
  });

  it('rejects keys without plan suffix', () => {
    expect(hasNumericPlanSuffix('af_R1')).toBe(false);
    expect(hasNumericPlanSuffix('ac_AC-01-CAL1_5')).toBe(true);
    expect(hasNumericPlanSuffix('')).toBe(false);
  });
});

describe('isOrphanKey', () => {
  const valid = new Set(['af_R1_5', 'gas_RAC2_5', 'ac_AC-01-CAL1_5', 'af_CNT1_5', 'ac_CAL2_5']);

  it('keeps exact valid keys', () => {
    expect(isOrphanKey('af_R1_5', valid)).toBe(false);
    expect(isOrphanKey('gas_RAC2_5', valid)).toBe(false);
  });

  it('keeps plan-suffixed key of an existing ramal id even if plan differs', () => {
    expect(isOrphanKey('gas_RAC2_7', valid)).toBe(false);
  });

  it('keeps keys without plan suffix when a valid key shares the prefix', () => {
    expect(isOrphanKey('gas_RAC2', valid)).toBe(false);
    expect(isOrphanKey('af_R1', valid)).toBe(false);
  });

  it('deletes keys with no matching ramal anywhere', () => {
    expect(isOrphanKey('af_R999_5', valid)).toBe(true);
    expect(isOrphanKey('san_RX_3', valid)).toBe(true);
    expect(isOrphanKey('af_R999', valid)).toBe(true);
  });
});
