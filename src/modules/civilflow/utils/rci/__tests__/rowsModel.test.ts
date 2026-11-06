/**
 * Test del modelo de filas de la UI RCI (Red Contra Incendio) contra el «ejemplo de
 * verificación» del motor (mismo contrato que rciEngine.test): si estos números se rompen, la
 * tabla que ve el diseñador se desvió del motor. Tolerancias ±0.05 (±0.5 en presiones grandes).
 */
import { describe, expect, it } from 'vitest';
import { compute, clasificar, ejemploVerificacion } from '../../../lib/rci/index.ts';
import type { RciState } from '../../../lib/rci/types.ts';
import { extraerGris } from '../extract.ts';
import type { DrawingData, RawElement } from '../../drawingSyncTypes.ts';
import {
  desgloseDeTramo,
  filasRamales,
  filasTipologias,
  filasTramos,
  filasVerificaciones,
  grupoDeCheck,
  kvBombaTanque,
  kvRociadorCobertura,
  kvRociadorDiseno,
  kvSiamesa,
  resumenTipologias,
  sembrarRci,
} from '../RCIRowsModel.ts';
import {
  accionPerfil,
  filasDetalleNudo,
  filasGabinete,
  filasNudos,
  filasPerfilPiso,
} from '../RCIRowsModel2.ts';
import {
  datosRectangulo,
  inchOf,
  kvCuarto,
  kvDemandas,
  kvJockey,
  kvSeleccion,
  kvSuccion,
  kvTanque,
  RUTA_DE,
  rangoTipologia,
  sismoConteo,
  stripDerivacion,
  SUBS_POR_TAB,
} from '../RCIRowsModelExtras.ts';

const st: RciState = ejemploVerificacion();
const tips = clasificar(st);
const R = compute(st, tips);

const cerca = (x: number | null | undefined, esperado: number, tol = 0.05): void => {
  expect(x).not.toBeUndefined();
  expect(Math.abs((x as number) - esperado)).toBeLessThanOrEqual(tol);
};

