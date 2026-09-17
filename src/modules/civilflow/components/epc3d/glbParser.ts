import type * as THREE_NS from 'three';

// Port del parser GLB propio del HTML original ("EPC CIVILCARDEX SEP 16 2026 VF").
// Ponytail: NO se usa GLTFLoader — el HTML asigna materiales PBR por heurística de color
// (getMaterial, colores AutoCAD) y GLTFLoader estándar daría otro acabado visual.
// Rendimiento: los AutoCAD GLB traen miles de meshes sueltas → se hornean los transforms
// de nodos y se fusionan las primitivas POR MATERIAL (≈1 draw call por material en vez de
// miles por frame).

/** Material PBR según luminosidad/saturación del color original (port fiel de getMaterial). */
export function getMaterial(
  THREE: typeof THREE_NS,
  r: number,
  g: number,
  b: number,
): THREE_NS.MeshStandardMaterial {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;

  // Sin color base (material 2 de AutoCAD) → gris metálico
  if (r === undefined || Number.isNaN(r)) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.75, 0.75, 0.76),
      metalness: 0.65,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
  }
  // Rojo puro → tuberías/válvulas rojas: brillo alto
  if (r > 0.9 && g < 0.1 && b < 0.1) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.15,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
  }
  // Rojo suave → elementos secundarios rojos
  if (r > 0.8 && g < 0.45 && b < 0.45) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.1,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
  }
  // Verde puro → elementos eléctricos/control
  if (g > 0.9 && r < 0.1 && b < 0.1) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.2,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
  }
  // Azul puro u oscuro
  if (b > 0.8 && r < 0.2 && g < 0.2) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.5,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
  }
  // Azul medio
  if (b > 0.5 && r < 0.1 && g < 0.5) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.6,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
  }
  // Cyan
  if (g > 0.85 && b > 0.85 && r < 0.1) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.4,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
  }
  // Amarillo/dorado
  if (r > 0.85 && g > 0.7 && b < 0.55) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.3,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
  }
  // Naranja
  if (r > 0.85 && g > 0.3 && g < 0.75 && b < 0.2) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.2,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
  }
  // Marrón/bronce
  if (r > 0.35 && g > 0.2 && g < 0.45 && b < 0.3 && r > g && r > b) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.65,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
  }
  // Blanco / gris muy claro
  if (lum > 0.72) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.25,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
  }
  // Gris medio
  if (lum > 0.25 && sat < 0.08) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.6,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
  }
  // Oscuro genérico
  if (lum < 0.25) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: 0.7,
      roughness: 0.28,
      side: THREE.DoubleSide,
    });
  }
  // Fallback — color original con parámetros neutros
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b),
    metalness: 0.45,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
}

interface GltfJson {
  accessors?: Array<{
    bufferView: number;
    type: string;
    count: number;
    componentType: number;
    byteOffset?: number;
  }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
  meshes?: Array<{
    primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number }>;
  }>;
  nodes?: Array<{
    name?: string;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    mesh?: number;
    children?: number[];
  }>;
  scenes?: Array<{ nodes?: number[] }>;
  scene?: number;
}

