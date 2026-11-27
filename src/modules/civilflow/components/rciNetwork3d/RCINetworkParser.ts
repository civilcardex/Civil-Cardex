import type { Three } from '../rci3d/useRCI3DScene.ts';
import { leerChunksGlb, leerAccesorGlb } from '../shared/glbBinReader.ts';

// Parser GLB del HTML Isometrico_RCI_Open_Code_v19 (port fiel, §431+): los GLB de la RED
// traen jerarquía de nodos con transforms de AutoCAD — a diferencia de los del cuarto de
// bombas, NO se pueden fusionar por primitivo ignorando nodes. Port incluye: materiales
// baseColorFactor con heurística lum/sat (getMaterial/_buildMaterial), sanitizador de
// índices fuera de rango, jerarquía de nodos (matrix/translation/rotation/scale) y
// cast/receive shadows.

type MatCache = Map<string, unknown>;

let matCache: MatCache | null = null;

function asegurarCache(): MatCache {
  if (!matCache) matCache = new Map();
  return matCache;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMaterial(THREE: Three, r?: number, g?: number, b?: number): any {
  if (r === undefined || Number.isNaN(r)) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.75, 0.75, 0.76),
      metalness: 0.65,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
  }
  const gg = g ?? 0;
  const bb = b ?? 0;
  const lum = 0.299 * r + 0.587 * gg + 0.114 * bb;
  const max = Math.max(r, gg, bb);
  const min = Math.min(r, gg, bb);
  const sat = max > 0 ? (max - min) / max : 0;
  if (lum > 0.72) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, gg, bb),
      metalness: 0.25,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
  }
  if (lum > 0.25 && sat < 0.08) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, gg, bb),
      metalness: 0.6,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
  }
  if (lum < 0.25) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, gg, bb),
      metalness: 0.7,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, gg, bb),
    metalness: 0.45,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMaterial(THREE: Three, r?: number, g?: number, b?: number): any {
  const cache = asegurarCache();
  const key =
    r === undefined || Number.isNaN(r)
      ? 'def'
      : `${r.toFixed(4)},${(g ?? 0).toFixed(4)},${(b ?? 0).toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mat = buildMaterial(THREE, r, g, b);
  cache.set(key, mat);
  return mat;
}

export interface GLBParseResult {
  group: InstanceType<Three['Group']>;
}

/** Decodifica el GLB (JSON+BIN chunks) y reconstruye jerarquía + meshes con materiales. */
export function parseGLBRed(THREE: Three, buffer: ArrayBuffer): GLBParseResult {
  const { json, bin: binChunk } = leerChunksGlb(buffer);
  if (!json || !binChunk) return { group: new THREE.Group() };

  // readAcc delega en el lector COMPARTIDO (glbBinReader): chunk-walk + accessors con
  // byteStride eran ~45 líneas idénticas en los 3 parsers (EP, cuarto, red RCI).
  const readAcc = (idx: number): Float32Array | Uint32Array | Uint16Array | Uint8Array =>
    leerAccesorGlb(json, idx, binChunk);

  const gltfMats = json.materials || [];
  const builtMats = gltfMats.map((m) => {
    const col = (m.pbrMetallicRoughness || {}).baseColorFactor;
    return col ? getMaterial(THREE, col[0], col[1], col[2]) : getMaterial(THREE, 0.75, 0.75, 0.76);
  });

  const meshObjects = (json.meshes || []).map((mesh) => {
    const grp = new THREE.Group();
    for (const prim of mesh.primitives) {
      const geom = new THREE.BufferGeometry();
      if (prim.attributes.POSITION != null) {
        const d = readAcc(prim.attributes.POSITION);
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d), 3));
      }
      if (prim.attributes.NORMAL != null) {
        const d = readAcc(prim.attributes.NORMAL);
        geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(d), 3));
      }
      if (prim.indices != null) {
        const raw = readAcc(prim.indices);
        // Sanitizador: GLBs con índices fuera de rango (export corruptos) — clamp al máximo
        // de vértices; evita boundingSphere incoherente y frustum-culling errático.
        const posAttr = geom.getAttribute('position');
        if (posAttr) {
          const posCount = posAttr.count;
          for (let i = 0; i < raw.length; i++) {
            if (raw[i] >= posCount) raw[i] = posCount - 1;
          }
        }
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(raw), 1));
      }
      geom.computeVertexNormals();
      const mat =
        prim.material != null && builtMats[prim.material]
          ? builtMats[prim.material]
          : getMaterial(THREE, 0.78, 0.78, 0.79);
      const m3 = new THREE.Mesh(geom, mat);
      m3.castShadow = true;
      m3.receiveShadow = true;
      grp.add(m3);
    }
    return grp;
  });

  // Jerarquía de nodos (posición/rotación/escala de AutoCAD) — EXACTA al HTML §510-537:
  // el PADRE agrega a sus hijos (invertir la dirección anida las transformadas al revés y
  // paredes/losas aterrizan desplazadas) y el mesh se CLONA al nodo (el HTML clona §525;
  // mover la instancia rompe nodos que comparten mesh).
  const nodes = json.nodes || [];
  const nodeObjs = nodes.map((n) => {
    const obj = new THREE.Group();
    if (n.name) obj.name = n.name;
    if (n.matrix) {
      const m4 = new THREE.Matrix4().fromArray(n.matrix);
      m4.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (n.translation) obj.position.fromArray(n.translation);
      if (n.rotation) obj.quaternion.fromArray(n.rotation);
      if (n.scale) obj.scale.fromArray(n.scale);
    }
    if (n.mesh != null) {
      for (const child of meshObjects[n.mesh].children) obj.add(child.clone());
    }
    return obj;
  });
  nodes.forEach((n, i) => {
    for (const c of n.children || []) nodeObjs[i].add(nodeObjs[c]);
  });
  // Raíces = los nodos listados en la escena (HTML §533-536): add() reparenta si el export
  // lista como raíz un nodo que además cuelga de otro, mismo comportamiento que el HTML.
  const group = new THREE.Group();
  const sceneNodes = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  for (const ri of sceneNodes) group.add(nodeObjs[ri]);

  return { group };
}
