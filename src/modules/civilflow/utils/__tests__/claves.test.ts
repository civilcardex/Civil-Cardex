import { describe, it, expect } from 'vitest';
import {
  countKey,
  ptr,
  splitCount,
  splitTramo,
  splitPtr,
  keyPlanSuffixOf,
  isPlanKeyFor,
  hasNumericPlanSuffix,
  isOrphanKey,
  renombrarIdEnClave,
} from '../claves.ts';
import { claveDeBorrado } from '../../components/pdfViewer/persisteTrazos.ts';

// Track C, gate de datos legado: dibujos viejos (claves sin sufijo, `_P`, punteros sin
// `|`, stubs AC-01, LD_) deben leerse igual antes y después de centralizar en keys.ts.
describe('keys', () => {
  it('countKey respeta la excepción AC-01', () => {
    expect(countKey('ac', 'AC-01-C1', 7)).toBe('ac_C1_7');
    expect(countKey('af', 'RS1', 7)).toBe('af_RS1_7');
    expect(countKey('san', 'T1RS4', 12)).toBe('san_T1RS4_12');
  });
  it('splitCount tolera ids con guion bajo (MAF1_af) y legado', () => {
    expect(splitCount('af_MAF1_af_3')).toEqual(['af', 'MAF1_af', '3']);
    expect(splitCount('san_T1RS4_17')).toEqual(['san', 'T1RS4', '17']);
    expect(splitCount('san_LD_BAN2_17')).toEqual(['san', 'LD_BAN2', '17']);
    expect(splitCount('san_RS4')).toEqual(['san_RS4', '', null]);
    expect(splitCount('af_MON1_P1')).toEqual(['af_MON1_P1', '', null]);
  });
  it('splitTramo corta por el ÚLTIMO guion (AC-01-X-P1)', () => {
    expect(splitTramo('AC-01-X-P1')).toEqual(['AC-01-X', 'P1']);
    expect(splitTramo('RS1-17')).toEqual(['RS1', '17']);
    expect(splitTramo('RS1')).toEqual(['RS1', '']);
  });
  it('splitPtr con fallback legacy (descargaEnId pelado = mismo plano)', () => {
    expect(splitPtr('17|BAN1', null)).toEqual(['17', 'BAN1']);
    expect(splitPtr('BAN1', 17)).toEqual(['17', 'BAN1']);
    expect(splitPtr('', '')).toEqual(['', '']);
    expect(splitPtr(null, 5)).toEqual(['5', '']);
  });
  it('guards de scope por piso intactos', () => {
    expect(keyPlanSuffixOf('san_RS4_17')).toBe('17');
    expect(keyPlanSuffixOf('san_RS4')).toBeNull();
    expect(isPlanKeyFor('san_RS4_17', 17)).toBe(true);
    expect(isPlanKeyFor('san_RS4_18', 17)).toBe(false);
    expect(isPlanKeyFor('san_RS4', 17)).toBe(true);
    expect(hasNumericPlanSuffix('af_X_9')).toBe(true);
    expect(hasNumericPlanSuffix('af_X_P')).toBe(false);
    expect(isOrphanKey('san_RS9_1', new Set(['san_RS1_1']))).toBe(true);
    expect(isOrphanKey('san_RS1_1', new Set(['san_RS1_1']))).toBe(false);
  });
  it('renombrarIdEnClave cubre ramal y T{n} sin tocar el plan', () => {
    expect(renombrarIdEnClave('san_RS4_1', 'RS4', 'RS1')).toBe('san_RS1_1');
    expect(renombrarIdEnClave('san_T1RS4_1', 'RS4', 'RS1')).toBe('san_T1RS1_1');
    expect(renombrarIdEnClave('san_RS5_1', 'RS4', 'RS1')).toBeNull();
    // Id con guion bajo (el split('_') antiguo no lo encontraba) + legado sin plan.
    expect(renombrarIdEnClave('af_MAF1_af_5', 'MAF1_af', 'MAF2_af')).toBe('af_MAF2_af_5');
    expect(renombrarIdEnClave('san_RS4', 'RS4', 'RS1')).toBe('san_RS1');
  });
  it('ptr constructor', () => {
    expect(ptr(3, 'BAN1')).toBe('3|BAN1');
  });
  it('claveDeBorrado: ramal, tributario, LD_ y legado se resuelven igual', () => {
    expect(claveDeBorrado('san_RS4_1', ['RS4'], new Set())).toBe(true);
    expect(claveDeBorrado('san_T1RS4_1', ['RS4'], new Set())).toBe(true);
    expect(claveDeBorrado('san_LD_BAN2_17', ['LD_BAN2'], new Set())).toBe(true);
    expect(claveDeBorrado('san_RS4', ['RS4'], new Set())).toBe(true);
    expect(claveDeBorrado('san_RS5_1', ['RS4'], new Set())).toBe(false);
    // Id reocupado por renumerado no se borra.
    expect(claveDeBorrado('san_RS4_1', ['RS4'], new Set(['RS4']))).toBe(false);
  });
});