describe('rowsModel · tablas del piso activo contra el ejemplo de verificación', () => {
  it('ramales: R1 cierra con 50.75 gpm @ 20.29 psi y R2 se equilibra a la presión del nudo A', () => {
    const filas = filasRamales(st.redes.A, R.red);
    expect(filas.map((f) => f.nombre)).toEqual(['R2', 'R1', 'R3']);
    const porNombre = new Map(filas.map((f) => [f.nombre, f]));
    const r1 = porNombre.get('R1')!;
    cerca(r1.Q, 50.75);
    cerca(r1.P, 20.29);
    cerca(r1.brazo, 13.6);
    expect(r1.ok).toBe(true);
    expect(r1.dnUsado).toBe('1 1/4"');
    const r2 = porNombre.get('R2')!;
    cerca(r2.Q, 50.75);
    cerca(r2.P, 16.36);
    expect(r2.auto).toBe(true);
  });

  it('tramos: T2 con desglose 1.92 planta + 2.80 bajada; la derivación C queda en 128.54 @ 37.70', () => {
    const filas = filasTramos(st.redes.A, R.red, 5.3, 2.5);
    expect(filas.map((f) => f.nombre)).toEqual(['T1', 'T2']);
    const t1 = filas[0];
    cerca(t1.L, 3.87);
    cerca(t1.desgPlanta!, 3.87);
    expect(t1.desgBajada).toBeNull();
    const t2 = filas[1];
    cerca(t2.L, 4.72);
    cerca(t2.desgPlanta!, 1.92);
    cerca(t2.desgBajada!, 2.8);
    cerca(t2.Q, 128.54);
    cerca(t2.Pfin, 37.7, 0.5);
    cerca(t2.Pe, 3.98);
    expect(t2.ok).toBe(true);
  });

  it('desgloseDeTramo: manda lo que el extractor escribió (desgPlanta/desgBajada) si viene', () => {
    const d = desgloseDeTramo({ L: 9.99, desgPlanta: 7.19, desgBajada: 2.8 }, true, 5.3, 2.5);
    expect(d).toEqual({ planta: 7.19, bajada: 2.8 });
    const fuera = desgloseDeTramo({ L: 3.5 }, false, 5.3, 2.5);
    expect(fuera).toEqual({ planta: 3.5, bajada: null });
  });

  it('criterios de rociadores: área de diseño 1066.24 ft², 7 rociadores y remoto 16.34 @ 8.51', () => {
    const diseno = kvRociadorDiseno(R.roc, R.roc.hz.qr ? 'Sí' : 'No', 'Húmedo');
    const porL = new Map(diseno.map((k) => [k.l, k]));
    expect(porL.get('Área adoptada')!.v).toContain('1.066,2');
    expect(porL.get('Reducción QR')!.v).toContain('29');
    const cob = kvRociadorCobertura(R.roc, R.Nop);
    const porC = new Map(cob.map((k) => [k.l, k]));
    expect(porC.get('Rociadores exigidos en el área')!.v).toBe('7');
    expect(porC.get('Rociadores exigidos en el área')!.nota).toContain('7 con flujo');
    expect(porC.get('Rociador más remoto')!.v).toBe('16,34');
    expect(porC.get('Presión del más remoto')!.v).toBe('8,5');
  });

  it('tipologías: una T1 con los 3 pisos, representativo P3 y derivación 37.70 psi / 128.54 gpm', () => {
    const filas = filasTipologias(st, tips);
    expect(filas.map((f) => f.nombre)).toEqual(['P3', 'P2', 'P1']);
    expect(filas.map((f) => f.esRep)).toEqual([true, false, false]);
    expect(filas.map((f) => f.tipId)).toEqual(['T1', 'T1', 'T1']);
    const res = resumenTipologias(tips, R.edif);
    expect(res).toHaveLength(1);
    /* tips.groups[0].pisos va en orden de NPT ascendente: índices [2,1,0] → P1 + P2 + P3. */
    expect(res[0].pisos).toBe('P1 + P2 + P3');
    expect(res[0].representativo).toBe('P3');
    expect(res[0].conRed).toBe(true);
    cerca(res[0].P, 37.7, 0.5);
    cerca(res[0].Q, 128.54);
  });

  it('montante y siamesa: ruta 500 gpm @ 127.36 psi y siamesa 125.1 psi', () => {
    const sia = kvSiamesa(R.sia);
    expect(sia[0].v).toBe('125,1');
  });

  it('bomba y tanque: 500 gpm @ 141 psi, motor 75 HP, churn 169.2 y tanque 56.78 m³', () => {
    const kv = kvBombaTanque(R.bomba, R.tanque, 'P3');
    const porL = new Map(kv.map((k) => [k.l, k]));
    expect(porL.get('Bomba seleccionada')!.v).toBe('500');
    expect(porL.get('Bomba seleccionada')!.nota).toContain('141');
    expect(porL.get('Motor comercial')!.v).toBe('75');
    expect(porL.get('Presión a caudal cero (churn)')!.v).toBe('169,2');
    expect(porL.get('Tanque contra incendio')!.v).toBe('56,8');
    expect(porL.get('Tanque contra incendio')!.nota).toContain('30 min');
    expect(porL.get('Tanque contra incendio')!.nota).toContain('T1');
  });
});

describe('rowsModel · verificaciones agrupadas', () => {
  it('las 44 del ejemplo quedan repartidas entre los grupos y todas CUMPLE', () => {
    const grupos = filasVerificaciones(R.checks);
    const total = grupos.reduce((a, g) => a + g.items.length, 0);
    expect(total).toBe(44);
    const noCumplen = grupos.flatMap((g) => g.items).filter((v) => v.st !== 'CUMPLE');
    expect(noCumplen).toEqual([]);
    /* Sin huérfanas: toda verificación cayó en un grupo del catálogo. */
    const idsGrupos = new Set(grupos.map((g) => g.id));
    for (const v of R.checks) expect(idsGrupos.has(grupoDeCheck(v))).toBe(true);
  });

  it('grupoDeCheck manda el "go" del motor: local → normativa, bomba/tanque → bomba, sia/sp → montantes', () => {
    expect(
      grupoDeCheck({
        lab: '',
        st: '',
        val: '',
        nor: '',
        guide: '',
        go: ['entradas', 'local.codLocal'],
      }),
    ).toBe('normativa');
    expect(
      grupoDeCheck({
        lab: '',
        st: '',
        val: '',
        nor: '',
        guide: '',
        go: ['entradas', 'clas.riesgo'],
      }),
    ).toBe('tipologias');
    expect(
      grupoDeCheck({ lab: '', st: '', val: '', nor: '', guide: '', go: ['pisos', 'piso:0:vrp'] }),
    ).toBe('tipologias');
    expect(
      grupoDeCheck({
        lab: '',
        st: '',
        val: '',
        nor: '',
        guide: '',
        go: ['entradas', 'bomba.margen'],
      }),
    ).toBe('bomba');
    expect(
      grupoDeCheck({ lab: '', st: '', val: '', nor: '', guide: '', go: ['entradas', 'sia.L'] }),
    ).toBe('montantes');
    expect(grupoDeCheck({ lab: '', st: '', val: '', nor: '', guide: '', go: ['hidraulica'] })).toBe(
      'hidraulica',
    );
    expect(grupoDeCheck({ lab: '', st: '', val: '', nor: '', guide: '', go: ['sismo'] })).toBe(
      'normativa',
    );
    expect(grupoDeCheck({ lab: '', st: '', val: '', nor: '', guide: '' })).toBe('generales');
  });
});

