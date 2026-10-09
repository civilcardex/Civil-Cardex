import { describe, expect, it } from 'vitest';
import { NORMA_URLS, normaUrl } from '../standardsLinks';

// Resolución de URLs normativas (ped. usuario: links muertos revisados 2026-10-09).
describe('normaUrl', () => {
  it('claves exactas: NTC → búsqueda ICONTEC, NFPA → ficha del producto', () => {
    expect(normaUrl('NTC 1500')).toBe(NORMA_URLS['NTC 1500']);
    expect(normaUrl('NFPA 20')).toBe('https://www.nfpa.org/product/nfpa-20-standard/p0020code');
  });

  it('tolera sufijos de edición (NTC 1500:2020, NFPA 20:2025)', () => {
    expect(normaUrl('NTC 1500:2020')).toBe(NORMA_URLS['NTC 1500']);
    expect(normaUrl('NFPA 20:2025')).toBe(NORMA_URLS['NFPA 20']);
  });

  it('cualquier NTC fuera de la tabla cae a la búsqueda exacta de ICONTEC', () => {
    expect(normaUrl('NTC 5555')).toBe('https://tienda.icontec.org/?s=NTC%205555&post_type=product');
  });

  it('familias: UL/FM/ISO/IEC/ASTM/NCh/NB resuelven a su fuente oficial', () => {
    expect(normaUrl('UL 199')).toBe(NORMA_URLS.UL);
    expect(normaUrl('FM 1112')).toBe(NORMA_URLS.FM);
    expect(normaUrl('ISO 9906:2012')).toBe(NORMA_URLS.ISO);
    expect(normaUrl('IEC 61800-5-1:2022')).toBe(NORMA_URLS.IEC);
    expect(normaUrl('ASTM A53')).toBe(NORMA_URLS.ASTM);
    expect(normaUrl('NCh 2485')).toBe(NORMA_URLS.NCh);
    expect(normaUrl('NB 689')).toBe(NORMA_URLS.NB);
  });

  it('normas por país: RNE/OGUC/ENRE/NEC apuntan a la fuente oficial', () => {
    expect(normaUrl('RNE IS.010')).toContain('gob.pe');
    expect(normaUrl('RNE A.130')).toContain('gob.pe');
    expect(normaUrl('OGUC 4.1.5')).toContain('bcn.cl');
    // El dominio gob.ar del ENRE sirve un certificado TLS inválido — debe usar gov.ar.
    expect(normaUrl('ENRE 1055/13')).toBe('https://www.enre.gov.ar');
    expect(normaUrl('NEC Cap.16')).toContain('mit.gob.ec');
  });

  it('RETIE/Decreto 0926 → página del reglamento en MinEnergía (no la homepage)', () => {
    expect(normaUrl('RETIE')).toContain(
      'reglamento-t%C3%A9cnico-de-instalaciones-el%C3%A9ctricas-retie',
    );
    expect(normaUrl('Decreto 0926/2010')).toBe(normaUrl('RETIE'));
  });

  it('norma desconocida → undefined (texto plano, sin link roto)', () => {
    expect(normaUrl('XXX 123')).toBeUndefined();
    expect(normaUrl('RENISDA')).toBeUndefined();
  });
});
