import { describe, it, expect } from 'vitest';
import {
  findFreeLabelCenter,
  beginDeclutterFrame,
  desTapadoConMemoria,
  type DeclutterBox,
} from '../labelDeclutter.ts';

const box = (id: string, cx: number, cy: number, w = 60, h = 20): DeclutterBox => ({
  id,
  minX: cx - w / 2,
  minY: cy - h / 2,
  maxX: cx + w / 2,
  maxY: cy + h / 2,
});

describe('findFreeLabelCenter', () => {
  it('sitio libre por defecto → null (no mover)', () => {
    const res = findFreeLabelCenter('A', 60, 20, 0, 0, 0, [], []);
    expect(res).toBeNull();
  });

  it('caja superpuesta → mueve a sitio libre sin colisión', () => {
    const placed = [box('B', 10, 0)];
    const res = findFreeLabelCenter('A', 60, 20, 0, 0, 0, placed, []);
    expect(res).not.toBeNull();
    // La nueva caja no debe chocar con B
    const nb = box('A', res!.x, res!.y);
    expect(
      nb.minX - 2 < placed[0].maxX &&
        nb.maxX + 2 > placed[0].minX &&
        nb.minY - 2 < placed[0].maxY &&
        nb.maxY + 2 > placed[0].minY,
    ).toBe(false);
    // Cerca del sitio original (radio de búsqueda acotado)
    expect(Math.hypot(res!.x, res!.y)).toBeLessThanOrEqual(6 * Math.max(60, 20) * 0.55 + 1);
  });

  it('ignora su propia caja (selfId) pero respeta las demás', () => {
    const placed = [box('A', 0, 0), box('B', 200, 200)];
    const res = findFreeLabelCenter('A', 60, 20, 0, 0, 0, placed, []);
    expect(res).toBeNull();
  });

  it('evita segmentos de otros ramales, ignora los propios', () => {
    const segs = [{ id: 'B', x1: -100, y1: 0, x2: 100, y2: 0 }];
    const res = findFreeLabelCenter('A', 60, 20, 0, 0, 0, [], segs);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.y)).toBeGreaterThan(10);
    // Segmento propio no bloquea
    const own = [{ id: 'A', x1: -100, y1: 0, x2: 100, y2: 0 }];
    expect(findFreeLabelCenter('A', 60, 20, 0, 0, 30, [], own)).toBeNull();
  });

  it('etiqueta manual intacta: su caja bloquea pero ella nunca se mueve (decisión del caller)', () => {
    // El caller solo llama para !labelMoved; aquí se verifica que una caja manual
    // existente sí cuenta como obstáculo para las auto.
    const placed = [box('MANUAL', 0, 0)];
    const res = findFreeLabelCenter('AUTO', 60, 20, 0, 0, 0, placed, []);
    expect(res).not.toBeNull();
  });
});

describe('desTapadoConMemoria', () => {
  it('reutiliza el sitio elegido aunque la cámara se mueva (el desplazamiento no depende del paneo)', () => {
    const memoria = desTapadoConMemoria('1.5|123');
    const a = memoria.busca('A', 60, 20, 0, 0, 0, [box('B', 10, 0)], []);
    expect(a).not.toBeNull();
    // Mismo dibujo con la cámara 40 px a la derecha y 30 abajo: TODO se corre igual.
    const b = memoria.busca('A', 60, 20, 0, 40, 30, [box('B', 50, 30)], []);
    expect(b!.x).toBeCloseTo(a!.x + 40, 6);
    expect(b!.y).toBeCloseTo(a!.y + 30, 6);
  });

  it('el zoom NO invalida la memoria: el sitio se escala desde el centro por defecto', () => {
    const memoria = desTapadoConMemoria('geometria-igual');
    const a = memoria.busca('A', 60, 20, 0, 0, 0, [box('B', 10, 0)], [], 1);
    expect(a).not.toBeNull();
    // Zoom 2: el centro por defecto, el obstáculo y la caja se van al doble; el sitio también.
    const b = memoria.busca('A', 120, 40, 0, 0, 0, [box('B', 20, 0, 120, 40)], [], 2);
    expect(b!.x).toBeCloseTo(a!.x * 2, 6);
    expect(b!.y).toBeCloseTo(a!.y * 2, 6);
  });

  it('una clave nueva (geometría distinta) vuelve a decidir', () => {
    const previa = desTapadoConMemoria('1|geometria-vieja');
    expect(previa.busca('A', 60, 20, 0, 0, 0, [], [])).toBeNull();
    const nueva = desTapadoConMemoria('1|geometria-nueva');
    expect(nueva.busca('A', 60, 20, 0, 0, 0, [box('B', 0, 0)], [])).not.toBeNull();
  });
});

describe('beginDeclutterFrame', () => {
  const engine = {
    _hiddenNets: new Set<string>(),
    toCvs: (x: number, y: number) => ({ x, y }),
    ramales: [
      {
        id: 'RS1',
        net: 'san',
        labelMoved: true,
        _labelBox: { minX: 0, minY: 0, maxX: 60, maxY: 20 },
        pts: [
          [0, 100],
          [50, 100],
        ],
      },
      {
        id: 'RS2',
        net: 'san',
        _labelBox: { minX: 200, minY: 200, maxX: 260, maxY: 220 },
        pts: [
          [0, 300],
          [50, 300],
        ],
      },
    ],
    bajantes: [],
    areas: [],
  } as unknown as Parameters<typeof beginDeclutterFrame>[0];

  it('solo cajas manuales como obstáculos + segmentos de todos', () => {
    const frame = beginDeclutterFrame(engine);
    // RS1 manual sí, RS2 auto no
    expect(frame.placed.map((p) => p.id)).toEqual(['RS1']);
    // 2 ramales × 1 segmento
    expect(frame.segs).toHaveLength(2);
  });
});
