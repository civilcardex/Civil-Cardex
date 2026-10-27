import { describe, it, expect } from 'vitest';
import {
  NORMAS_PAIS,
  PAISES_ELIMINADOS,
  perfilDe,
  rangoAfTxt,
  rangoSanTxt,
  ftTxt,
  gasTxt,
} from '../countryStandards';
import { normaUrl, NormaTxt, NormaLink } from '../../components/shared/standardsLinks.tsx';
import React from 'react';

// Matriz normativa por país: cada perfil trae valores, etiquetas de referencia y fuente.
// Si un valor cambia sin actualizar su fuente, estos tests lo delatan.

describe('normasPais: matriz completa y honesta', () => {
  it('quedan 6 perfiles: CO + PE, EC, CL, BO, AR (los clones puros se eliminaron)', () => {
    expect(NORMAS_PAIS.map((p) => p.id).sort()).toEqual(['AR', 'BO', 'CL', 'CO', 'EC', 'PE']);
  });

  it('los 12 clones puros están ausentes (sin norma verificable: ni valores ni artículos)', () => {
    for (const id of PAISES_ELIMINADOS) {
      expect(
        NORMAS_PAIS.some((p) => p.id === id),
        id,
      ).toBe(false);
      // …y caen en Colombia por el fallback, sin migrar nada guardado.
      expect(perfilDe(id).id).toBe('CO');
    }
    expect(PAISES_ELIMINADOS).toHaveLength(12);
  });

  it('todo perfil trae fuente por red y etiquetas de referencia EP', () => {
    for (const p of NORMAS_PAIS) {
      for (const red of ['af', 'san', 'll', 'gas', 'rci'] as const) {
        expect(p.fuente[red].length, `${p.id}.${red}`).toBeGreaterThan(0);
      }
      expect(p.refPmin.length, `${p.id}.refPmin`).toBeGreaterThan(0);
      expect(p.refPmax.length, `${p.id}.refPmax`).toBeGreaterThan(0);
    }
  });

  it('rangos físicamente sanos (mín < máx, positivos)', () => {
    for (const p of NORMAS_PAIS) {
      expect(p.af.vMin, `${p.id}.af.vMin`).toBeGreaterThan(0);
      expect(p.af.vMax, `${p.id}.af.vMax`).toBeGreaterThan(p.af.vMin);
      expect(p.af.pMax, `${p.id}.af.pMax`).toBeGreaterThan(p.af.pMinRed);
      expect(p.af.pMax, `${p.id}.af.pMax`).toBeGreaterThan(p.af.pMinAparato);
      expect(p.san.vMax, `${p.id}.san.vMax`).toBeGreaterThan(p.san.vMin);
      expect(p.gas.dpMax, `${p.id}.gas.dpMax`).toBeGreaterThan(0);
    }
  });

  it('CO conserva los valores históricos (cero cambios de conducta)', () => {
    const co = perfilDe('Colombia');
    expect(co.af).toEqual({ vMin: 0.5, vMax: 2.5, pMinRed: 5, pMinAparato: 3, pMax: 50 });
    expect(co.san).toEqual({ vMin: 0.45, vMax: 4.0, ydMax: 0.75, ftMin: 0.15 });
  });

  it('PE separa red de aparato (IS.010 §2.3: 10 red OS.050 / 2 aparato)', () => {
    const pe = perfilDe('PE');
    expect(pe.af.pMinRed).toBe(10);
    expect(pe.af.pMinAparato).toBe(2);
    expect(pe.af.vMin).toBe(0.6);
    expect(pe.norma.gas).toContain('EM.040');
    expect(pe.ref).toBe(true);
  });

  it('EC usa sus valores NEC-11 (v 0,6–2,5, p nudo ≤50, umbral 15)', () => {
    const ec = perfilDe('EC');
    expect(ec.af.vMax).toBe(2.5);
    expect(ec.af.pMax).toBe(50);
    expect(ec.af.pMinRed).toBe(15);
    expect(ec.norma.gas).toContain('INEN 2295');
    expect(ec.ref).toBe(true);
  });

  it('AR usa Guía ERAS (Ve 1–3, no ENRE) y NAG-200 con Renouard (dpMax 0,98)', () => {
    const ar = perfilDe('AR');
    expect(ar.af.vMin).toBe(1.0);
    expect(ar.af.vMax).toBe(3.0);
    expect(ar.norma.af).toContain('ERAS');
    expect(ar.norma.af).not.toContain('ENRE');
    expect(ar.gas.dpMax).toBeCloseTo(0.98, 2);
    expect(ar.norma.gas).toContain('NAG-200');
    expect(ar.ref).toBe(true);
  });

  it('BO usa NB 689 (v máx 2,0 en redes; bandas 5/10/13)', () => {
    const bo = perfilDe('BO');
    expect(bo.af.vMax).toBe(2.0);
    expect(bo.af.pMinRed).toBe(10);
    expect(bo.refPmin).toContain('NB 689');
    expect(bo.ref).toBe(true);
  });

  it('CL separa red de aparato y cita DS 66/2007 en gas (no NCh 4)', () => {
    const cl = perfilDe('Chile');
    expect(cl.af.pMinRed).toBe(15);
    expect(cl.af.pMinAparato).toBe(14);
    expect(cl.norma.gas).toContain('DS 66/2007');
    expect(cl.norma.gas).not.toContain('NCh 4');
    expect(cl.ref).toBe(true);
  });

  it('México eliminado: sin perfil propio cae en CO (vuelve cuando tenga matriz)', () => {
    expect(perfilDe('MX').id).toBe('CO');
    expect(perfilDe('México').id).toBe('CO');
  });
});

