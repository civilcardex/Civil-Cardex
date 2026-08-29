import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { EPData } from './EPShared';
import { dec } from '../../utils/parseDecimal';

interface Props {
  ep: EPData;
  updEP?: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

const LEGEND: Array<{ num: number; name: string; desc: string }> = [
  {
    num: 1,
    name: 'Colador de succión',
    desc: 'Rejilla en la cisterna que impide el paso de sólidos a la succión.',
  },
  {
    num: 2,
    name: 'Válvulas de aislamiento',
    desc: 'Permiten aislar cada bomba y la salida para mantenimiento.',
  },
  {
    num: 3,
    name: 'Bombas de impulsión',
    desc: 'Bombas centrífugas verticales multietapa (trabajo + reserva).',
  },
  {
    num: 4,
    name: 'Válvulas de retención',
    desc: 'Impiden el flujo inverso en la impulsión de cada bomba.',
  },
  { num: 5, name: 'Manómetro', desc: 'Medición de presión en el manifold de impulsión.' },
  { num: 6, name: 'Transmisor de presión', desc: 'Señal 4-20 mA al PLC para control de presión.' },
  { num: 7, name: 'PLC', desc: 'Controlador lógico programable: automatización y protecciones.' },
  {
    num: 8,
    name: 'Tanque hidroneumático',
    desc: 'Mantiene presión entre ciclos y reduce arranques.',
  },
];

export default function EPSchemePage({ ep, updEP }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const badgeWrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);

