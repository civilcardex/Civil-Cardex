import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import path from 'node:path';
import { parseGLB } from '../RCIGlbParser.ts';
import { CHEQUE_GROUPS } from '../RCI3dData.ts';
import {
  glbIntercalado,
  leerBinario,
  medirGeometria,
  type AtributoGl,
} from '../../../../../test/glbFixture.ts';

// Regresión del visor 3D del cuarto de bombas: desde que los modelos se optimizaron con
// glTF-Transform (commit 1842b36e) posición y color comparten bloque, de 16 en 16 bytes. El
// parser leía bytes de color como coordenadas → NaN (Not a Number) que rompían el encuadre.

const MODELOS = path.resolve('public/models/rci');

// Triángulos de referencia por pieza, medidos con los archivos de ANTES de esa optimización.
// OJO con «bomba» y «bomba_jockey»: allí el modelo completo eran piezas sin nodo en el árbol, y
// la optimización las eliminó por inalcanzables (quedaron en 64 y 80 triángulos). Estos números
// avisan si vuelven a podarse.
const REFERENCIA: Array<[string, number]> = [
  ['banco_pruebas', 48435],
  ['bomba', 35186],
  ['bomba_jockey', 14151],
  ['descarga', 22570],
  ['mamposteria', 19008],
  ['recirculacion', 28486],
  ['siamesa', 67012],
  ['succion_jockey', 35863],
  ['succion_ppal', 5408],
  ['tablero_pared', 200],
  ['tablero_piso', 1838],
  ['tanque', 36],
  ['tapa_tanque', 12],
];

describe('parser GLB del cuarto de bombas', () => {
  it('reparte posición y color cuando van intercalados en el mismo bloque', async () => {
    const posicion: AtributoGl = {
      nombre: 'POSITION',
      tipo: 'VEC3',
      componentType: 5126,
      valores: [0, 0, 0, 0.5, -1, 0.25, 2, 3, 4, -0.5, 0.75, 6],
    };
    const color: AtributoGl = {
      nombre: 'COLOR_0',
      tipo: 'VEC4',
      componentType: 5121,
      valores: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 255],
    };
    const group = await parseGLB(THREE, glbIntercalado([posicion, color], [0, 1, 2, 3, 2, 1]));
    const geom = (group.children[0] as THREE.Mesh).geometry;
    expect(Array.from(geom.getAttribute('position').array)).toEqual(posicion.valores);
    // El color viaja 0–255 y el parser lo normaliza a 0–1 en float32: la expectativa también.
    const color01 = Array.from(new Float32Array(color.valores.map((v) => v / 255)));
    expect(Array.from(geom.getAttribute('color').array)).toEqual(color01);
    expect(geom.index?.count).toBe(6);
  });

  it.each(REFERENCIA)('%s: la pieza completa, sin vértices inválidos', async (pieza, tris) => {
    const esCheque = CHEQUE_GROUPS.includes(pieza);
    const group = await parseGLB(THREE, leerBinario(path.join(MODELOS, `${pieza}.glb`)), esCheque);
    const m = medirGeometria(group);
    expect(m.invalidos).toBe(0);
    expect(m.tris).toBe(tris);
  });

  it('la bomba principal mide un metro de largo, no es un cubito', async () => {
    const m = medirGeometria(await parseGLB(THREE, leerBinario(path.join(MODELOS, 'bomba.glb'))));
    m.max.forEach((v, i) => expect(v).toBeCloseTo([1.004, 0.722, 0.32][i], 2));
  });
});