describe('sembrarRci · amarillos del proyecto nuevo', () => {
  it('estado recién extraído: riesgo leve y húmedo de referencia; numéricos/booleanos VACÍOS y cada piso apuntando a la red de su plano', () => {
    const gris = extraerGris([
      { planId: 'p1', label: 'P1', npt: 0, doc: null },
      { planId: 'p2', label: 'P2', npt: 6.1, doc: null },
    ]);
    const est = sembrarRci(gris.estado, 'Torre Norte');
    expect(est.meta.proyecto).toBe('Torre Norte');
    expect(est.clas.riesgo).toBe('Riesgo leve');
    expect(est.clas.sistema).toBe('Húmedo');
    /* Numéricos y booleanos VACÍOS por defecto (ped. usuario) — el motor resuelve sus
       defaults de norma al calcular. */
    expect(est.clas.htecho).toBe('');
    expect(est.roc.K).toBe('');
    expect(est.roc.S).toBe('');
    expect(est.local.exigeRoc).toBe('');
    expect(est.tub.Vmax).toBe('');
    expect(est.mang.duracion).toBe('');
    expect(est.sp.clase).toBe('Clase III');
    /* El cuarto de bombas y los criterios por piso NO se siembran (ped. usuario: nada
       fabricado) — nacen vacíos hasta que el diseñador los llene. */
    expect(est.mont.cuarto).toEqual([]);
    expect(est.pisos.rows.map((r) => r.riesgo)).toEqual(['', '']);
    expect(est.pisos.rows.map((r) => r.planta)).toEqual(['p1', 'p2']);
    expect(est.pisos.rows.map((r) => r.K)).toEqual(['', '']);
    /* Salida GRIS del extractor: 'Ninguna' sin gabinetes dibujados. */
    expect(est.pisos.rows.map((r) => r.salida)).toEqual(['Ninguna', 'Ninguna']);
  });

  it('es idempotente y jamás pisa lo digitado (ni el riesgo "Sin rociadores")', () => {
    const gris = extraerGris([{ planId: 'p1', label: 'P1', npt: 0, doc: null }]);
    const est1 = sembrarRci(gris.estado, 'T');
    est1.pisos.rows[0].riesgo = 'Sin rociadores';
    est1.roc.K = 8.0;
    const est2 = sembrarRci(est1, 'T');
    expect(est2).toBe(est1);
    expect(est2.pisos.rows[0].riesgo).toBe('Sin rociadores');
    expect(est2.roc.K).toBe(8.0);
  });

  it('el ejemplo de verificación ya viene sembrado: no cambia', () => {
    const est = sembrarRci(ejemploVerificacion(), 'Otro nombre');
    expect(est.meta.proyecto).toBe('Ejemplo de verificación – edificio de oficinas de 3 pisos');
    expect(est.bomba.altitud).toBe(959);
    expect(est.mont.cuarto).toEqual(ejemploVerificacion().mont.cuarto);
    expect(est.pisos.rows.map((r) => r.planta)).toEqual(['A', 'A', 'A']);
  });
});