  const nt = Math.max(1, dec(ep.nt) || 1);
  const nr = Math.max(0, dec(ep.nr) || 0);
  const ntot = Math.min(4, Math.max(2, nt + nr));
  const numPumps = ntot; // 3 => 2T+1R, 4 => 3T+1R

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const THREE = await import('three');
      if (cancelled) return;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0xf1f1f4);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

      // lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const hemi = new THREE.HemisphereLight(0xffffff, 0xbfc4cc, 0.5);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(6, 10, 8);
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      dir.shadow.camera.left = -10;
      dir.shadow.camera.right = 10;
      dir.shadow.camera.top = 10;
      dir.shadow.camera.bottom = -6;
      scene.add(dir);

      // ground (soft shadow catcher)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 40),
        new THREE.ShadowMaterial({ opacity: 0.12 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      scene.add(ground);

      // ---- materials ----
      const M = {
        steel: new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.9, roughness: 0.28 }),
        steelDark: new THREE.MeshStandardMaterial({
          color: 0x8f959b,
          metalness: 0.85,
          roughness: 0.4,
        }),
        blue: new THREE.MeshStandardMaterial({ color: 0x1668b0, metalness: 0.35, roughness: 0.4 }),
        blueDark: new THREE.MeshStandardMaterial({
          color: 0x0e4f8c,
          metalness: 0.4,
          roughness: 0.45,
        }),
        water: new THREE.MeshStandardMaterial({
          color: 0x1e7fc0,
          metalness: 0.1,
          roughness: 0.15,
          transparent: true,
          opacity: 0.9,
        }),
        gray: new THREE.MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.3, roughness: 0.55 }),
        grayDark: new THREE.MeshStandardMaterial({
          color: 0x6f747a,
          metalness: 0.4,
          roughness: 0.5,
        }),
        red: new THREE.MeshStandardMaterial({ color: 0xd22, metalness: 0.3, roughness: 0.4 }),
        beacon: new THREE.MeshStandardMaterial({
          color: 0xf33,
          emissive: 0xd00,
          emissiveIntensity: 0.8,
          roughness: 0.3,
        }),
        white: new THREE.MeshStandardMaterial({ color: 0xf5f6f7, roughness: 0.4 }),
        concrete: new THREE.MeshStandardMaterial({
          color: 0xa8a8a4,
          metalness: 0.02,
          roughness: 0.95,
        }),
        wall: new THREE.MeshStandardMaterial({ color: 0xe9e9e6, metalness: 0.02, roughness: 0.9 }),
        glass: new THREE.MeshStandardMaterial({
          color: 0xdfe8ee,
          metalness: 0.1,
          roughness: 0.12,
          emissive: 0x9fb4c0,
          emissiveIntensity: 0.25,
        }),
        green: new THREE.MeshStandardMaterial({ color: 0x1a9a4a, roughness: 0.4 }),
        orange: new THREE.MeshStandardMaterial({ color: 0xd07020, roughness: 0.4 }),
        yellow: new THREE.MeshStandardMaterial({ color: 0xd0a020, roughness: 0.4 }),
        black: new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.5 }),
      };

      const group = new THREE.Group();
      scene.add(group);
      const meshes: THREE.Mesh[] = [];
      const add = (
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        x: number,
        y: number,
        z: number,
        comp: number,
        rx = 0,
        ry = 0,
        rz = 0,
      ) => {
        const cm = mat.clone() as THREE.MeshStandardMaterial;
        const m = new THREE.Mesh(geo, cm);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        m.receiveShadow = true;
        const ud = m.userData as { comp?: number; em0?: number; ei0?: number };
        ud.comp = comp;
        ud.em0 = cm.emissive.getHex();
        ud.ei0 = cm.emissiveIntensity;
        group.add(m);
        meshes.push(m);
        return m;
      };
      const pipe = (
        x1: number,
        y1: number,
        z1: number,
        x2: number,
        y2: number,
        z2: number,
        r: number,
        comp: number,
        mat = M.steel,
      ) => {
        const d = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
        const len = d.length();
        if (len < 0.001) return;
        const m = add(
          new THREE.CylinderGeometry(r, r, len, 20),
          mat,
          (x1 + x2) / 2,
          (y1 + y2) / 2,
          (z1 + z2) / 2,
          comp,
        );
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        return m;
      };
      // Codo de 90° real: arco de toro tangente a dos tramos perpendiculares (d1,d2 = direcciones
      // unitarias de los tubos que salen de la esquina). Mucho más limpio que una esfera.
      const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const bend = (
        x: number,
        y: number,
        z: number,
        d1x: number,
        d1y: number,
        d2x: number,
        d2y: number,
        bendR: number,
        tubeR: number,
        comp: number,
        mat = M.steel,
      ) => {
        const cx = x + d1x * bendR + d2x * bendR;
        const cy = y + d1y * bendR + d2y * bendR;
        const a0 = Math.atan2(-d2y, -d2x);
        const a1 = Math.atan2(-d1y, -d1x);
        const rot = Math.abs(norm(a1 - (a0 + Math.PI / 2))) < 1e-4 ? a0 : a1;
        const m = add(
          new THREE.TorusGeometry(bendR, tubeR, 14, 32, Math.PI / 2),
          mat,
          cx,
          cy,
          z,
          comp,
        );
        m.rotation.z = rot;
        // Collares (bridas) en los extremos del codo para que se lea como accesorio codo 90
        const collarR = tubeR * 1.6;
        const cLen = tubeR * 1.6;
        // extremo 1: tangente en d1
        cyl(
          collarR,
          collarR,
          cLen,
          M.steelDark,
          x + d1x * bendR + d1x * 0,
          y + d1y * bendR,
          z,
          comp,
          0,
          0,
          Math.atan2(d1y, d1x) + Math.PI / 2,
        );
        // extremo 2: tangente en d2
        cyl(
          collarR,
          collarR,
          cLen,
          M.steelDark,
          x + d2x * bendR,
          y + d2y * bendR,
          z,
          comp,
          0,
          0,
          Math.atan2(d2y, d2x) + Math.PI / 2,
        );
        return m;
      };
      // Unión de tee LISA: sin collar/manguito oscuro alrededor del manifold (el usuario pidió
      // quitar esa figura). El ramal vertical ya perfora/intersecta el manifold — queda como una
      // T limpia. Se conserva la función por los call sites (acepta los mismos args, no dibuja).
      const tee = (..._a: unknown[]) => {};
      const cyl = (
        rt: number,
        rb: number,
        h: number,
        mat: THREE.Material,
        x: number,
        y: number,
        z: number,
        comp: number,
        rx = 0,
        ry = 0,
        rz = 0,
      ) => add(new THREE.CylinderGeometry(rt, rb, h, 24), mat, x, y, z, comp, rx, ry, rz);
      const box = (
        w: number,
        h: number,
        d: number,
        mat: THREE.Material,
        x: number,
        y: number,
        z: number,
        comp: number,
        rx = 0,
        ry = 0,
        rz = 0,
      ) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, comp, rx, ry, rz);

      const R_PIPE = 0.07;
      const R_MAN = 0.09;

      // column x positions
      const spacing = 1.2;
      const start = -((numPumps - 1) * spacing) / 2;
      const cols = Array.from({ length: numPumps }, (_, i) => start + i * spacing);
      const colL = cols[0];
      const colR = cols[numPumps - 1];

      // heights
      const Y_SUC = 1.7; // suction manifold
      const Y_VLOW = 2.05; // isolation valve below pump
      const Y_PUMP = 2.75; // pump center
      const Y_VHIGH = 3.6; // isolation valve above pump
      const Y_CHECK = 4.15; // check valve
      const Y_DIS = 4.8; // discharge manifold

      // ---- cistern (badge 1) ----
      const CX = colL - 3.1;
      const cistR = 1.15;
      const cistH = 1.5;
      // outer wall (open top): use cylinder with no top cap
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(cistR, cistR, cistH, 40, 1, true),
        M.steel.clone(),
      );
      (wall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      wall.position.set(CX, cistH / 2, 0);
      wall.castShadow = true;
      (wall.userData as { comp?: number }).comp = 1;
      group.add(wall);
      meshes.push(wall);
      // bottom
      cyl(cistR, cistR, 0.06, M.steel, CX, 0.03, 0, 1);
      // rim
      add(new THREE.TorusGeometry(cistR, 0.05, 12, 40), M.steel, CX, cistH, 0, 1, Math.PI / 2);
      // water
      cyl(cistR - 0.06, cistR - 0.06, 0.85, M.water, CX, 0.5, 0, 1);
      // level lines (max/min) as thin white rings on front
      add(
        new THREE.TorusGeometry(cistR + 0.005, 0.012, 8, 48),
        M.white,
        CX,
        1.05,
        0,
        1,
        Math.PI / 2,
      );
      add(
        new THREE.TorusGeometry(cistR + 0.005, 0.012, 8, 48),
        M.white,
        CX,
        0.45,
        0,
        1,
        Math.PI / 2,
      );
      // inlet pipe from left into wall + float (no pertenece al colador)
      pipe(CX - 2.4, 1.2, 0, CX - cistR + 0.05, 1.2, 0, R_PIPE, 0);
      // float rod
      cyl(0.015, 0.015, 0.5, M.steelDark, CX - cistR + 0.25, 0.95, 0, 1);
      cyl(0.06, 0.06, 0.08, M.gray, CX - cistR + 0.25, 0.75, 0, 1);
      // outlet bottom-right -> right -> codo 90 -> up -> codo 90 -> manifold de succión
      bend(colL - 0.6, 0.25, 0, -1, 0, 0, 1, 0.3, R_PIPE * 1.2, 0);
      pipe(CX + cistR - 0.1, 0.25, 0, colL - 0.9, 0.25, 0, R_PIPE, 0);
      // El tubo vertical sube hasta el extremo del codo superior (Y_SUC - bendR).
      pipe(colL - 0.6, 0.55, 0, colL - 0.6, Y_SUC - 0.3, 0, R_PIPE, 0);
      // Codo 90° en la parte SUPERIOR: el tubo sube y gira hacia el manifold de succión (hasta
      // ahora era una esquina con tee; el usuario pidió que se lea como codo 90°).
      bend(colL - 0.6, Y_SUC, 0, 0, -1, 1, 0, 0.3, R_PIPE, 0);

      // ---- suction manifold ----
      pipe(colL - 0.6 + 0.3, Y_SUC, 0, colR + 0.5, Y_SUC, 0, R_MAN, 0);
      // tapón (tapon) al final del manifold de succión, no una bola
      cyl(
        R_MAN * 1.25,
        R_MAN * 1.25,
        0.08,
        M.steelDark,
        colR + 0.52,
        Y_SUC,
        0,
        0,
        0,
        0,
        Math.PI / 2,
      );
      cyl(R_MAN * 0.8, R_MAN * 0.8, 0.06, M.steelDark, colR + 0.58, Y_SUC, 0, 0, 0, 0, Math.PI / 2);

      // ---- pump columns ----
      cols.forEach((x) => {
        // tee on suction manifold (limpio, sin bola)
        tee(x, Y_SUC, 0, R_MAN * 1.25, 0.18, 0);
        pipe(x, Y_SUC, 0, x, Y_VLOW, 0, R_PIPE, 2);
        // isolation valve below (blue handle)
        cyl(0.09, 0.09, 0.16, M.steelDark, x, Y_VLOW, 0, 2);
        cyl(0.03, 0.03, 0.12, M.steelDark, x + 0.1, Y_VLOW, 0, 2, 0, 0, Math.PI / 2);
        cyl(0.07, 0.07, 0.03, M.blue, x + 0.17, Y_VLOW, 0, 2, 0, 0, Math.PI / 2);
        pipe(x, Y_VLOW + 0.08, 0, x, Y_PUMP - 0.35, 0, R_PIPE, 3);
        // pump: flange + casing + motor + fins + cap
        cyl(0.2, 0.22, 0.06, M.blue, x, Y_PUMP - 0.32, 0, 3);
        cyl(0.16, 0.16, 0.3, M.blue, x, Y_PUMP - 0.12, 0, 3);
        cyl(0.17, 0.17, 0.42, M.blueDark, x, Y_PUMP + 0.22, 0, 3);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          box(
            0.02,
            0.36,
            0.02,
            M.blueDark,
            x + Math.cos(a) * 0.17,
            Y_PUMP + 0.22,
            Math.sin(a) * 0.17,
            3,
          );
        }
        cyl(0.1, 0.1, 0.06, M.blueDark, x, Y_PUMP + 0.46, 0, 3);
        // junction box
        box(0.12, 0.12, 0.1, M.blue, x + 0.18, Y_PUMP + 0.25, 0, 3);
        pipe(x, Y_PUMP + 0.5, 0, x, Y_VHIGH, 0, R_PIPE, 2);
        // isolation valve above
        cyl(0.09, 0.09, 0.16, M.steelDark, x, Y_VHIGH, 0, 2);
        cyl(0.03, 0.03, 0.12, M.steelDark, x + 0.1, Y_VHIGH, 0, 2, 0, 0, Math.PI / 2);
        cyl(0.07, 0.07, 0.03, M.blue, x + 0.17, Y_VHIGH, 0, 2, 0, 0, Math.PI / 2);
        pipe(x, Y_VHIGH + 0.08, 0, x, Y_CHECK - 0.1, 0, R_PIPE, 0);
        // check valve body with X (solo la válvula, no las tuberías)
        cyl(0.1, 0.1, 0.2, M.steelDark, x, Y_CHECK, 0, 4);
        box(0.16, 0.03, 0.03, M.steelDark, x, Y_CHECK, 0.09, 4, 0, 0, Math.PI / 4);
        box(0.16, 0.03, 0.03, M.steelDark, x, Y_CHECK, 0.09, 4, 0, 0, -Math.PI / 4);
        pipe(x, Y_CHECK + 0.1, 0, x, Y_DIS, 0, R_PIPE, 0);
        tee(x, Y_DIS, 0, R_MAN * 1.25, 0.18, 0);
      });

      // ---- discharge manifold ----
      pipe(colL - 0.6, Y_DIS, 0, colR + 1.5, Y_DIS, 0, R_MAN, 0);
      // outlet gate valve (solo la válvula, comp 2) + arrow
      const OX = colR + 1.2;
      cyl(0.1, 0.1, 0.18, M.steelDark, OX, Y_DIS, 0, 2);
      cyl(0.03, 0.03, 0.2, M.steelDark, OX, Y_DIS + 0.16, 0, 2);
      add(
        new THREE.TorusGeometry(0.11, 0.025, 10, 24),
        M.blue,
        OX,
        Y_DIS + 0.28,
        0,
        2,
        Math.PI / 2,
      );
      // arrow out
      const arrow = add(
        new THREE.ConeGeometry(0.09, 0.3, 16),
        M.blueDark,
        colR + 1.75,
        Y_DIS,
        0,
        0,
        0,
        0,
        -Math.PI / 2,
      );
      arrow.rotation.set(0, 0, -Math.PI / 2);

      // ---- manometer (5) on center col ----
      const gx = cols[Math.floor((numPumps - 1) / 2)];
      pipe(gx, Y_DIS, 0, gx, Y_DIS + 0.35, 0, 0.03, 5);
      cyl(0.14, 0.14, 0.05, M.white, gx, Y_DIS + 0.5, 0, 5, Math.PI / 2);
      add(new THREE.TorusGeometry(0.14, 0.02, 10, 32), M.steelDark, gx, Y_DIS + 0.5, 0.02, 5);
      box(0.02, 0.1, 0.01, M.red, gx, Y_DIS + 0.53, 0.03, 5, 0, 0, 0.6);

      // ---- pressure transmitter (6) on right col (Rosemount-style) ----
      const tx = colR;
      pipe(tx, Y_DIS, 0, tx, Y_DIS + 0.3, 0, 0.03, 6);
      // hex valve manifold
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 6), M.steelDark, tx, Y_DIS + 0.34, 0, 6);
      // body
      cyl(0.08, 0.09, 0.22, M.blue, tx, Y_DIS + 0.5, 0, 6);
      // round head facing camera
      cyl(0.12, 0.12, 0.12, M.blue, tx, Y_DIS + 0.68, 0.05, 6, Math.PI / 2);
      // glass display window + rim
      cyl(0.09, 0.09, 0.02, M.glass, tx, Y_DIS + 0.68, 0.12, 6, Math.PI / 2);
      add(new THREE.TorusGeometry(0.1, 0.016, 10, 32), M.steelDark, tx, Y_DIS + 0.68, 0.12, 6);
      // conduit glands
      cyl(0.03, 0.03, 0.09, M.steelDark, tx - 0.13, Y_DIS + 0.62, 0, 6, 0, 0, Math.PI / 2);
      cyl(0.03, 0.03, 0.09, M.steelDark, tx + 0.13, Y_DIS + 0.62, 0, 6, 0, 0, Math.PI / 2);

      // ---- tanque hidroneumático (8) top-left, CONEXIÓN RECTA sin codo ----
      const TX = colL - 1.6;
      // El tanque baja un poco (antes Y_DIS+0.6) para que el tubo de salida quede alineado con
      // el manifold de descarga (Y_DIS) — conexión DIRECTA horizontal, sin codo 90°.
      const TY = Y_DIS + 0.2;
      cyl(0.45, 0.45, 1.0, M.blue, TX, TY, 0, 8);
      add(new THREE.SphereGeometry(0.45, 24, 16), M.blue, TX, TY + 0.5, 0, 8);
      add(new THREE.SphereGeometry(0.45, 24, 16), M.blue, TX, TY - 0.5, 0, 8);
      // legs
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        cyl(0.04, 0.05, 0.5, M.blue, TX + Math.cos(a) * 0.32, TY - 0.75, Math.sin(a) * 0.32, 8);
      }
      // concrete base under legs (pad + footing)
      box(1.5, 0.16, 1.5, M.concrete, TX, TY - 1.06, 0, 8);
      box(1.7, 0.1, 1.7, M.concrete, TX, TY - 1.19, 0, 8);
      // conexión: tubo RECTO horizontal del tanque al manifold de descarga (sin codo, sin bajada).
      // El tanque se bajó (TY = Y_DIS + 0.2) para que su salida (TY-0.2) quede EXACTAMENTE a la
      // altura del manifold (Y_DIS) → un único tubo horizontal recto, sin codo ni bajada.
      // R_MAN = mismo grosor que el manifold. Empieza DENTRO del cuerpo del tanque (TX+0.42 < radio
      // 0.45) para que no quede la costilla/imperfección en el empalme con la carcasa.
      pipe(TX + 0.42, Y_DIS, 0, colL - 0.6, Y_DIS, 0, R_MAN, 8);
      tee(colL - 0.6, Y_DIS, 0, R_MAN * 1.25, 0.18, 0);

      // ---- PLC (7) right side with wall behind (separado del tubo de salida) ----
      const PX = colR + 3.8;
      const PY = Y_DIS - 0.4;
      // wall behind cabinet
      box(2.4, 2.9, 0.1, M.wall, PX, PY + 0.2, -0.32, 7);
      box(1.0, 1.3, 0.3, M.gray, PX, PY, 0, 7);
      box(0.9, 1.2, 0.04, M.gray, PX, PY, 0.17, 7);
      // hinges
      box(0.05, 0.12, 0.06, M.steelDark, PX - 0.48, PY + 0.4, 0.17, 7);
      box(0.05, 0.12, 0.06, M.steelDark, PX - 0.48, PY - 0.4, 0.17, 7);
      // buttons grid
      const btnCols = [M.green, M.green, M.orange, M.yellow, M.red, M.red, M.red, M.yellow];
      btnCols.forEach((bm, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        cyl(0.05, 0.05, 0.04, bm, PX - 0.28 + c * 0.19, PY + 0.32 - r * 0.22, 0.2, 7, Math.PI / 2);
      });
      // rotary + beacon
      cyl(0.06, 0.06, 0.05, M.black, PX - 0.28, PY - 0.35, 0.2, 7, Math.PI / 2);
      cyl(0.05, 0.05, 0.12, M.red, PX + 0.3, PY + 0.75, 0, 7);
      add(new THREE.SphereGeometry(0.07, 16, 12), M.beacon, PX + 0.3, PY + 0.85, 0, 7);

      // ---- badges ----
      // Badge 2 solo en la válvula de aislamiento más a la derecha (tras la bomba, Y_VHIGH)
      // y en la válvula inferior derecha (Y_VLOW).
      const badgeData: Array<{ num: number; pos: THREE.Vector3 }> = [
        { num: 1, pos: new THREE.Vector3(CX + cistR * 0.6, 0.5, 0.4) },
        { num: 2, pos: new THREE.Vector3(colR + 0.4, Y_VHIGH, 0) },
        { num: 2, pos: new THREE.Vector3(colR + 0.4, Y_VLOW, 0) },
        { num: 3, pos: new THREE.Vector3(colR + 0.45, Y_PUMP + 0.2, 0) },
        { num: 4, pos: new THREE.Vector3(colR + 0.4, Y_CHECK, 0) },
        { num: 5, pos: new THREE.Vector3(gx + 0.35, Y_DIS + 0.5, 0) },
        { num: 6, pos: new THREE.Vector3(tx + 0.35, Y_DIS + 0.6, 0) },
        { num: 7, pos: new THREE.Vector3(PX + 0.42, PY + 0.5, 0) },
        { num: 8, pos: new THREE.Vector3(TX + 0.6, TY - 0.4, 0) },
      ];
      const badgeWrap = badgeWrapRef.current;
      const badgeEls: Array<{ num: number; pos: THREE.Vector3; btn: HTMLButtonElement }> = [];
      if (badgeWrap) {
        badgeWrap.innerHTML = '';
        badgeData.forEach(({ num, pos }) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = String(num);
          b.style.cssText =
            'position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:#fff;border:1.5px solid #d33;color:#d33;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;transition:all 120ms;';
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelected((s) => (s === num ? null : num));
          });
          badgeWrap.appendChild(b);
          badgeEls.push({ num, pos, btn: b });
        });
      }

      // highlight
      const applyHighlight = () => {
        const sel = selectedRef.current;
        meshes.forEach((m) => {
          const mm = m.material as THREE.MeshStandardMaterial;
          const ud = m.userData as { comp?: number; em0?: number; ei0?: number };
          const on = sel != null && ud.comp === sel;
          mm.emissive.setHex(on ? 0x1a9a4a : (ud.em0 ?? 0));
          mm.emissiveIntensity = on ? 0.5 : (ud.ei0 ?? 0);
        });
        badgeEls.forEach(({ num, btn }) => {
          const on = sel === num;
          btn.style.background = on ? '#1a9a4a' : '#fff';
          btn.style.color = on ? '#fff' : '#d33';
          btn.style.borderColor = on ? '#1a9a4a' : '#d33';
        });
      };

      // orbit
      const spherical = { theta: 0.12, phi: Math.PI / 2.15, r: 13.5 };
      const target = new THREE.Vector3(-0.3, 2.6, 0);
      const updateCamera = () => {
        camera.position.x =
          target.x + spherical.r * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        camera.position.y = target.y + spherical.r * Math.cos(spherical.phi);
        camera.position.z =
          target.z + spherical.r * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        camera.lookAt(target);
      };
      updateCamera();

      let isDown = false;
      let panMode = false;
      let px = 0,
        py = 0;
      const onDown = (e: PointerEvent) => {
        isDown = true;
        // Ítem usuario: la RUEDA (botón medio) PANEA (mueve el esquema), el click izquierdo
        // (principal) ROTA. El pan mueve el `target` de la cámara; la rotación sigue igual.
        panMode = e.button === 1;
        px = e.clientX;
        py = e.clientY;
        if (e.button === 1) e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
      };
      const onUp = (e: PointerEvent) => {
        isDown = false;
        canvas.releasePointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!isDown) return;
        const dx = e.clientX - px;
        const dy = e.clientY - py;
        if (panMode) {
          // Pan en el plano de la cámara: right (horizontal mundo) y screenUp (vertical).
          const sinT = Math.sin(spherical.theta),
            cosT = Math.cos(spherical.theta);
          const sinP = Math.sin(spherical.phi),
            cosP = Math.cos(spherical.phi);
          const s = spherical.r * 0.0012;
          // right normalizado en mundo: (cosT, 0, -sinT); screenUp: (-sinT*cosP, sinP, -cosT*cosP)
          target.x += -dx * s * cosT + dy * s * (-sinT * cosP);
          target.y += dy * s * sinP;
          target.z += -dx * s * -sinT + dy * s * (-cosT * cosP);
        } else {
          spherical.theta -= dx * 0.005;
          spherical.phi = Math.max(0.2, Math.min(Math.PI / 2.02, spherical.phi + dy * 0.005));
        }
        px = e.clientX;
        py = e.clientY;
        updateCamera();
      };
      const onWheel = (e: WheelEvent) => {
        spherical.r = Math.max(4, Math.min(24, spherical.r + e.deltaY * 0.01));
        updateCamera();
        e.preventDefault();
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      // Sin esto, el botón medio activa el auto-scroll del navegador y roba el pan.
      canvas.addEventListener('auxclick', (e) => e.preventDefault());

      const onResize = () => {
        const W = wrap.clientWidth,
          H = wrap.clientHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      onResize();

      let raf = 0;
      const tmp = new THREE.Vector3();
      const animate = () => {
        raf = requestAnimationFrame(animate);
        applyHighlight();
        renderer.render(scene, camera);
        const rect = wrap.getBoundingClientRect();
        badgeEls.forEach(({ pos, btn }) => {
          tmp.copy(pos).project(camera);
          if (tmp.z < -1 || tmp.z > 1) {
            btn.style.display = 'none';
            return;
          }
          btn.style.display = 'flex';
          btn.style.left = `${(tmp.x * 0.5 + 0.5) * rect.width}px`;
          btn.style.top = `${(-tmp.y * 0.5 + 0.5) * rect.height}px`;
        });
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('wheel', onWheel);
        if (badgeWrap) badgeWrap.innerHTML = '';
        renderer.dispose();
        meshes.forEach((m) => (m.geometry as THREE.BufferGeometry).dispose());
        scene.clear();
      };
    })();
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPumps]);

  const selInfo = LEGEND.find((l) => l.num === selected) ?? null;
  const title =
    numPumps === 4
      ? 'Sistema de presurización desde cisterna — 4 bombas (3 trabajo + 1 reserva)'
      : 'Sistema de presurización desde cisterna — 3 bombas (2 trabajo + 1 reserva)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        minHeight: 0,
        background: 'var(--bg)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }} />
        {updEP && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--txt3)' }}>Configuración:</span>
            <button
              type="button"
              onClick={() => {
                updEP('nt', '2');
                updEP('nr', '1');
              }}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: nt === 2 && nr === 1 ? 'var(--acc)' : 'transparent',
                color: nt === 2 && nr === 1 ? '#fff' : 'var(--txt3)',
                border: `1px solid ${nt === 2 && nr === 1 ? 'var(--acc)' : 'var(--line)'}`,
              }}
            >
              2T + 1R
            </button>
            <button
              type="button"
              onClick={() => {
                updEP('nt', '3');
                updEP('nr', '1');
              }}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: nt === 3 && nr === 1 ? 'var(--acc)' : 'transparent',
                color: nt === 3 && nr === 1 ? '#fff' : 'var(--txt3)',
                border: `1px solid ${nt === 3 && nr === 1 ? 'var(--acc)' : 'var(--line)'}`,
              }}
            >
              3T + 1R
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            const file = numPumps === 4 ? 'EP_3T1R.webp' : 'EP_2T1R.webp';
            const a = document.createElement('a');
            a.href = `/${file}`;
            a.download = file;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'var(--acc)',
            color: '#fff',
            border: 'none',
            flexShrink: 0,
          }}
        >
          Descargar esquema 2D
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          ref={wrapRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#f1f1f4',
            minHeight: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 13,
              fontWeight: 800,
              color: '#12306b',
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 26,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              fontWeight: 700,
              color: '#12306b',
              fontStyle: 'italic',
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Esquema básico de referencia (mínimo sugerido) — la aplicación depende de cada proyecto
          </div>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          <div
            ref={badgeWrapRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
          />
          <div
            style={{
              position: 'absolute',
              top: 34,
              left: 10,
              width: 230,
              background: 'rgba(255,255,255,.97)',
              border: '1px solid #d0d4da',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 10,
              color: '#334',
              pointerEvents: 'none',
              boxShadow: '0 1px 6px rgba(0,0,0,.06)',
            }}
          >
            <div style={{ fontWeight: 800, color: '#12306b', marginBottom: 5 }}>
              Notas de construcción
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'Válvula de compuerta en la succión de cada bomba para mantenimiento sin vaciar la cisterna.',
                'El colador de succión debe quedar sumergido por debajo del nivel mínimo.',
                'Prever soportes y anclajes para manifolds, bombas y tanque hidroneumático.',
                'Dejar espacio frontal de acceso para bombas, PLC y drenajes.',
              ].map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      minWidth: 7,
                      borderRadius: '50%',
                      background: '#333',
                      marginTop: 4,
                    }}
                  />
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            ref={labelRef}
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              maxWidth: 320,
              background: 'rgba(255,255,255,.95)',
              border: '1px solid #d0d4da',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 11,
              color: '#223',
              pointerEvents: 'none',
            }}
          >
            {selInfo ? (
              <>
                <div style={{ fontWeight: 800, color: '#12306b', marginBottom: 2 }}>
                  {selInfo.num}. {selInfo.name}
                </div>
                <div>{selInfo.desc}</div>
              </>
            ) : (
              <span style={{ color: '#667' }}>
                Arrastrar → girar · Scroll → zoom · Clic en número → info
              </span>
            )}
          </div>
        </div>
        {/* right info panels */}
        <div
          style={{
            width: 300,
            background: '#f7f8fa',
            borderLeft: '1px solid #e2e5ea',
            padding: 12,
            overflow: 'hidden',
            flexShrink: 0,
            fontSize: 11,
            color: '#223',
          }}
        >
          <div
            style={{
              border: '1px solid #d8dce2',
              borderRadius: 8,
              padding: 10,
              marginBottom: 10,
              background: '#fff',
            }}
          >
            <div
              style={{ fontWeight: 800, color: '#12306b', textAlign: 'center', marginBottom: 8 }}
            >
              CONTROL Y AUTOMATIZACIÓN
            </div>
            <div style={{ fontWeight: 700, color: '#12306b', marginBottom: 4 }}>
              CONTROLADOR LÓGICO PROGRAMABLE (PLC)
            </div>
            <div style={{ fontWeight: 700, color: '#12306b', marginTop: 6 }}>ALIMENTACIÓN</div>
            <div>+ 24 VDC</div>
            <div>+ 0 VDC</div>
            <div style={{ fontWeight: 700, color: '#12306b', marginTop: 6 }}>
              ENTRADAS DIGITALES
            </div>
            <div>ED1 · Nivel máximo (LSH)</div>
            <div>ED2 · Nivel mínimo (LSL)</div>
            <div>ED3 · Paro de emergencia</div>
            <div style={{ fontWeight: 700, color: '#12306b', marginTop: 6 }}>ENTRADA ANALÓGICA</div>
            <div>AI-01 · Transmisor de presión 4-20 mA</div>
            <div style={{ fontWeight: 700, color: '#12306b', marginTop: 6 }}>SALIDAS DIGITALES</div>
            {Array.from({ length: numPumps }, (_, i) => (
              <div key={i}>
                DO{i + 1} · Contactor B{i + 1} (Bomba {i + 1}
                {i === numPumps - 1 ? ' Reserva' : ''})
              </div>
            ))}
            <div>DO{numPumps + 1} · Marcha / Falla</div>
            <div>DO{numPumps + 2} · Alarma (visual / sonoro)</div>
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                color: '#667',
                fontStyle: 'italic',
                borderTop: '1px solid #e2e5ea',
                paddingTop: 6,
              }}
            >
              Nota: Esta sección es una referencia básica y sencilla; su aplicación final depende de
              cada proyecto.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #d8dce2',
              borderRadius: 8,
              padding: 10,
              background: '#fff',
            }}
          >
            <div
              style={{ fontWeight: 800, color: '#12306b', textAlign: 'center', marginBottom: 8 }}
            >
              LEYENDA DE COMPONENTES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {LEGEND.map((l) => (
                <button
                  key={l.num}
                  type="button"
                  onClick={() => setSelected((s) => (s === l.num ? null : l.num))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: selected === l.num ? '#e8f5ee' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 10,
                    color: '#223',
                    textAlign: 'left',
                    padding: 2,
                  }}
                >
                  <span
                    style={{
                      minWidth: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '1.5px solid #d33',
                      color: '#d33',
                      fontWeight: 800,
                      fontSize: 9,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {l.num}
                  </span>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
