import { describe, it, expect, beforeEach } from 'vitest';
import { computeBombaTables, bombaAlertas } from '../pumpReport.ts';

/**
 * Las 6 tablas de memoria de la Bomba AR se replican 1:1 desde el objeto que persiste la
 * pantalla (civilflow_memoria_bomba_data). Ej: Qd 3 lps → "47.55 GPM" (×15.8503).
 */

beforeEach(() => {
  localStorage.clear();
});

const datosBase = {
  inputs: {
    salSim: '2',
    udTot: '120',
    hz: '3.5',
    lImp: '25',
    dImp: '3',
    cHW: '140',
    pDesc: '15',
    etaB: '0.65',
    fSrv: '1.25',
    tCic: '6',
    hMin: '0.3',
    hMax: '2.5',
    bCam: '0.7',
    lCam: '1.2',
    npsh: '5',
    sal: 2,
    ud: 120,
  },
  outputs: {
    K: 0.5,
    Qd: 3,
    Qb: 4,
    Vi: 1.2,
    Hf: 1.5,
    Hac: 0.4,
    Hfri: 1.9,
    Hest: 5,
    Hm: 6.9,
    Vch: 'O.K.',
    Ph: 2037,
    Peje: 3134,
    Pcom: 3609,
    php: '5',
    Sel: '5',
    Vcam: 36,
    Vchk: 'O.K.',
  },
};

const fila = (t: { title: string; rows: unknown[][] }, label: string) =>
  t.rows.find((r) => r[0] === label) as unknown[] | undefined;

describe('computeBombaTables · memoria Bomba AR', () => {
  it('sin datos guardados no hay tablas y bombaAlertas da null', () => {
    expect(computeBombaTables()).toEqual([]);
    expect(bombaAlertas()).toBeNull();
  });

  it('con datos: exactamente 6 tablas con sus títulos', () => {
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(datosBase));
    const tabs = computeBombaTables();
    expect(tabs.map((t) => t.title)).toEqual([
      'Bomba AR — datos de entrada',
      'Bomba AR — cálculo de pérdidas de carga',
      'Bomba AR — parámetros de diseño bomba sumergible',
      'Bomba AR — especificación bomba sumergible trituradora',
      'Bomba AR — parámetros de diseño cámara de bombeo',
      'Bomba AR — especificación cámara de bombeo',
    ]);
    expect(bombaAlertas()).toEqual([]); // con datos: [] (esta memoria no emite alertas)
  });

  it('conversiones de unidades en equivalencias: pulg→mm, m.c.a.→psi, lps→GPM', () => {
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(datosBase));
    const [entrada, perdidas] = computeBombaTables();
    expect(fila(entrada, 'Diámetro tubería impulsión')![4]).toBe('75.00 mm'); // 3 pulg × 25
    expect(fila(entrada, 'Presión mínima en descarga')![4]).toBe('21.30 psi'); // 15 × 1.42
    expect(fila(entrada, 'Caudal de diseño Q = UD × K')![4]).toBe('47.55 GPM'); // 3 × 15.8503
    expect(fila(perdidas, 'Altura manométrica total Hm')![4]).toBe('9.80 psi'); // 6.9 × 1.42
  });

  it('valores crudos pasan por or(): texto se copia, vacío/null muestran "—"', () => {
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(datosBase));
    const [entrada] = computeBombaTables();
    expect(fila(entrada, 'Número de salidas simultáneas')![2]).toBe('2');
    const sinSalidas = { ...datosBase, inputs: { ...datosBase.inputs, salSim: '' } };
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(sinSalidas));
    const [entrada2] = computeBombaTables();
    expect(fila(entrada2, 'Número de salidas simultáneas')![2]).toBe('—');
  });

  it('volumen geométrico de cámara = b×l×(hMax−hMin); sin dimensiones cae a "—"', () => {
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(datosBase));
    const tabs = computeBombaTables();
    const camara = tabs[4];
    expect(fila(camara, 'Volumen geométrico disponible')![2]).toBe('1.85'); // 0.7×1.2×2.2
    expect(fila(camara, 'Volumen geométrico disponible')![3]).toBe('m³'); // unidad
    expect(fila(camara, 'Volumen geométrico disponible')![4]).toBe('1848.00 lts'); // ×1000
    const sinDims = {
      ...datosBase,
      inputs: { ...datosBase.inputs, bCam: '0', lCam: '1.2', hMin: '0.3', hMax: '2.5' },
    };
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(sinDims));
    const camara2 = computeBombaTables()[4];
    expect(fila(camara2, 'Volumen geométrico disponible')![2]).toBe('—');
    expect(fila(camara2, 'Volumen geométrico disponible')![4]).toBe('—');
  });

  it('la especificación repite Qb en GPM y Hm en m.c.a., y las dimensiones de cámara en el orden b×l×Δh', () => {
    localStorage.setItem('civilflow_civilflow_memoria_bomba_data', JSON.stringify(datosBase));
    const spec = computeBombaTables()[3];
    expect(spec.rows[0][1]).toBe('63.40 GPM'); // Qb 4 × 15.8503 = 63.4012 → toFixed 2
    expect(spec.rows[1][1]).toBe('6.90 m.c.a.');
    const camaraSpec = computeBombaTables()[5];
    expect(camaraSpec.rows[1][1]).toBe('0.7 x 1.2 x 2.20');
  });
});
