import { useEffect, useRef } from 'react';
import type { Rci3DApi, Rci3DApiRef } from '../rci3d/useRci3DScene';
import { parseGLBRed } from './rciRedParser';
import { GLB_POSITIONS, INITIAL_SCALES, ISO_DEFAULT, SPLIT_BUILDS } from './rciRedData';
import { devError } from '../../../../utils/devError';
import { cargarModelosSecuencial, sleep } from '../shared/sequentialLoad';
import { cargarGlbBuffer, glbEnCache } from '../shared/glbCache';

// Carga del ensamble RED (port del loadModel del HTML): 5 piezas base + 10 abrazaderas
// SPLIT (argolla + varilla con bakeY/rot/wrapperScale calibrados). Mampostería translúcida
// 0.35, entrepiso/cubierta 0.20. Encuadre = ISO_DEFAULT calibrado (pose absoluta del HTML).
// Oclusores de etiquetas: regla del HTML buildOccluders (opaco + lado mayor ≥ 0.3·MR).

interface Opciones {
  onProgreso: (pct: number, texto: string) => void;
  onListo: () => void;
  onFallo: (mensaje: string) => void;
}

const ESPERAS_MAX = 100;
const BASE_KEYS = ['mamposteria', 'piso1_bombas', 'red_completa', 'entrepiso', 'cubierta'];
const SPLIT_KEYS = Object.keys(SPLIT_BUILDS);