describe('rowsModel · flujo completo dibujo → sembrar → compute', () => {
  /** El trazo de una ramal con `n` rociadores en sus vértices (igual que el test del extractor). */
  function ramalRci(id: string, pts: number[][], totalL: number, rociadores: number): RawElement {
    const accMed: Record<string, string> = {};
    for (let i = 0; i < rociadores; i++) accMed[`accMed${i}`] = 'rociador';
    return { id, net: 'rci', tipo: 'ramal', pts, totalL, accMed };
  }

  it('la planta extraída, sembrada con planta = planId, computa: la red cierra en la derivación', () => {
    /* Planta mínima: T1 (planta) → T2 (a la derivación del montante), 2 ramales con rociadores. */
    const doc: DrawingData = {
      ramales: [
        {
          id: 't1',
          net: 'rci',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [3.87, 0],
          ],
          totalL: 3.87,
        },
        {
          id: 't2',
          net: 'rci',
          tipo: 'ramal',
          pts: [
            [3.87, 0],
            [5.79, 0],
          ],
          totalL: 1.92,
        },
        ramalRci(
          'r1',
          [
            [0, -22.2],
            [0, -17.76],
            [0, -13.32],
            [0, -8.88],
            [0, -4.44],
            [0, 0],
          ],
          22.2,
          5,
        ),
        ramalRci(
          'r2',
          [
            [-18.67, 0],
            [-14.936, 0],
            [-11.202, 0],
            [-7.468, 0],
            [-3.734, 0],
            [0, 0],
          ],
          18.67,
          5,
        ),
      ],
      bajantes: [{ id: 'm1', net: 'rci', tipo: 'montante', code: 'MRCI1', x: 5.79, y: 0 }],
    };
    const gris = extraerGris([{ planId: '9', label: 'P1', npt: 0, doc }]);
    const est = sembrarRci(gris.estado, 'Torre');
    /* Numéricos VACÍOS por defecto (ped. usuario): aquí se digitan K/S/L — el conteo del
       área de diseño los necesita (los defaults de norma cubren presión/velocidad). */
    est.roc.K = 5.6;
    est.roc.S = 4.3;
    est.roc.L = 3.53;
    /* La semilla conecta el piso con la red de su plano: planta = planId = clave de la red.
       (El motor lee la planta con toUpperCase: los planIds numéricos son invariantes.) */
    expect(est.pisos.rows[0].planta).toBe('9');
    const tips = clasificar(est);
    const R2 = compute(est, tips);
    expect(R2.edif.typ.T1.pend).toBeFalsy();
    expect(R2.red?.rt?.solved).toBe(true);
    expect(R2.red?.errs).toEqual([]);
    expect(R2.Nop).toBeGreaterThan(0);
    /* La fila de ramales de la UI refleja el cálculo del motor. */
    const rams = filasRamales(est.redes['9'], R2.red);
    expect(rams.every((f) => f.ok)).toBe(true);
    expect(rams.every((f) => (f.Q ?? 0) > 0)).toBe(true);
  });
});

