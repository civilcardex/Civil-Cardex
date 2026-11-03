/**
 * Test de CONTRATO del motor RCI (Red Contra Incendio): reproduce el «ejemplo de verificación»
 * del HTML de referencia (CIVILFLOW RCI v1.7.79, Archivo → Cargar ejemplo de verificación) y
 * fija los números de aceptación de la comprobación a mano (doc «Ejemplo guía»). Si este test
 * se rompe, el port se desvió del motor original.
 *
 * Fixture: ejemploVerificacion() es el objeto EXAMPLE() del HTML copiado TAL CUAL (ver
 * types.ts). Tolerancias ±0.05 (o ±0.5 en presiones grandes).
 */
import { describe, it, expect } from 'vitest';
import { compute, clasificar, ejemploVerificacion, type PipeCalc } from '../index';

/** El proyecto de ejemplo del HTML, sin ninguna mutación. */
const st = ejemploVerificacion();
const tips = clasificar(st);
const R = compute(st, tips);

const cerca = (x: number | null | undefined, esperado: number, tol = 0.05): void => {
  expect(x).not.toBeUndefined();
  expect(Math.abs((x as number) - esperado)).toBeLessThanOrEqual(tol);
};

describe('rciEngine · contrato con el ejemplo de verificación del HTML', () => {
  it('fixture: el estado del ejemplo es el del HTML (NPT, techo, S/L, montante, altitud)', () => {
    expect(st.meta.proyecto).toContain('Ejemplo de verificación');
    expect(st.pisos.rows.map((p) => p.nombre)).toEqual(['P3', 'P2', 'P1']);
    expect(st.pisos.rows.map((p) => p.npt)).toEqual([12.2, 6.1, 0]);
    expect(st.clas.htecho).toBe(5.3);
    expect(st.roc.S).toBe(4.3);
    expect(st.roc.L).toBe(3.53);
    expect(st.mont.mat).toBe('Acero SCH 10');
    expect(st.mont.dn).toBe('4"');
    expect(st.bomba.altitud).toBe(959);
    expect(st.redes.A.raiz).toBe('C');
    expect(st.redes.A.ramales.map((r) => r.nombre)).toEqual(['R2', 'R1', 'R3']);
  });

  it('tipologías: una sola T1 con los 3 pisos y representativo P3 (el más alto)', () => {
    expect(tips.groups).toHaveLength(1);
    const g = tips.groups[0];
    expect(g.id).toBe('T1');
    expect(g.pisos).toEqual([2, 1, 0]);
    expect(g.highest).toBe(0);
    expect(g.rep).toBe(0);
    expect(g.planta).toBe('A');
  });

  it('área de diseño (NFPA 13 cap. 19): 1066.2 ft² → 7 rociadores en 3 ramales (3+3+1)', () => {
    const { Adis, Nreq, Nramal, Nramales, Nultimo, Q1, Prem, Qteo, Llargo } = R.roc;
    cerca(Adis, 1066.24);
    expect(Nreq).toBe(7);
    expect(Nramal).toBe(3);
    expect(Nramales).toBe(3);
    expect(Nultimo).toBe(1);
    cerca(Q1, 16.34);
    cerca(Prem, 8.51);
    cerca(Qteo, 106.62);
    cerca(Llargo, 11.94);
    /* Reparto desde el primer ramal de la tabla (el más remoto): R2, R1 y R3 */
    const rams = R.red!.rams;
    expect(rams.map((x) => x.nombre)).toEqual(['R2', 'R1', 'R3']);
    expect(rams.map((x) => x.fl)).toEqual([3, 3, 1]);
    expect(rams.map((x) => x.n0)).toEqual([1, 4, 7]);
    expect(R.red!.Nop).toBe(7);
  });

  it('rociador más remoto y ramales: 16.34 gpm @ 8.51 psi; R1 gobierna el nudo A con 20.29 psi', () => {
    const [r2c, r1c, r3c] = R.red!.rams;
    /* Rociador más remoto (primer rociador de R2): q = K·√Prem = 16.34 gpm a 8.51 psi */
    cerca(r2c.res!.rows[0].q, 16.34);
    cerca(r2c.res!.rows[0].Pini, 8.51);
    /* Diámetros automáticos por velocidad: R2 y R1 de 1¼", R3 de 1" */
    expect(r2c.res!.dn).toBe('1 1/4"');
    expect(r1c.res!.dn).toBe('1 1/4"');
    expect(r3c.res!.dn).toBe('1"');
    /* R1: 50.75 gpm @ 20.29 psi en el nudo A; brazo = 22.20 − 2·4.30 = 13.60 m */
    cerca(r1c.brazo, 13.6);
    cerca(r1c.res!.Qend, 50.75);
    cerca(r1c.res!.Pend, 20.29);
    /* R2 llega a A pidiendo 16.36 psi con 50.75 gpm → se equilibra a la presión de A */
    cerca(r2c.res!.Qend, 50.75);
    cerca(r2c.res!.Pend, 16.36);
    /* R3: 16.34 gpm @ 16.35 psi, K equivalente 4.040 */
    cerca(r3c.res!.Qend, 16.34);
    cerca(r3c.res!.Pend, 16.35);
    cerca(r3c.res!.Keq, 4.04);
    /* Nudo A: gobierna R1; caudal equilibrado 107.26 gpm */
    const A = R.red!.nodes.A;
    cerca(A.P!, 20.29);
    cerca(A.Q!, 107.26);
    expect(A.gov!.tipo).toBe('ramal');
    expect((A.gov as { x: { nombre: string } }).x.nombre).toBe('R1');
  });

  it('tramos hasta la derivación C: T2 suma 4.72 m (1.92 planta + 2.80 bajada) y 2 codos; C = 128.54 gpm @ 37.70 psi', () => {
    const [t1, t2] = R.red!.tramos;
    /* T1 (A→B): 3.87 m + tee 2.44 m con 107.26 gpm → 7.44 psi; B queda en 27.73 psi */
    expect(t1.t.L).toBe(3.87);
    const f1 = t1.res!.rows[0] as PipeCalc;
    cerca(f1.Lt, 6.31);
    cerca(f1.Pf, 7.44);
    cerca(t1.res!.Pend, 27.73);
    /* T2 (B→C): L de la fila = 4.72 m (1.92 de planta + 2.80 de bajada), 2 codos + tee +
       mariposa + detector de flujo (DF del catálogo) = 10.29 m equivalentes */
    expect(t2.t.L).toBe(4.72);
    expect(t2.t.c90).toBe(2);
    expect(t2.t.mar).toBe(1);
    expect(t2.t.esp).toBe('DF');
    const f2 = t2.res!.rows[0] as PipeCalc;
    cerca(f2.leq, 10.29);
    cerca(f2.Lt, 15.01);
    cerca(f2.Pf, 6.0, 0.05);
    /* Desnivel de la bajada: 2.80 m × 1.4206 = 3.98 psi */
    cerca(f2.Pe, 3.98);
    /* Derivación C (raíz de la red): 128.54 gpm @ 37.70 psi */
    cerca(R.red!.rt!.Q!, 128.54);
    cerca(R.red!.rt!.P!, 37.7);
    expect(R.red!.errs).toEqual([]);
  });

  it('gabinetes Clase III (NFPA 14): 500 gpm @ 127.36 psi en la brida de la bomba', () => {
    expect(R.sp.activo).toBe(true);
    expect(R.sp.Qreq).toBe(500);
    expect(R.sp.Preq).toBe(100);
    cerca(R.gab!.Qend, 500);
    cerca(R.gab!.Pend, 127.36);
    /* Ruta: 2 salidas activas de 250 gpm (P3 y P2) + paso por P1 + cuarto de bombas
       (las filas de ENTRADA con salida viven en R.sp.rows; las calculadas no arrastran el flag) */
    expect(R.sp.rows.filter((r) => r.salida)).toHaveLength(2);
    expect(R.sp.rows).toHaveLength(4);
  });

  it('siamesa: 125.1 psi en las entradas con 500 gpm', () => {
    cerca(R.sia!.P, 125.1);
    cerca(R.sia!.Q, 500);
    expect(R.sia!.alto).toBe(false);
  });

  it('perfil de presiones: sin VRP, válvula reguladora en los 3 pisos, estática máx 174.2 psi', () => {
    const pf = R.edif.pf;
    cerca(pf[0].Preq!, 37.7);
    pf.forEach((o) => {
      expect(o.vrp).toBe(false);
      expect(o.reg).toBe(true);
      expect(o.okH).toBe(true);
    });
    /* Residual 1½" de 152 a 170 psi > 100 → reguladora en P3, P2 y P1 */
    cerca(pf[0].res15!, 152.21, 0.5);
    cerca(pf[2].res15!, 169.66, 0.5);
    /* Estática en derivaciones: 153.3 a 170.6 psi < 175 psi (componentes) */
    cerca(pf[2].Pst!, 170.62, 0.5);
    cerca(R.edif.PstMax!, 174.17, 0.5);
  });

  it('bomba (NFPA 20): D2 128.16 psi netos → 500 gpm @ 141 psi, motor 75 HP, churn 169.2 psi', () => {
    const b = R.bomba;
    /* D1 rociadores: 228.54 gpm (128.54 + 100 de mangueras) */
    cerca(b.D1.Q, 228.54);
    cerca(b.D1.P, 58.99, 0.5);
    /* D2 montantes gobierna: 127.36 − (−0.80) = 128.16 psi netos */
    cerca(b.D2!.Q, 500);
    cerca(b.D2!.Pdes, 127.36);
    cerca(b.D2!.Psuc, -0.8);
    cerca(b.D2!.P, 128.16);
    /* Selección: 128.16 × 1.10 = 140.98 → 141 psi con 500 gpm */
    expect(b.Qnom).toBe(500);
    expect(b.Pnom).toBe(141);
    cerca(b.Pchurn, 169.2);
    cerca(b.P150, 91.65);
    /* Motor comercial sin sobrecarga al 150 %: 75 HP */
    expect(b.HPmot).toBe(75);
    /* Presión máxima del sistema: churn + succión máxima = 174.2 psi ≤ 175 */
    cerca(b.Pmaxsis, 174.17, 0.5);
    /* Succión: NPSH disponible 7.20 m; jockey 2 gpm, para a 169.9, arranca a 159.9, principal 154.9 */
    cerca(b.NPSHd, 7.2);
    cerca(b.JkStop, 169.91, 0.5);
    cerca(b.JkStart, 159.91, 0.5);
    cerca(b.PpStart, 154.91, 0.5);
    expect(b.Qjockey).toBe(2);
    /* La demanda D2 queda dentro de la curva: disponible (141) ≥ requerida (128.16) */
    cerca(b.D2!.disp!, 141);
  });

  it('tanque (NFPA 22): 56.8 m³ útiles gobernados por los montantes (30 min)', () => {
    cerca(R.tanque.V, 56.78);
    cerca(R.tanque.Vsp, 56.78);
    cerca(R.tanque.Vroc, 25.95);
    expect(R.tanque.dur).toBe(30);
    expect(R.tanque.tip).toBe('T1');
  });

  it('verificaciones: 44 de 44 en estado CUMPLE', () => {
    expect(R.checks).toHaveLength(44);
    expect(R.count).toEqual({ CUMPLE: 44 });
    const noCumplen = R.checks.filter((v) => v.st !== 'CUMPLE');
    expect(noCumplen.map((v) => `${v.lab}: ${v.st} ${v.val}`)).toEqual([]);
  });

  it('compute es determinista: dos corridas dan el mismo resultado (puro, sin estado global)', () => {
    const R2 = compute(ejemploVerificacion(), clasificar(ejemploVerificacion()));
    expect(R2.red!.rt!.Q).toBe(R.red!.rt!.Q);
    expect(R2.red!.rt!.P).toBe(R.red!.rt!.P);
    expect(R2.bomba.Pnom).toBe(R.bomba.Pnom);
    expect(R2.tanque.V).toBe(R.tanque.V);
    expect(R2.count).toEqual(R.count);
  });
});

describe('rciEngine · succión fuera del catálogo PIPES → verificaciones PENDIENTE', () => {
  it('CPVC 5" (no existe en PIPES): NPSH, velocidad y diámetro de succión quedan PENDIENTE', () => {
    const stSuc = ejemploVerificacion();
    stSuc.bomba.matSuc = 'CPVC SDR 13,5'; // el catálogo CPVC llega solo hasta 3"
    stSuc.bomba.dnSuc = '5"';
    const Rs = compute(stSuc, clasificar(stSuc));
    /* IDs de la succión NaN (pump.ts): los checks que la leen no pueden evaluarse. */
    expect(Number.isFinite(Rs.bomba.IDs)).toBe(false);
    const porLab = new Map(Rs.checks.map((v) => [v.lab, v]));
    for (const lab of [
      'Velocidad en succión al 150 % ≤ 4,57 m/s',
      'Diámetro de succión ≥ mínimo de tabla',
      'NPSH disponible ≥ NPSH requerido + margen',
    ]) {
      expect(porLab.get(lab)?.st).toBe('PENDIENTE');
      expect(porLab.get(lab)?.val).toBe('Sin datos de succión');
    }
  });
});
