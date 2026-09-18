import type * as THREE_NS from 'three';
import type { Three } from './useRci3DScene';

// Parser GLB del HTML original (port): los GLB del cuarto de bombas solo traen
// POSITION/NORMAL/COLOR_0 (uint8 VEC4) + índices, sin materiales usables — GLTFLoader daría
// un aspecto distinto. fetch(url) → arrayBuffer → parse.
// RENDIMIENTO: el original creaba 1 mesh por PRIMITIVO (cientos de draw calls por pieza).
// Aquí los primitivos se FUNDEN en ≤3 meshes por pieza según material: con COLOR_0 (vertex
// colors), sin COLOR_0 (gris) y — solo en grupos cheque — los primitivos de vértices
// blanco/gris claro que el original recoloreaba a rojo (mismo criterio: primer vértice).

/** Decodifica el GLB (JSON chunk + BIN chunk) y devuelve un Group con la geometría fundida. */
export async function parseGLB(
  THREE: Three,
  buffer: ArrayBuffer,
  esCheque = false,
): Promise<InstanceType<Three['Group']>> {
  const dv = new DataView(buffer);
  let offset = 12;
  let jsonChunk: {
    meshes: Array<{
      primitives: Array<{
        attributes: Record<string, number | undefined>;
        indices?: number;
      }>;
    }>;
    accessors: Array<{
      bufferView: number;
      byteOffset?: number;
      count: number;
      type: string;
      componentType: number;
    }>;
    bufferViews: Array<{ byteOffset?: number }>;
  } | null = null;
  let binChunk: ArrayBuffer | null = null;
  const totalLen = dv.getUint32(8, true);
  while (offset < totalLen) {
    const clen = dv.getUint32(offset, true);
    const ctype = dv.getUint32(offset + 4, true);
    const cdata = buffer.slice(offset + 8, offset + 8 + clen);
    if (ctype === 0x4e4f534a) jsonChunk = JSON.parse(new TextDecoder().decode(cdata));
    if (ctype === 0x004e4942) binChunk = cdata;
    offset += 8 + clen;
  }
  const group = new THREE.Group();
  if (!jsonChunk || !binChunk) return group;

  const accessors = jsonChunk.accessors || [];
  const bufferViews = jsonChunk.bufferViews || [];

  function compSize(ct: number): number {
    return ct === 5126 ? 4 : ct === 5125 ? 4 : ct === 5123 ? 2 : 1;
  }

  function readAcc(idx: number): Uint8Array | Uint16Array | Uint32Array | Float32Array {
    const acc = accessors[idx];
    const bv = bufferViews[acc.bufferView];
    const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] || 1) as number;
    const tot = acc.count * n;
    const sl = binChunk!.slice(off, off + tot * compSize(acc.componentType));
    if (acc.componentType === 5126) return new Float32Array(sl);
    if (acc.componentType === 5125) return new Uint32Array(sl);
    if (acc.componentType === 5123) return new Uint16Array(sl);
    return new Uint8Array(sl);
  }

  const colorGeoms: THREE_NS.BufferGeometry[] = [];
  const plainGeoms: THREE_NS.BufferGeometry[] = [];
  const redGeoms: THREE_NS.BufferGeometry[] = [];

  for (const mesh of jsonChunk.meshes) {
    for (const prim of mesh.primitives) {
      const geom = new THREE.BufferGeometry();

      if (prim.attributes.POSITION != null) {
        const d = readAcc(prim.attributes.POSITION) as Float32Array;
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d), 3));
      }
      if (prim.attributes.NORMAL != null) {
        const d = readAcc(prim.attributes.NORMAL) as Float32Array;
        geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(d), 3));
      }
      let blanco = false;
      if (prim.attributes.COLOR_0 != null) {
        const raw = readAcc(prim.attributes.COLOR_0); // uint8 VEC4
        const f32 = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) f32[i] = raw[i] / 255.0;
        geom.setAttribute('color', new THREE.BufferAttribute(f32, 4));
        // Mismo criterio del recolor del original: primer vértice blanco/gris muy claro.
        blanco = esCheque && f32[0] > 0.8 && f32[1] > 0.8 && f32[2] > 0.8;
      }
      if (prim.indices != null) {
        const d = readAcc(prim.indices);
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(d), 1));
      }
      geom.computeVertexNormals();

      if (blanco) redGeoms.push(geom);
      else if (prim.attributes.COLOR_0 != null) colorGeoms.push(geom);
      else plainGeoms.push(geom);
    }
  }

  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

  const agregar = (geoms: THREE_NS.BufferGeometry[], mat: THREE_NS.MeshStandardMaterial): void => {
    if (geoms.length === 0) return;
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) return;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };

  agregar(
    colorGeoms,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.7,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  agregar(
    plainGeoms,
    new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.7,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  agregar(
    redGeoms,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(1, 0, 0),
      metalness: 0.25,
      roughness: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  return group;
}