describe('rowsModelRci2 · perfil de presiones (perfilTable + perfilSide)', () => {
  it('filas por piso de arriba a abajo: P3 gobierna, P1 tiene la estática más alta (≈170.6)', () => {
    const per = filasPerfilPiso(R.edif);
    expect(per.map((f) => f.nombre)).toEqual(['P3', 'P2', 'P1']);
    expect(per.map((f) => f.gobierna)).toEqual([true, false, false]);
    expect(per.map((f) => f.tId)).toEqual(['T1', 'T1', 'T1']);
    cerca(per[0].Pst!, 153.29, 0.5);
    cerca(per[1].Pst!, 161.95, 0.5);
    cerca(per[2].Pst!, 170.62, 0.5);
    cerca(per[0].zT!, 14.7);
    cerca(per[2].zS!, 1.2);
    cerca(per[0].Q!, 128.54);
    cerca(per[0].Preq!, 37.7, 0.5);
  });

  it('los 3 pisos con salida 2½" + 1½" piden válvula reguladora (residual 1½" > 100) y sin VRP', () => {
    const per = filasPerfilPiso(R.edif);
    for (const f of per) {
      expect(f.reg).toBe(true);
      expect(f.regFalta).toBe(false);
      expect(f.regRes).toBe(true);
      expect(f.regEst).toBe(false);
      expect(f.res15!).toBeGreaterThan(100);
      expect(f.vrp).toBe(false);
      expect(f.vrpFalta).toBe(false);
      expect(f.vrpSet).toBe(43);
      expect(f.okH).toBe(true);
    }
    cerca(per[0].res15!, 152.21, 0.5);
    cerca(per[2].res15!, 169.66, 0.5);
    const chips = accionPerfil(per[2], R.edif.Pc || 175);
    expect(chips.some((c) => c.c === 'REVISAR' && c.txt === 'Válvula reguladora en gabinete')).toBe(
      true,
    );
    expect(chips.some((c) => c.txt === 'Holgura insuficiente')).toBe(false);
    expect(chips.some((c) => c.c === 'REVISAR' && c.txt === 'Gobierna la bomba')).toBe(false);
    expect(accionPerfil(per[0]).some((c) => c.txt === 'Gobierna la bomba')).toBe(true);
  });

  it('sin red la fila queda pendiente: chip PENDIENTE y línea "tipología … sin red"', () => {
    const est2 = ejemploVerificacion();
    delete est2.redes.A;
    const tips2 = clasificar(est2);
    const R2 = compute(est2, tips2);
    const per = filasPerfilPiso(R2.edif);
    expect(per.every((f) => !f.conRes)).toBe(true);
    expect(accionPerfil(per[0])[0]).toEqual({ c: 'PENDIENTE', txt: 'Red pendiente' });
  });
});

describe('rowsModelRci2 · nudos y detalle nudo a nudo', () => {
  it('filasNudos: A 20.29, B 27.73 y la derivación C con 128.54 gpm @ 37.70 psi', () => {
    const nds = filasNudos(R.red!);
    expect(nds.map((n) => n.nudo)).toEqual(['A', 'B', 'C']);
    const a = nds[0];
    cerca(a.Preq, 20.29);
    expect(a.gobierna).toBe('R1');
    expect(a.esRaiz).toBe(false);
    expect(a.seAlimentaDe).toBe('B');
    expect(a.alimenta.map((x) => x.nombre)).toEqual(['R2', 'R1']);
    cerca(a.alimenta[0].Q, 50.75);
    cerca(a.alimenta[0].P, 16.36);
    cerca(a.alimenta[0].Qb!, 56.51);
    cerca(a.alimenta[1].Qb!, 50.75);
    cerca(nds[1].Preq, 27.73);
    expect(nds[1].gobierna).toBe('T1 (A → B)');
    const c = nds[2];
    expect(c.esRaiz).toBe(true);
    cerca(c.Preq, 37.7, 0.5);
    cerca(c.Qtotal, 128.54);
    cerca(c.Pequilibrada, 37.7, 0.5);
    expect(c.seAlimentaDe).toBe('Montante');
    expect(c.gobierna).toBe('T2 (B → C)');
  });

  it('filasDetalleNudo: R2 primero (en orden de dibujo) con pasos q 16.34 → P 8.51 → 16.36', () => {
    const det = filasDetalleNudo(R.red!);
    expect(det.map((d) => d.nombre)).toEqual(['R2', 'R1', 'R3']);
    const r2 = det[0];
    expect(r2.rociadores).toBe('1–3');
    expect(r2.dn).toBe('1 1/4"');
    expect(r2.C).toBe(120);
    expect(r2.pasos).toHaveLength(3);
    const p0 = r2.pasos[0];
    cerca(p0.Pini!, 8.51);
    cerca(p0.q!, 16.34);
    cerca(p0.Q!, 16.34);
    cerca(p0.L!, 4.3);
    cerca(p0.Pfin!, 8.84);
    expect(p0.ni).toBe('1');
    expect(p0.nf).toBe('2');
    const p2 = r2.pasos[2];
    expect(p2.nf).toBe('A');
    cerca(p2.Pfin!, 16.36);
    cerca(p2.Q!, 50.75);
    expect(r2.pasos.every((p) => p.ok)).toBe(true);
    /* Cada ramal con res aparece una vez y con sus rociadores. */
    expect(det[2].rociadores).toBe('7');
  });
});

