import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import path from 'node:path';
import { parseGLBRed } from '../RCINetworkParser.ts';
import {
  glbIntercalado,
  leerBinario,
  medirGeometria,
  type AtributoGl,
} from '../../../../../test/glbFixture.ts';

// El parser de la red contra incendio comparte lectura con los otros visores 3D. Sus modelos
// van compactos hoy, pero si se vuelven a optimizar con glTF-Transform quedarán intercalados,
// como pasó con el cuarto de bombas (commit 1842b36e): la lectura debe seguir siendo correcta.

const MODELOS = path.resolve('public/models/rci-red');

// Triángulos por modelo, contados en los archivos antes y después de aquella optimización
// (no cambió): la referencia de lo que el visor debe dibujar.
const REFERENCIA: Array<[string, number]> = [
  ['abrazadera_4p', 496],
  ['colgante', 15706],
  ['cubierta', 20],
  ['entrepiso', 40],
  ['mamposteria', 19008],
  ['piso1_bombas', 5322],
  ['red_completa', 434874],
  ['rociador', 11008],
  ['soporte_4vias', 11904],
  ['soporte_long', 12252],
  ['soporte_transv', 10549],
];

describe('parser GLB de la red contra incendio', () => {
  it('reparte posición y normal cuando van intercaladas en el mismo bloque', () => {
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
    const { group } = parseGLBRed(THREE, glbIntercalado([posicion, normal], [0, 1, 2, 3, 2, 1]));
    const geom = (group.children[0].children[0] as THREE.Mesh).geometry;
    expect(Array.from(geom.getAttribute('position').array)).toEqual(posicion.valores);
    expect(geom.index?.count).toBe(6);
  });

  it.each(REFERENCIA)(
    '%s: dibuja lo mismo que antes de optimizarse, sin vértices inválidos',
    (modelo, tris) => {
      const { group } = parseGLBRed(THREE, leerBinario(path.join(MODELOS, `${modelo}.glb`)));
      const m = medirGeometria(group);
      expect(m.invalidos).toBe(0);
      expect(m.tris).toBe(tris);
    },
  );
});