/** Convierte un GLB en un Group con UN mesh por material (primitivas fusionadas, transforms horneados). */
export async function parseGLB(
  THREE: typeof THREE_NS,
  buffer: ArrayBuffer,
): Promise<THREE_NS.Group> {
  const dv = new DataView(buffer);
  let offset = 12;
  let jsonChunk: GltfJson | null = null;
  let binChunk: ArrayBuffer | null = null;
  const totalLen = dv.getUint32(8, true);
  while (offset < totalLen) {
    const clen = dv.getUint32(offset, true);
    const ctype = dv.getUint32(offset + 4, true);
    const cdata = buffer.slice(offset + 8, offset + 8 + clen);
    if (ctype === 0x4e4f534a) jsonChunk = JSON.parse(new TextDecoder().decode(cdata)) as GltfJson;
    if (ctype === 0x004e4942) binChunk = cdata;
    offset += 8 + clen;
  }
  const json = jsonChunk ?? {};
  if (!binChunk) throw new Error('GLB sin chunk binario');

  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];

  function readAcc(idx: number): Float32Array | Uint32Array | Uint16Array | Uint8Array {
    const acc = accessors[idx];
    const bv = bufferViews[acc.bufferView];
    const off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] ?? 1;
    const tot = acc.count * n;
    const sl = binChunk!.slice(
      off,
      off +
        tot *
          (acc.componentType === 5126 || acc.componentType === 5125
            ? 4
            : acc.componentType === 5123
              ? 2
              : 1),
    );
    if (acc.componentType === 5126) return new Float32Array(sl);
    if (acc.componentType === 5125) return new Uint32Array(sl);
    if (acc.componentType === 5123) return new Uint16Array(sl);
    return new Uint8Array(sl);
  }

  // Geometría de una primitiva: solo position/normal/index (lo que fusiona igual para todas)
  function buildGeom(prim: {
    attributes: Record<string, number>;
    indices?: number;
  }): THREE_NS.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const pos = readAcc(prim.attributes.POSITION);
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    if (prim.attributes.NORMAL != null) {
      const nor = readAcc(prim.attributes.NORMAL);
      geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    }
    if (prim.indices != null) {
      const raw = readAcc(prim.indices);
      geom.setIndex(
        new THREE.BufferAttribute(raw instanceof Uint16Array ? raw : new Uint32Array(raw), 1),
      );
    } else {
      // primitiva no indexada → índice secuencial para poder fusionar
      geom.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i));
    }
    if (!geom.getAttribute('normal')) geom.computeVertexNormals();
    return geom;
  }

  const gltfMats = json.materials ?? [];
  const builtMats = gltfMats.map((m) => {
    const col = m.pbrMetallicRoughness?.baseColorFactor;
    return col ? getMaterial(THREE, col[0], col[1], col[2]) : getMaterial(THREE, 0.75, 0.75, 0.76);
  });

  // Horneado de transforms: matriz mundo por nodo (recursión desde las raíces de la escena)
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const worldOf = new Map<number, THREE_NS.Matrix4>();
  const identity = new THREE.Matrix4();
  const computeWorld = (i: number, parent: THREE_NS.Matrix4): void => {
    const n = nodes[i];
    const local = new THREE.Matrix4();
    if (n.matrix) {
      local.fromArray(n.matrix);
    } else {
      local.compose(
        new THREE.Vector3(...(n.translation ?? [0, 0, 0])),
        new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
        new THREE.Vector3(...(n.scale ?? [1, 1, 1])),
      );
    }
    const world = new THREE.Matrix4().multiplyMatrices(parent, local);
    worldOf.set(i, world);
    (n.children ?? []).forEach((ci) => computeWorld(ci, world));
  };
  const roots = ((json.scenes ?? [])[json.scene ?? 0] ?? {}).nodes ?? [];
  roots.forEach((ri) => computeWorld(ri, identity));

  // Acumular primitivas por índice de material
  const porMaterial = new Map<number, THREE_NS.BufferGeometry[]>();
  nodes.forEach((n, i) => {
    if (n.mesh == null) return;
    const world = worldOf.get(i) ?? identity;
    for (const prim of meshes[n.mesh]?.primitives ?? []) {
      const geom = buildGeom(prim);
      geom.applyMatrix4(world);
      const key = prim.material ?? -1;
      const bucket = porMaterial.get(key);
      if (bucket) bucket.push(geom);
      else porMaterial.set(key, [geom]);
    }
  });

  // Fusionar: un Mesh por material → draw calls mínimos
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const group = new THREE.Group();
  for (const [matIdx, geoms] of porMaterial) {
    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    if (!merged) continue;
    const mat =
      matIdx >= 0 && builtMats[matIdx] ? builtMats[matIdx] : getMaterial(THREE, 0.78, 0.78, 0.79);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