describe('rowsModelRci2 · gabinetes', () => {
  it('filasGabinete: 4 tramos, salidas de 250 gpm arriba y 500 gpm @ 127.36 psi en la brida', () => {
    const gab = filasGabinete(R.edif, R.gab);
    expect(gab).toHaveLength(4);
    expect(gab[0].desde).toBe('Gab P3');
    expect(gab[0].hasta).toBe('Gab P2');
    expect(gab[0].salida).toBe(true);
    cerca(gab[0].qSalida!, 250, 0.01);
    expect(gab[2].salida).toBe(false);
    expect(gab[3].desde).toBe('Base');
    expect(gab[3].hasta).toBe('CB');
    cerca(gab[3].Q!, 500, 0.01);
    cerca(gab[3].Pfin!, 127.36, 0.5);
    cerca(gab[3].Leq!, 34.53, 0.05);
    cerca(gab[3].Ltotal!, 37.53, 0.05);
    expect(gab[3].dnUsado).toBe('4"');
    /* Estado del HTML: OK / REGULAR → "Válv. reguladora". */
    expect(gab[0].estado).toBe('OK');
    expect(gab[1].estado).toBe('Válv. reguladora');
    expect(gab[0].acc).toBe('');
    expect(gab[3].acc).toBe('3 tee · 2 comp · 1 ret');
  });

  it('sin ruta de gabinetes (exigeSP No) devuelve []', () => {
    const est2 = ejemploVerificacion();
    est2.local.exigeSP = 'No';
    const tips2 = clasificar(est2);
    const R2 = compute(est2, tips2);
    expect(R2.gab).toBeNull();
    expect(filasGabinete(R2.edif, R2.gab)).toEqual([]);
  });
});

describe('rowsModelRci2 · cards de bomba y tanque (renderBomba)', () => {
  it('kvDemandas: D1 228.5 gpm y D2 500 gpm @ 128.16 psi netos', () => {
    const dem = kvDemandas(R.bomba);
    const m = new Map(dem.map((k) => [k.l, k]));
    expect(m.get('D1 · Rociadores + mangueras')!.v).toBe('228,5');
    expect(m.get('D1 · Rociadores + mangueras')!.nota).toContain('59,34');
    expect(m.get('D2 · Montantes (gabinetes)')!.v).toBe('500,0');
    expect(m.get('D2 · Montantes (gabinetes)')!.nota).toContain('128,16');
  });

  it('kvSeleccion: 500 gpm @ 141 psi, motor 75 HP y piso que gobierna P3 (T1)', () => {
    const sel = kvSeleccion(R.bomba, R.edif, st.bomba.qrManual, st.bomba.margen);
    const m = new Map(sel.map((k) => [k.l, k]));
    expect(m.get('Caudal nominal')!.v).toBe('500');
    expect(m.get('Caudal nominal')!.nota).toBe('Tamaño estándar NFPA 20');
    expect(m.get('Presión neta nominal')!.v).toBe('141');
    expect(m.get('Presión neta nominal')!.nota).toContain('10 %');
    expect(m.get('Motor comercial mínimo')!.v).toBe('75,0');
    expect(m.get('Piso que gobierna')!.v).toBe('P3 (T1)');
    expect(m.get('Succión / descarga mínimas')!.v).toBe('5" / 5"');
  });

  it('kvCuarto: la brida exige 59.34 psi (D1) y 127.36 psi (D2)', () => {
    const cb = kvCuarto(R.edif, R.gab);
    const m = new Map(cb.map((k) => [k.l, k]));
    expect(m.get('Presión exigida en la brida (CB) D1 / D2')!.v).toBe('59,3 / 127,4');
    expect(m.get('Caudal D1 / D2')!.v).toBe('128,5 / 500,0');
    /* El cuarto trae accesorios: Leq 34.53 m en D2. */
    expect(m.get('Ø usado · Leq D1 / D2')!.v).toContain('34,53');
  });

  it('kvSuccion / kvJockey / kvTanque: NPSH 7.2, jockey 170/160/155 y tanque 56.8 m³', () => {
    const suc = kvSuccion(R.bomba, st.bomba.npshr, st.bomba.margenNpsh);
    const m = new Map(suc.map((k) => [k.l, k]));
    cerca(parseFloat(m.get('NPSH disponible')!.v.replace(',', '.')), 7.2, 0.05);
    expect(m.get('NPSH disponible')!.nota).toContain('3,5');
    expect(m.get('Velocidad en succión al 150 %')!.nota).toBe('≤ 4,57 m/s');
    const jk = kvJockey(R.bomba);
    expect(jk.map((k) => k.v)).toEqual(['170', '160', '155']);
    const tq = kvTanque(R.bomba, R.tanque);
    expect(tq[2].v).toBe('56,8');
    expect(tq[2].nota).toContain('T1');
    expect(tq[1].nota).toBe('30 min');
    /* kvBombaTanque sigue viva como composición (no rompe consumidores). */
    expect(kvBombaTanque(R.bomba, R.tanque, 'P3').length).toBeGreaterThan(0);
  });
});