export function useRciRedCarga(
  apiRef: Rci3DApiRef,
  { onProgreso, onListo, onFallo }: Opciones,
): void {
  const optsRef = useRef({ onProgreso, onListo, onFallo });
  useEffect(() => {
    optsRef.current = { onProgreso, onListo, onFallo };
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let api = apiRef.current;
      for (let i = 0; i < ESPERAS_MAX && !api; i++) {
        await sleep(150);
        if (cancelled) return;
        api = apiRef.current;
      }
      if (!api) {
        optsRef.current.onFallo('No se pudo iniciar el visor 3D.');
        return;
      }
      const escena = api;
      const THREE = escena.THREE;

      let paso = 0;
      const totalPasos = BASE_KEYS.length + SPLIT_KEYS.length;

      const cargarBase = async (name: string): Promise<boolean> => {
        try {
          const buf = await cargarGlbBuffer(`/models/rci-red/${name}.glb`);
          const { group } = parseGLBRed(THREE, buf);
          if (cancelled) return true;
          const pos = GLB_POSITIONS[name];
          group.position.set(pos[0], pos[1], pos[2]);
          const sc = INITIAL_SCALES[name];
          if (sc) group.scale.set(sc[0], sc[1], sc[2]);
          // Mampostería translúcida (HTML: opacity 0.35 — no ocluye etiquetas).
          if (name === 'mamposteria') {
            const matMamp = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0.76, 0.7, 0.6),
              metalness: 0.05,
              roughness: 0.85,
              transparent: true,
              opacity: 0.35,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            group.traverse((m) => {
              if ((m as InstanceType<typeof THREE.Mesh>).isMesh)
                (m as InstanceType<typeof THREE.Mesh>).material = matMamp;
            });
          }
          // Entrepiso/cubierta: losa translúcida 0.20 (el GLB pierde el alpha de AutoCAD).
          if (name === 'entrepiso' || name === 'cubierta') {
            group.traverse((m) => {
              const mesh = m as InstanceType<typeof THREE.Mesh>;
              if (!mesh.isMesh) return;
              const col = (mesh.material as { color?: { r: number; g: number; b: number } })?.color;
              mesh.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(col?.r ?? 0.7, col?.g ?? 0.7, col?.b ?? 0.7),
                metalness: 0.05,
                roughness: 0.85,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
            });
          }
          escena.assembly.add(group);
          escena.piezas.set(name, group);
          fusionarPieza(escena, name);
          return true;
        } catch (e) {
          devError('[rci-red] GLB base', name, e);
          return false;
        }
      };

      const cargarSplit = async (name: string): Promise<boolean> => {
        try {
          const build = SPLIT_BUILDS[name];
          const buf = await cargarGlbBuffer('/models/rci-red/abrazadera_4p.glb');
          const src = parseGLBRed(THREE, buf);
          src.group.updateMatrixWorld(true);
          // Clasificar por dimensiones locales: ancho > 0.5 = argolla; delgado = varilla.
          const argList: InstanceType<typeof THREE.Mesh>[] = [];
          const rodList: InstanceType<typeof THREE.Mesh>[] = [];
          src.group.traverse((obj) => {
            const m = obj as InstanceType<typeof THREE.Mesh>;
            if (!m.isMesh || !m.geometry.getAttribute('position')) return;
            m.updateWorldMatrix(true, false);
            const bb = new THREE.Box3().setFromObject(m);
            const sz = bb.getSize(new THREE.Vector3());
            (Math.max(sz.x, sz.z) > 0.5 ? argList : rodList).push(m);
          });
          const wrapper = new THREE.Group();
          for (const p of build.parts) {
            const sub = new THREE.Group();
            const list = p.sub === 'argolla' ? argList : rodList;
            for (const m of list) {
              // Bake de matrices de mundo (relativas a src — identidad).
              m.updateWorldMatrix(true, false);
              const w = m.matrixWorld.clone();
              if (m.parent) m.parent.remove(m);
              m.matrix.copy(w);
              m.matrix.decompose(m.position, m.quaternion, m.scale);
              m.updateMatrix();
              if (p.bakeY) m.position.y -= p.bakeY; // origen de la varilla = su base
              if (p.sub === 'varilla') {
                // Varillas en negro carbón (visibilidad sobre la escena).
                m.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0x111111),
                  emissive: new THREE.Color(0x555555),
                  metalness: 0.35,
                  roughness: 0.5,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                });
              }
              sub.add(m);
            }
            sub.scale.set(p.scale[0], p.scale[1], p.scale[2]);
            sub.position.set(p.off[0], p.off[1], p.off[2]);
            wrapper.add(sub);
            escena.piezas.set(`${name}_${p.sub}`, sub);
          }
          wrapper.position.set(build.mount[0], build.mount[1], build.mount[2]);
          const D2R = Math.PI / 180;
          if (build.rot)
            wrapper.rotation.set(build.rot[0] * D2R, build.rot[1] * D2R, build.rot[2] * D2R);
          if (build.wrapperScale)
            wrapper.scale.set(build.wrapperScale[0], build.wrapperScale[1], build.wrapperScale[2]);
          escena.assembly.add(wrapper);
          escena.piezas.set(name, wrapper);
          fusionarPieza(escena, name);
          return true;
        } catch (e) {
          devError('[rci-red] GLB split', name, e);
          return false;
        }
      };

      const cargarPaso = async (): Promise<boolean> => {
        if (paso < BASE_KEYS.length) return cargarBase(BASE_KEYS[paso]);
        return cargarSplit(SPLIT_KEYS[paso - BASE_KEYS.length]);
      };

      // Re-entrada con los GLB ya en caché: sin las pausas de pacing (decorativas).
      const urlDe = (k: string) => `/models/rci-red/${k}.glb`;
      const todoEnCache =
        BASE_KEYS.every((k) => glbEnCache(urlDe(k))) && glbEnCache(urlDe('abrazadera_4p'));
      const fallas = await cargarModelosSecuencial(
        Array.from({ length: totalPasos }, (_, i) => String(i)),
        (pct, texto) => optsRef.current.onProgreso(pct, texto),
        async () => {
          const ok = await cargarPaso();
          paso++;
          optsRef.current.onProgreso(20 + Math.round((paso / totalPasos) * 75), '');
          return ok;
        },
        () => cancelled,
        todoEnCache ? 0 : 150,
      );
      if (cancelled) return;
      if (fallas >= totalPasos) {
        optsRef.current.onFallo('No se pudieron cargar los modelos 3D.');
        return;
      }
      try {
        finalizarCarga(escena);
      } catch (e) {
        devError('[rci-red] encuadre', e);
        optsRef.current.onFallo('El modelo 3D cargó vacío (recursos no disponibles).');
        return;
      }
      optsRef.current.onProgreso(100, '');
      optsRef.current.onListo();
    })();
    return () => {
      cancelled = true;
    };
    // La carga corre una sola vez por montaje del visor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// mergeModel del HTML (port): fusiona los meshes de la pieza en buckets material+occ+celda
