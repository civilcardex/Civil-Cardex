/**
 * Lector GLB (contenedor binario de glTF) COMPARTIDO por los 3 parsers de visores 3D (EP,
 * RCI cuarto de bombas, red RCI): caminata de chunks + decodificador de accessors con
 * manejo de byteStride. El ARMADO de escena (materiales, fusión, jerarquía) vive en cada
 * parser — solo la lectura de bytes se comparte. Ej: leerChunksGlb(buffer).bin.
 */

/** JSON del chunk glTF con TODOS los campos que los tres parsers consumen (todos
 *  opcionales: cada visor usa los suyos). */
export interface GltfJson {
  meshes?: Array<{
    primitives: Array<{
      attributes: Record<string, number | undefined>;
      indices?: number;
      material?: number;
    }>;
  }>;
  accessors?: Array<{
    bufferView: number;
    byteOffset?: number;
    count: number;
    type: string;
    componentType: number;
  }>;
  /** byteStride: bytes entre elementos cuando el bloque trae varios atributos intercalados. */
  bufferViews?: Array<{ byteOffset?: number; byteStride?: number }>;
  materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
  nodes?: Array<{
    name?: string;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    children?: number[];
    mesh?: number;
  }>;
  scenes?: Array<{ nodes?: number[] }>;
  scene?: number;
}

export interface GlbChunks {
  json: GltfJson | null;
  bin: ArrayBuffer | null;
}

/** Parte el GLB en su JSON y su chunk binario (los magic/versión de los 12 bytes previos
 *  no se validan: los tres generadores escriben GLB estándar). */
export function leerChunksGlb(buffer: ArrayBuffer): GlbChunks {
  const dv = new DataView(buffer);
  let offset = 12;
  let json: GltfJson | null = null;
  let bin: ArrayBuffer | null = null;
  const totalLen = dv.getUint32(8, true);
  while (offset < totalLen) {
    const clen = dv.getUint32(offset, true);
    const ctype = dv.getUint32(offset + 4, true);
    const cdata = buffer.slice(offset + 8, offset + 8 + clen);
    if (ctype === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(cdata)) as GltfJson;
    if (ctype === 0x004e4942) bin = cdata;
    offset += 8 + clen;
  }
  return { json, bin };
}

/** Bytes por componente glTF (5126 float, 5125 uint32, 5123 uint16, resto 1 byte). */
export const compSizeGlb = (ct: number): number =>
  ct === 5126 ? 4 : ct === 5125 ? 4 : ct === 5123 ? 2 : 1;

export type AccesorDatos = Float32Array | Uint32Array | Uint16Array | Uint8Array;

/** Lee el accessor `idx` del JSON+BIN: respeta el byteStride del bufferView — desde que los
 *  modelos se optimizaron con glTF-Transform, posición/normal/color comparten bloque
 *  intercalado y leerlos seguidos mezcla atributos (geometría rota / NaN). Compacto (sin
 *  paso, o paso = tamaño del elemento) → bytes seguidos; intercalado → copia elemento a
 *  elemento. Ej: POSITION con paso 24 toma 12 bytes cada 24. */
export function leerAccesorGlb(json: GltfJson, idx: number, bin: ArrayBuffer): AccesorDatos {
  const acc = (json.accessors ?? [])[idx];
  const bv = (json.bufferViews ?? [])[acc.bufferView];
  const off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] ?? 1;
  const tot = acc.count * n;
  const size = compSizeGlb(acc.componentType);
  const de = (sl: ArrayBufferLike): AccesorDatos =>
    acc.componentType === 5126
      ? new Float32Array(sl)
      : acc.componentType === 5125
        ? new Uint32Array(sl)
        : acc.componentType === 5123
          ? new Uint16Array(sl)
          : new Uint8Array(sl);
  const stride = bv.byteStride;
  if (stride == null || stride === n * size) return de(bin.slice(off, off + tot * size));
  const out = de(new ArrayBuffer(tot * size));
  const dst = new Uint8Array(out.buffer, out.byteOffset, tot * size);
  for (let i = 0; i < acc.count; i++)
    dst.set(new Uint8Array(bin, off + i * stride, n * size), i * n * size);
  return out;
}