describe('rowsModelRci2 · rectángulo de fuego y sismo', () => {
  it('datosRectangulo: 11.94 × 8.29 m con 7 rociadores (3 + 3 + 1)', () => {
    const r = datosRectangulo(R.roc);
    cerca(r.Llargo, 11.94, 0.05);
    cerca(r.Acorto, 8.29, 0.05);
    cerca(r.Adis, 1066.24, 0.5);
    expect(r.Nreq).toBe(7);
    expect(r.Nramal).toBe(3);
    expect(r.Nramales).toBe(3);
    cerca(r.S, 4.3);
    cerca(r.L, 3.53);
  });

  it('inchOf: catálogo PIPES primero y parseo de strings de pulgadas después', () => {
    expect(inchOf('Acero SCH 10', '4"')).toBe(4);
    expect(inchOf('Acero SCH 40', '2 1/2"')).toBe(2.5);
    expect(inchOf('Material sin catálogo', '1 1/4"')).toBe(1.25);
    expect(inchOf('Material sin catálogo', '3/4"')).toBe(0.75);
    expect(inchOf('Acero SCH 40', 'auto')).toBeNull();
  });

  it('sismoConteo: montante 14.7 m, four = 1 (losaRestr Sí), acop = 6 y holgura de 100 mm desde 4"', () => {
    const k = sismoConteo(R.edif, st.pisos.rows, st.sp, st.local, st.redes)!;
    cerca(k.hM, 14.7, 0.05);
    expect(k.nPen).toBe(2);
    expect(k.losaR).toBe(true);
    expect(k.fourInt).toBe(0);
    expect(k.four).toBe(1);
    expect(k.acop).toBe(6);
    expect(k.nM).toBe(1);
    cerca(k.Lc, 3, 0.01);
    expect(k.latC).toBe(1);
    expect(k.tips).toHaveLength(1);
    const t1 = k.tips[0];
    expect(t1.id).toBe('T1');
    expect(t1.nF).toBe(3);
    expect(t1.pisos).toBe('P1, P2, P3');
    cerca(t1.Lm!, 8.59, 0.05);
    expect(t1.lat).toBe(1);
    expect(t1.lon).toBe(1);
    /* Ningún ramal llega a 2½": los 3 van con restricción. */
    expect(t1.ramG).toBe(0);
    expect(t1.restr).toBe(3);
    const h4 = k.holg[k.holg.length - 1];
    expect(h4.dn).toBe('4"');
    expect(h4.mm).toBe(100);
    expect(k.holg[0].mm).toBe(50);
  });

  it('rangoTipologia y caso losaRestr "No": fourInt pasa a 1 y four a 2', () => {
    expect(rangoTipologia(tips.groups[0], st.pisos.rows)).toBe('P1, P2, P3');
    const localNo = { ...st.local, losaRestr: 'No' };
    const k2 = sismoConteo(R.edif, st.pisos.rows, st.sp, localNo, st.redes)!;
    expect(k2.losaR).toBe(false);
    expect(k2.fourInt).toBe(1);
    expect(k2.four).toBe(2);
    expect(k2.acop).toBe(6);
  });
});

describe('rowsModelRci2 · strip de derivación', () => {
  it('stripDerivacion: 128.54 gpm @ 37.70 psi; null sin red o con avisos', () => {
    const s = stripDerivacion(R.red);
    cerca(s!.Q, 128.54);
    cerca(s!.P, 37.7, 0.5);
    expect(stripDerivacion(null)).toBeNull();
    const est2 = ejemploVerificacion();
    est2.redes.A.ramales = [];
    const R2 = compute(est2, clasificar(est2));
    expect(R2.red!.errs.length).toBeGreaterThan(0);
    expect(stripDerivacion(R2.red)).toBeNull();
  });
});