describe('normasPais: perfilDe y helpers', () => {
  it('vacío o desconocido cae en Colombia', () => {
    expect(perfilDe(undefined).id).toBe('CO');
    expect(perfilDe('').id).toBe('CO');
    expect(perfilDe('XX').id).toBe('CO');
  });

  it('acepta id o nombre en cualquier caja', () => {
    expect(perfilDe('cl').id).toBe('CL');
    expect(perfilDe('Perú').id).toBe('PE');
    expect(perfilDe('mexico').id).toBe('CO'); // eliminado → fallback Colombia
  });

  it('helpers CO sin marca ref, resto con marca ref', () => {
    expect(rangoAfTxt('CO')).toBe('0,50–2,50 m/s (NTC 1500 / RAS 2000)');
    expect(rangoAfTxt('PE')).toContain('(ref. RNE IS.010');
    expect(rangoSanTxt('CL')).toContain('OGUC 4.4');
    expect(ftTxt('EC')).toContain('(ref. NEC (cap. desagüe pendiente)');
    expect(gasTxt('CO')).toBe('V ≤ 10 m/s · ΔP acumulada ≤ 9,81 mbar (NTC 3728)');
    expect(gasTxt('CL')).toContain('DS 66/2007');
  });
});

describe('standardsLinks: claves nuevas del plan de países', () => {
  it('resuelven a su fuente oficial', () => {
    expect(normaUrl('DS 66/2007')).toBe('https://www.bcn.cl/leychile/navegar?idNorma=263058');
    expect(normaUrl('RIDAA')).toBe('https://www.siss.gob.cl');
    expect(normaUrl('NCh 2485')).toBe('https://www.inn.cl');
    expect(normaUrl('CONAGUA')).toBe('https://www.gob.mx/conagua');
    expect(normaUrl('NAG-200')).toBe('https://www.enargas.gob.ar');
    expect(normaUrl('SEC')).toBe('https://www.sec.cl');
    expect(normaUrl('NOM')).toBe('https://www.dof.gob.mx');
    expect(normaUrl('RENISDA')).toBe('https://www.ibnorca.org');
  });

  it('NormaTxt linkifica DS 66/2007, RIDAA y CONAGUA dentro de un texto', () => {
    const el = NormaTxt({ texto: 'Según DS 66/2007 y RIDAA con datos CONAGUA' }) as unknown as {
      props: { children: React.ReactNode };
    };
    const kids = React.Children.toArray(el.props.children);
    const links = kids.filter(
      (c) => React.isValidElement(c) && (c as React.ReactElement).type === NormaLink,
    );
    expect(links.length).toBe(3);
  });
});
