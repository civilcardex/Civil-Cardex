import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import path from 'node:path';
import { parseGLB } from '../glbParser.ts';
import {
  glbIntercalado,
  leerBinario,
  medirGeometria,
  type AtributoGl,
} from '../../../../../test/glbFixture.ts';

// Regresión del visor 3D del Equipo de Presión Constante: desde que los modelos se optimizaron
// con glTF-Transform (commit 1842b36e) posición y normal comparten bloque, de 24 en 24 bytes. El
// parser los leía como bytes seguidos y el equipo se veía hecho triángulos hacia el origen.

const MODELOS = path.resolve('public/models/epc');

// Geometría de referencia, medida con los archivos de ANTES de esa optimización: vértices,
// triángulos y la caja que ocupa el ensamble (m). Optimizar no debe cambiar lo que se dibuja.
const REFERENCIA: Array<[string, number, number, number[], number[]]> = [
  ['epc_esquema.glb', 227948, 100287, [0, 0, -2.065], [3.696, 3.617, 0]],
  ['mamposteria.glb', 38016, 19008, [0, 0, -2.465], [5.042, 2.995, 0]],
  ['tapa_tanque.glb', 24, 12, [0, 0, -2.463], [5.04, 0.005, 0]],
];

describe('parser GLB del visor EP', () => {
  it('reparte posición y normal cuando van intercaladas en el mismo bloque', async () => {
    const posicion: AtributoGl = {
      nombre: 'POSITION',
      tipo: 'VEC3',
      componentType: 5126,
      valores: [0, 0, 0, 1.5, -2, 0.25, 3, 4, 5, -0.5, 0.125, 7],
    };
    const normal: AtributoGl = {
      nombre: 'NORMAL',
      tipo: 'VEC3',
      componentType: 5126,
      valores: [0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, -1],
    };
    const group = await parseGLB(THREE, glbIntercalado([posicion, normal], [0, 1, 2, 3, 2, 1]));
    const geom = (group.children[0] as THREE.Mesh).geometry;
    expect(Array.from(geom.getAttribute('position').array)).toEqual(posicion.valores);
    expect(Array.from(geom.getAttribute('normal').array)).toEqual(normal.valores);
    expect(geom.index?.count).toBe(6);
  });

  it.each(REFERENCIA)(
    '%s: dibuja lo mismo que antes de optimizarse, sin vértices inválidos',
    async (archivo, verts, tris, min, max) => {
      const m = medirGeometria(await parseGLB(THREE, leerBinario(path.join(MODELOS, archivo))));
      expect(m.invalidos).toBe(0);
      expect(m.verts).toBe(verts);
      expect(m.tris).toBe(tris);
      m.min.forEach((v, i) => expect(v).toBeCloseTo(min[i], 2));
      m.max.forEach((v, i) => expect(v).toBeCloseTo(max[i], 2));
    },
  );
});