describe('rowsModelRci2 · mapa de navegación (RUTA_DE + SUBS_POR_TAB)', () => {
  it('entradas: sub por prefijo del path (local/clas/tub-mang/sp-mont/sia/tanque/pisos)', () => {
    expect(RUTA_DE(['entradas', 'local.reqSismo'])).toEqual({
      tab: 'entradas',
      sub: 'normativa',
      campo: 'local.reqSismo',
    });
    expect(RUTA_DE(['entradas', 'clas.riesgo']).sub).toBe('clasificacion');
    expect(RUTA_DE(['entradas', 'tub.Vmax']).sub).toBe('tuberia');
    expect(RUTA_DE(['entradas', 'mang.duracion']).sub).toBe('tuberia');
    expect(RUTA_DE(['entradas', 'sp.diam']).sub).toBe('montantes');
    expect(RUTA_DE(['entradas', 'mont.hD']).sub).toBe('montantes');
    expect(RUTA_DE(['entradas', 'sia.L']).sub).toBe('siamesa');
    expect(RUTA_DE(['entradas', 'tanque.vextra']).sub).toBe('tanque');
    expect(RUTA_DE(['entradas', 'pisos.zBomba']).sub).toBe('seleccion');
  });

  it('bomba: seleccion (margen/fchurn…), succion (zFondo/npshr…) y jockey (qjockey)', () => {
    expect(RUTA_DE(['entradas', 'bomba.margen']).sub).toBe('seleccion');
    expect(RUTA_DE(['entradas', 'bomba.qrManual']).sub).toBe('seleccion');
    expect(RUTA_DE(['entradas', 'bomba.fchurn']).sub).toBe('seleccion');
    expect(RUTA_DE(['entradas', 'bomba.zFondo']).sub).toBe('succion');
    expect(RUTA_DE(['entradas', 'bomba.hmin']).sub).toBe('succion');
    expect(RUTA_DE(['entradas', 'bomba.npshr']).sub).toBe('succion');
    expect(RUTA_DE(['entradas', 'bomba.qjockey'])).toEqual({
      tab: 'entradas',
      sub: 'jockey',
      campo: 'bomba.qjockey',
    });
  });

  it('las demás pestañas: rociadores/pisos/hidraulica/gabinetes/perfil/bomba/sismo/verificaciones', () => {
    expect(RUTA_DE(['rociadores', 'roc.S']).sub).toBe('datos');
    expect(RUTA_DE(['rociadores', 'clas.qr']).sub).toBe('datos');
    expect(RUTA_DE(['rociadores']).sub).toBe('criterios');
    expect(RUTA_DE(['pisos', 'piso:0:vrp'])).toEqual({
      tab: 'pisos',
      sub: 'pisos',
      campo: 'piso:0:vrp',
    });
    expect(RUTA_DE(['hidraulica'])).toEqual({ tab: 'hidraulica', sub: 'ramales' });
    expect(RUTA_DE(['hidraulica', '', 'tramos']).sub).toBe('tramos');
    expect(RUTA_DE(['gabinetes'])).toEqual({ tab: 'gabinetes', sub: 'ruta' });
    expect(RUTA_DE(['perfil'])).toEqual({ tab: 'perfil', sub: 'grafico' });
    expect(RUTA_DE(['bomba'])).toEqual({ tab: 'bomba', sub: 'demanda' });
    expect(RUTA_DE(['sismo'])).toEqual({ tab: 'sismo', sub: 'criterios' });
    expect(RUTA_DE([])).toEqual({ tab: 'verificaciones', sub: 'todas' });
  });

  it('los go reales del ejemplo caen todos en una sub-pestaña del mapa (sin huérfanas)', () => {
    const subs = new Set(Object.keys(SUBS_POR_TAB));
    const subIds = new Map(
      Object.entries(SUBS_POR_TAB).map(([t, ss]) => [t, new Set(ss.map((s) => s.id))]),
    );
    for (const v of R.checks) {
      const r = RUTA_DE(v.go || []);
      expect(subs.has(r.tab)).toBe(true);
      expect(subIds.get(r.tab)!.has(r.sub)).toBe(true);
    }
  });
});