// (rejilla 4×4×4). Arregla RENDIMIENTO (3525 draw calls → decenas) y el ORDEN de las
// transparencias: los buckets opacos se pintan primero, las paredes translúcidas al final.
function fusionarPieza(api: Rci3DApi, name: string): void {
  const THREE = api.THREE;
  const grp = api.piezas.get(name);
  if (!grp) return;
  grp.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
  const gBox = new THREE.Box3().setFromObject(grp);
  const gSz = gBox.getSize(new THREE.Vector3());
  const CELLS = 4;
  const meshes: InstanceType<typeof THREE.Mesh>[] = [];
  grp.traverse((m) => {
    const mesh = m as InstanceType<typeof THREE.Mesh>;
    if (mesh.isMesh && mesh.visible && mesh.geometry.getAttribute('position')) meshes.push(mesh);
  });
  const buckets = new Map<
    string,
    { mat: unknown; occ: boolean; list: InstanceType<typeof THREE.Mesh>[] }
  >();
  const bb = new THREE.Box3();
  const sz = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const m of meshes) {
    bb.setFromObject(m);
    bb.getSize(sz);
    bb.getCenter(c);
    const mat = m.material as { transparent?: boolean };
    const mr = api.mr || 1;
    const occ = !mat?.transparent && Math.max(sz.x, sz.y, sz.z) >= 0.3 * mr;
    const cell = [0, 1, 2]
      .map((k) => {
        const lo = gBox.min.getComponent(k);
        const span = gSz.getComponent(k) || 1;
        return Math.min(
          CELLS - 1,
          Math.max(0, Math.floor(((c.getComponent(k) - lo) / span) * CELLS)),
        );
      })
      .join('.');
    const key = `${m.material instanceof Object ? (m.material as unknown as { uuid?: string }).uuid : ''}|${occ ? 'o' : 'n'}|${cell}`;
    if (!buckets.has(key)) buckets.set(key, { mat: m.material, occ, list: [] });
    buckets.get(key)!.list.push(m);
  }
  const mtx = new THREE.Matrix4();
  const nmx = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const merged: InstanceType<typeof THREE.Mesh>[] = [];
  for (const b of buckets.values()) {
    let nv = 0;
    let ni = 0;
    for (const m of b.list) {
      const g = m.geometry;
      const n = g.getAttribute('position').count;
      nv += n;
      ni += g.index ? g.index.count : n;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const idx = new Uint32Array(ni);
    let vo = 0;
    let io = 0;
    for (const m of b.list) {
      mtx.multiplyMatrices(inv, m.matrixWorld);
      nmx.getNormalMatrix(mtx);
      const flip = mtx.determinant() < 0;
      const g = m.geometry;
      const P = g.getAttribute('position');
      const N = g.getAttribute('normal');
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mtx);
        pos[(vo + i) * 3] = v.x;
        pos[(vo + i) * 3 + 1] = v.y;
        pos[(vo + i) * 3 + 2] = v.z;
        if (N) {
          v.fromBufferAttribute(N, i).applyMatrix3(nmx).normalize();
          nor[(vo + i) * 3] = v.x;
          nor[(vo + i) * 3 + 1] = v.y;
          nor[(vo + i) * 3 + 2] = v.z;
        }
      }
      const I = g.index ? g.index.array : null;
      const cnt = I ? I.length : P.count;
      for (let k = 0; k + 2 < cnt; k += 3) {
        const a = I ? I[k] : k;
        const b1 = I ? I[k + 1] : k + 1;
        const c1 = I ? I[k + 2] : k + 2;
        idx[io++] = vo + a;
        idx[io++] = vo + (flip ? c1 : b1);
        idx[io++] = vo + (flip ? b1 : c1);
      }
      vo += P.count;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geom.setIndex(new THREE.BufferAttribute(io === ni ? idx : idx.slice(0, io), 1));
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    const mm = new THREE.Mesh(geom, b.mat as never);
    mm.castShadow = true;
    mm.receiveShadow = true;
    (mm as unknown as { userData: { occ: boolean } }).userData.occ = b.occ;
    merged.push(mm);
  }
  const geoms = new Set<InstanceType<typeof THREE.BufferGeometry>>();
  for (const m of meshes) {
    geoms.add(m.geometry);
    if (m.parent) m.parent.remove(m);
  }
  geoms.forEach((g) => g.dispose());
  for (const mm of merged) grp.add(mm);
}

