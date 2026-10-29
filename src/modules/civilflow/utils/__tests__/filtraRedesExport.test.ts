import { describe, it, expect } from 'vitest';
import { filtraRedesParaExport } from '../exportPlanos.ts';

// "Redes a descargar": el filtro de la exportación de planos es a nivel de DATOS — el
// trazo de una red excluida deja de EXISTIR en el motor headless, así que ninguna capa
// (ramales, bajantes, fantasmas, áreas) lo puede pintar aunque su renderer no consulte
// _hiddenNets (el fallo reportado: el PDF imprimía todas las redes igual).

describe('filtraRedesParaExport', () => {
  const mkEng = () => ({
    ramales: [{ net: 'san' }, { net: 'll' }, { net: 'af' }],
    bajantes: [{ net: 'san' }, { net: 'll' }],
    crossFloorGhosts: [{ net: 'san' }, { net: 'll' }],
    areas: [{ net: 'san' }, { net: 'll' }, {}],
    _hiddenNets: new Set<string>(),
  });

  it('elimina SOLO los elementos de las redes excluidas, en todas las colecciones', () => {
    const eng = mkEng();
    filtraRedesParaExport(eng, new Set(['san']));
    expect(eng.ramales.map((r) => r.net)).toEqual(['ll', 'af']);
    expect(eng.bajantes.map((b) => b.net)).toEqual(['ll']);
    expect(eng.crossFloorGhosts.map((g) => g.net)).toEqual(['ll']);
    // Área SIN net (área de guía genérica) se conserva.
    expect(eng.areas).toHaveLength(2);
    expect(eng._hiddenNets.has('san')).toBe(true);
  });

  it('set vacío/ausente: no toca nada (todas las redes se exportan)', () => {
    const eng = mkEng();
    filtraRedesParaExport(eng, undefined);
    expect(eng.ramales).toHaveLength(3);
    filtraRedesParaExport(eng, new Set());
    expect(eng.bajantes).toHaveLength(2);
  });
});
