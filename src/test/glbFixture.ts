import * as THREE from 'three';
import fs from 'node:fs';

// Soporte de tests para los parsers GLB (binary glTF: el formato de modelo 3D) propios de los
// visores 3D. Un GLB es un encabezado de 12 bytes seguido de bloques: primero el JSON con la
// estructura y después el bloque binario con los datos.

export type ComponenteGl = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;

export interface AtributoGl {
  /** Nombre glTF del atributo en la primitiva (POSITION, NORMAL, COLOR_0…). */
  nombre: string;
  tipo: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4';
  /** Tipo numérico glTF: 5121 = uint8 · 5123 = uint16 · 5125 = uint32 · 5126 = float32. */
  componentType: ComponenteGl;
  /** Valores aplanados (elementos × componentes). */
  valores: number[];
}

export interface MedicionGeometria {
  meshes: number;
  verts: number;
  tris: number;
  /** Vértices con coordenada NaN (Not a Number, valor no numérico) o infinita. */
  invalidos: number;
  min: number[];
  max: number[];
}

const BYTES: Record<ComponenteGl, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const COMPONENTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as const;
const multiploDe4 = (n: number): number => (n + 3) & ~3;

/** Lee un archivo binario como ArrayBuffer propio (no una vista del caché de lectura de Node).
 *  Ej: leerBinario('public/models/epc/mamposteria.glb') → el contenido exacto del archivo. */
export function leerBinario(ruta: string): ArrayBuffer {
  const b = fs.readFileSync(ruta);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/** Arma en memoria un GLB mínimo con UNA primitiva cuyos atributos van INTERCALADOS en el
 *  mismo bloque (byteStride), que es como los deja glTF-Transform. Sirve para probar que un
 *  parser reparta cada atributo en su sitio en vez de leerlos como bytes seguidos.
 *  Ej: glbIntercalado([posicion, normal], [0, 1, 2]) → posición y normal comparten bloque. */
export function glbIntercalado(atributos: AtributoGl[], indices: number[]): ArrayBuffer {
  const count = atributos[0].valores.length / COMPONENTES[atributos[0].tipo];
  const stride = atributos.reduce((s, a) => s + COMPONENTES[a.tipo] * BYTES[a.componentType], 0);
  const inter = new Uint8Array(count * stride);
  const dv = new DataView(inter.buffer);
  let byteOffset = 0;
  const accessors = atributos.map((a) => {
    const n = COMPONENTES[a.tipo];
    const b = BYTES[a.componentType];
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < n; c++) {
        const o = i * stride + byteOffset + c * b;
        const v = a.valores[i * n + c];
        if (a.componentType === 5126) dv.setFloat32(o, v, true);
        else if (a.componentType === 5125) dv.setUint32(o, v, true);
        else if (a.componentType === 5123) dv.setUint16(o, v, true);
        else dv.setUint8(o, v);
      }
    }
    const acc = { bufferView: 0, byteOffset, componentType: a.componentType, count, type: a.tipo };
    byteOffset += n * b;
    return acc;
  });

  // Índices (uint16) en su propio bloque compacto.
  const idxLen = multiploDe4(indices.length * 2);
  const bin = new Uint8Array(inter.length + idxLen);
  bin.set(inter);
  const idxDv = new DataView(bin.buffer);
  indices.forEach((v, i) => idxDv.setUint16(inter.length + i * 2, v, true));

  const names: Record<string, number> = {};
  atributos.forEach((a, i) => {
    names[a.nombre] = i;
  });
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: names, indices: accessors.length }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: inter.length, byteStride: stride },
      { buffer: 0, byteOffset: inter.length, byteLength: idxLen },
    ],
    accessors: [
      ...accessors,
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = multiploDe4(jsonBytes.length);
  const total = 12 + 8 + jsonLen + 8 + bin.length;
  const out = new Uint8Array(total);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, 0x46546c67, true); // «glTF»
  odv.setUint32(4, 2, true);
  odv.setUint32(8, total, true);
  let o = 12;
  odv.setUint32(o, jsonLen, true);
  odv.setUint32(o + 4, 0x4e4f534a, true); // bloque JSON
  out.set(jsonBytes, o + 8);
  out.fill(0x20, o + 8 + jsonBytes.length, o + 8 + jsonLen); // relleno: espacios
  o += 8 + jsonLen;
  odv.setUint32(o, bin.length, true);
  odv.setUint32(o + 4, 0x004e4942, true); // bloque BIN
  out.set(bin, o + 8);
  return out.buffer;
}

/** Cuenta la geometría real de un objeto 3D en coordenadas de mundo: mallas, vértices,
 *  triángulos, cuántos vértices son inválidos y la caja que ocupa.
 *  Ej: medirGeometria(group) → { tris: 100287, invalidos: 0, min: […], max: […] }. */
export function medirGeometria(obj: THREE.Object3D): MedicionGeometria {
  let meshes = 0;
  let verts = 0;
  let tris = 0;
  let invalidos = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.index;
    verts += pos.count;
    tris += (idx ? idx.count : pos.count) / 3;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
        invalidos++;
        continue;
      }
      min[0] = Math.min(min[0], v.x);
      min[1] = Math.min(min[1], v.y);
      min[2] = Math.min(min[2], v.z);
      max[0] = Math.max(max[0], v.x);
      max[1] = Math.max(max[1], v.y);
      max[2] = Math.max(max[2], v.z);
    }
  });
  return { meshes, verts, tris: Math.round(tris), invalidos, min, max };
}