/** Encadre final: escala global + luces + pose ISO_DEFAULT calibrada del HTML. */
function finalizarCarga(api: Rci3DApi): void {
  const THREE = api.THREE;

  // Orden fijo entre translúcidos (HTML finishLoading §905-907, tras la fusión): paredes
  // detrás y losas al final — sin esto se alternan/solapan al girar la cámara.
  const renderOrderDe: Array<[string, number]> = [
    ['mamposteria', 1],
    ['entrepiso', 2],
    ['cubierta', 2],
  ];
  for (const [name, orden] of renderOrderDe) {
    const pieza = api.piezas.get(name);
    if (!pieza) continue;
    pieza.traverse((o) => {
      const mesh = o as InstanceType<typeof THREE.Mesh>;
      if (mesh.isMesh) mesh.renderOrder = orden;
    });
  }

  const box = new THREE.Box3().setFromObject(api.assembly);
  box.getCenter(api.mc);
  box.getSize(api.bbox);
  api.mr = box.getBoundingSphere(new THREE.Sphere()).radius;
  if (!isFinite(api.mr) || api.mr <= 0) throw new Error('ensamble_vacio');

  api.keyLight.position.set(
    api.mc.x + api.mr * 1.5,
    api.mc.y + api.mr * 3,
    api.mc.z + api.mr * 1.5,
  );
  const sc = api.keyLight.shadow.camera;
  sc.left = -api.mr * 2;
  sc.bottom = -api.mr * 2;
  sc.right = api.mr * 2;
  sc.top = api.mr * 2;
  sc.far = api.mr * 20;
  sc.updateProjectionMatrix();
  api.fillLight.position.set(api.mc.x - api.mr * 1.5, api.mc.y + api.mr, api.mc.z - api.mr * 1.5);

  // Pose ISO calibrada del HTML (ISO_DEFAULT absoluto).
  api.camP.position.set(ISO_DEFAULT.pos[0], ISO_DEFAULT.pos[1], ISO_DEFAULT.pos[2]);
  api.controls.target.set(ISO_DEFAULT.tgt[0], ISO_DEFAULT.tgt[1], ISO_DEFAULT.tgt[2]);
  // Sin lookAt/update la cámara conservaba la orientación vieja — primera vista torcida.
  api.camP.lookAt(ISO_DEFAULT.tgt[0], ISO_DEFAULT.tgt[1], ISO_DEFAULT.tgt[2]);
  api.controls.update();
  api.camP.near = api.mr * 0.001;
  api.camP.far = api.mr * 200;
  api.camP.updateProjectionMatrix();
  api.defPos = new THREE.Vector3(ISO_DEFAULT.pos[0], ISO_DEFAULT.pos[1], ISO_DEFAULT.pos[2]);
  api.defTgt = new THREE.Vector3(ISO_DEFAULT.tgt[0], ISO_DEFAULT.tgt[1], ISO_DEFAULT.tgt[2]);

  // Oclusores: mallas marcadas occ=true por la fusión (regla buildOccluders del HTML).
  api.occluders = [];
  api.assembly.traverse((obj) => {
    const mesh = obj as unknown as { isMesh?: boolean; userData?: { occ?: boolean } };
    if (mesh.isMesh && mesh.userData?.occ === true) api.occluders.push(obj as never);
  });

  api.marcarSombras?.();
}
