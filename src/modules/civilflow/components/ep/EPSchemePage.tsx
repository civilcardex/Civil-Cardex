import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { EPData } from './EPShared';
import { dec } from '../../utils/parseDecimal';

// ponytail: minimum that works — single canvas + sidebar ported from Civilflow_EPC_3D / Modulo, driven by EPData (modo + nt/nr)

const COMPS: Array<{
  id: string;
  num: number;
  name: string;
  sub: string;
  norm: string;
  desc: string;
}> = [
  {
    id: 'acometida',
    num: 1,
    name: 'Acometida de entrada',
    sub: 'Red pública · cisterna',
    norm: 'NTC 1500 §3',
    desc: 'Tubería de alimentación desde la red pública o cisterna hacia el manifold de succión del EPC. DN según caudal de diseño.',
  },
  {
    id: 'vg_ent',
    num: 2,
    name: 'Válvula de corte entrada',
    sub: 'Compuerta · mariposa',
    norm: 'NTC 1500',
    desc: 'Permite aislar el equipo de la red de suministro para mantenimiento.',
  },
  {
    id: 'filtro',
    num: 3,
    name: 'Filtro en Y',
    sub: 'Malla acero inox.',
    norm: 'NTC 1500',
    desc: 'Filtro tipo Y con malla de acero inoxidable para proteger los impulsores.',
  },
  {
    id: 'presost_s',
    num: 4,
    name: 'Presostato de succión',
    sub: 'Control presión mín.',
    norm: 'NFPA 20 §4',
    desc: 'Sensor de presión en línea de succión. Detiene bombas si la presión cae por debajo del mínimo (anti-cavitación).',
  },
  {
    id: 'manif_s',
    num: 5,
    name: 'Manifold de succión',
    sub: 'Colector Ø mayor',
    norm: 'RAS 2000 Tít.B',
    desc: 'Colector de diámetro mayor que las tuberías individuales, garantiza distribución uniforme a cada bomba. Acero SCH-40.',
  },
  {
    id: 'vg_s1',
    num: 6,
    name: 'Válvula succión Bomba 1',
    sub: 'Compuerta · mariposa',
    norm: 'NTC 1500',
    desc: 'Válvula de aislamiento en succión de la Bomba 1.',
  },
  {
    id: 'vg_s2',
    num: 7,
    name: 'Válvula succión Bomba 2',
    sub: 'Compuerta · mariposa',
    norm: 'NTC 1500',
    desc: 'Válvula de aislamiento en succión de la Bomba 2.',
  },
  {
    id: 'vg_s3',
    num: 8,
    name: 'Válvula succión Bomba 3 (R)',
    sub: 'Compuerta · mariposa',
    norm: 'NTC 1500',
    desc: 'Válvula de aislamiento en succión de la Bomba 3 (reserva).',
  },
  {
    id: 'b1',
    num: 9,
    name: 'Bomba 1 — Trabajo',
    sub: 'Centrífuga multietapa',
    norm: 'NSR-10 H',
    desc: 'Bomba centrífuga multietapa. Opera en modo trabajo principal.',
  },
  {
    id: 'b2',
    num: 10,
    name: 'Bomba 2 — Trabajo',
    sub: 'Centrífuga multietapa',
    norm: 'NSR-10 H',
    desc: 'Bomba de trabajo secundaria. Opera en paralelo con Bomba 1.',
  },
  {
    id: 'b3',
    num: 11,
    name: 'Bomba 3 — Reserva',
    sub: 'Arranque automático',
    norm: 'NSR-10 H',
    desc: 'Bomba de reserva (stand-by). Arranca si falla una de trabajo o cae la presión.',
  },
  {
    id: 'vrd1',
    num: 12,
    name: 'Válvula retención Bomba 1',
    sub: 'Check swing · axial',
    norm: 'NTC 1500',
    desc: 'Válvula check en impulsión de cada bomba. Impide flujo inverso.',
  },
  {
    id: 'vrd2',
    num: 13,
    name: 'Válvula retención Bomba 2',
    sub: 'Check swing · axial',
    norm: 'NTC 1500',
    desc: 'Válvula check en impulsión de la Bomba 2.',
  },
  {
    id: 'vrd3',
    num: 14,
    name: 'Válvula retención Bomba 3',
    sub: 'Check swing · axial',
    norm: 'NTC 1500',
    desc: 'Válvula check en impulsión de la Bomba 3.',
  },
  {
    id: 'manif_i',
    num: 15,
    name: 'Manifold de impulsión',
    sub: 'Colector Ø mayor',
    norm: 'RAS 2000 Tít.B',
    desc: 'Colector donde convergen las líneas de las bombas antes de la red o el tanque hidroneumático.',
  },
  {
    id: 'psv',
    num: 16,
    name: 'Válvula alivio PSV',
    sub: 'Presión máx. de diseño',
    norm: 'ASME §VIII',
    desc: 'Válvula de alivio calibrada a Pmáx + 10%. Protege tuberías y equipos.',
  },
  {
    id: 'manometro',
    num: 17,
    name: 'Manómetro / transductor',
    sub: '4–20 mA o Bourdon',
    norm: 'ISA 5.1',
    desc: 'Medición de presión en manifold de impulsión. Bourdon o transductor 4-20 mA.',
  },
  {
    id: 'tank',
    num: 18,
    name: 'Tanque hidroneumático',
    sub: 'Recipiente a vejiga',
    norm: 'ASME §VIII',
    desc: 'Recipiente con vejiga aire-agua. Mantiene presión entre ciclos, reduce arranques.',
  },
  {
    id: 'presost_r',
    num: 19,
    name: 'Presostato de control',
    sub: 'P_on · P_off',
    norm: 'NSR-10 H',
    desc: 'Controla arranque (P_on) y parada (P_off) según presión en manifold de impulsión.',
  },
  {
    id: 'vg_red',
    num: 20,
    name: 'Válvula salida a red',
    sub: 'Compuerta · mariposa',
    norm: 'NTC 1500',
    desc: 'Válvula principal de salida hacia la red hidrosanitaria del edificio.',
  },
  {
    id: 'tablero',
    num: 21,
    name: 'Tablero de control',
    sub: 'PLC · relés + VFD',
    norm: 'NEC · RETIE',
    desc: 'Tablero con arrancadores, protecciones, selector manual/automático y VFD.',
  },
  {
    id: 'cisterna',
    num: 22,
    name: 'Cisterna · tanque succión',
    sub: 'Dotación + reserva incendio',
    norm: 'RAS 2000 Tít.B',
    desc: 'Tanque de succión. Volumen según dotación + reserva.',
  },
  {
    id: 'vg_sal',
    num: 23,
    name: 'Válvula salida a pisos',
    sub: 'Manifold distribución',
    norm: 'NTC 1500',
    desc: 'Válvulas de distribución hacia columnas o zonas de presión.',
  },
];

interface Props {
  ep: EPData;
  updEP?: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

export default function EPSchemePage({ ep, updEP }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('iso');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const matsOrig = useRef<Map<string, THREE.Material>>(new Map());
  const viewFnRef = useRef<(v: string) => void>(() => {});
  const selectedIdRef = useRef<string | null>(null);

  const hasCistern = ep.modo === 'cisterna';
  const nt = Math.max(1, dec(ep.nt) || 1);
  const nr = Math.max(0, dec(ep.nr) || 0);
  const ntot = Math.min(4, Math.max(2, nt + nr));

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectComp = useCallback((id: string) => {
    const meshes = meshesRef.current;
    const map = matsOrig.current;
    const cur = selectedIdRef.current;
    // restore
    if (cur) {
      meshes
        .filter((m) => (m.userData as { compId?: string }).compId === cur)
        .forEach((m) => {
          const orig = map.get(m.uuid);
          if (orig) (m as THREE.Mesh).material = orig;
        });
    }
    if (cur === id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    // Verde de alto contraste: el amarillo anterior se confundía con los materiales ámbar
    // (válvulas), por lo que V.succión 1/2/3 "no se veían" resaltadas.
    const hl = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.5,
    });
    meshes
      .filter((m) => (m.userData as { compId?: string }).compId === id)
      .forEach((m) => {
        if (!map.has(m.uuid))
          map.set(m.uuid, (m.material as THREE.Material).clone() as THREE.Material);
        (m as THREE.Mesh).material = hl;
      });
  }, []);

  // build scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // r128 used outputEncoding, newer uses outputColorSpace
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0xffffff);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.012);
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(6, 5, 9);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dirMain = new THREE.DirectionalLight(0xffffff, 0.9);
    dirMain.position.set(8, 12, 8);
    dirMain.castShadow = true;
    dirMain.shadow.mapSize.set(2048, 2048);
    dirMain.shadow.camera.near = 0.5;
    dirMain.shadow.camera.far = 60;
    (dirMain.shadow.camera as THREE.OrthographicCamera).left = -10;
    (dirMain.shadow.camera as THREE.OrthographicCamera).right = 10;
    (dirMain.shadow.camera as THREE.OrthographicCamera).top = 10;
    (dirMain.shadow.camera as THREE.OrthographicCamera).bottom = -10;
    scene.add(dirMain);
    const dirFill = new THREE.DirectionalLight(0xffffff, 0.45);
    dirFill.position.set(-6, 4, -6);
    scene.add(dirFill);
    const dirBack = new THREE.DirectionalLight(0xffffff, 0.25);
    dirBack.position.set(0, -4, -8);
    scene.add(dirBack);

    const gridHelper = new THREE.GridHelper(20, 40, 0xcbd5e1, 0xe2e8f0);
    (gridHelper.position as THREE.Vector3).y = -0.01;
    scene.add(gridHelper);
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    const M: Record<string, THREE.MeshStandardMaterial> = {
      pipeS: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.7 }),
      pipeI: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3, metalness: 0.7 }),
      pump: new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.25, metalness: 0.8 }),
      pumpH: new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x4c1d95,
        emissiveIntensity: 0.3,
      }),
      tank: new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.3, metalness: 0.6 }),
      valve: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.5 }),
      check: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.35, metalness: 0.6 }),
      board: new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6, metalness: 0.3 }),
      boardF: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.2 }),
      manif: new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.25, metalness: 0.85 }),
      manifI: new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.25, metalness: 0.85 }),
      filter: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.5 }),
      sensor: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.6 }),
      gauge: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.2, metalness: 0.7 }),
      cistern: new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.5, metalness: 0.3 }),
      psv: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.6 }),
    };

    const allMeshes: THREE.Mesh[] = [];
    meshesRef.current = allMeshes;
    matsOrig.current.clear();

    // helpers
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      cx: number,
      cy: number,
      cz: number,
      compId?: string,
    ) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, cy, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      if (compId) (m.userData as { compId?: string }).compId = compId;
      group.add(m);
      allMeshes.push(m as unknown as THREE.Mesh);
      return m;
    };
    const cyl = (
      rt: number,
      rb: number,
      h: number,
      seg: number,
      mat: THREE.Material,
      cx: number,
      cy: number,
      cz: number,
      rx?: number,
      ry?: number,
      rz?: number,
      compId?: string,
    ) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg);
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, cy, cz);
      if (rx !== undefined || ry !== undefined || rz !== undefined)
        m.rotation.set(rx ?? 0, ry ?? 0, rz ?? 0);
      m.castShadow = true;
      m.receiveShadow = true;
      if (compId) (m.userData as { compId?: string }).compId = compId;
      group.add(m);
      allMeshes.push(m as unknown as THREE.Mesh);
      return m;
    };
    const sphere = (
      r: number,
      seg: number,
      mat: THREE.Material,
      cx: number,
      cy: number,
      cz: number,
      compId?: string,
    ) => {
      const g = new THREE.SphereGeometry(r, seg, seg);
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, cy, cz);
      m.castShadow = true;
      if (compId) (m.userData as { compId?: string }).compId = compId;
      group.add(m);
      allMeshes.push(m as unknown as THREE.Mesh);
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
      mat: THREE.Material,
      compId?: string,
    ) => {
      const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
      const len = dir.length();
      if (len < 0.001) return;
      const g = new THREE.CylinderGeometry(r, r, len, 12);
      const m = new THREE.Mesh(g, mat);
      const mid = new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      m.castShadow = true;
      if (compId) (m.userData as { compId?: string }).compId = compId;
      group.add(m);
      allMeshes.push(m as unknown as THREE.Mesh);
      return m;
    };
    const elbow = (
      cx: number,
      cy: number,
      cz: number,
      r: number,
      mat: THREE.Material,
      compId?: string,
    ) => {
      const g = new THREE.SphereGeometry(r * 1.4, 10, 10);
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, cy, cz);
      if (compId) (m.userData as { compId?: string }).compId = compId;
      group.add(m);
      allMeshes.push(m as unknown as THREE.Mesh);
      return m;
    };

    // derived nt/nr
    const numBombs = ntot;
    const bombPos = (() => {
      if (numBombs === 2) return [-0.6, 0.6];
      if (numBombs === 3) return [-0.9, 0, 0.9];
      if (numBombs === 4) return [-1.35, -0.45, 0.45, 1.35];
      return Array.from({ length: numBombs }, (_, i) => -0.9 + (i * 1.8) / (numBombs - 1));
    })();
    const bombIds = Array.from({ length: numBombs }, (_, i) => `b${i + 1}`);
    const vgSIds = Array.from({ length: numBombs }, (_, i) => `vg_s${i + 1}`);
    const vrdIds = Array.from({ length: numBombs }, (_, i) => `vrd${i + 1}`);

    const pR = 0.04;
    const pRi = 0.032;

    // CISTERNA or ACOMETIDA
    if (hasCistern) {
      box(2.0, 1.6, 1.4, M.cistern, -4.0, 0.8, 0, 'cisterna');
      box(
        0.8,
        0.15,
        0.02,
        new THREE.MeshStandardMaterial({ color: 0x164e63 }),
        -4.0,
        1.5,
        0.71,
        'cisterna',
      );
      pipe(-3.0, 0.5, 0, -1.9, 0.5, 0, pR, M.pipeS, 'acometida');
      // suction from cisterna to manifold
      pipe(-3.0, 0.5, 0, -0.72, 0.5, 0, pR, M.pipeS, 'manif_s');
    } else {
      pipe(-4.0, 0.5, 0, -1.9, 0.5, 0, pR, M.pipeS, 'acometida');
      cyl(0.07, 0.07, 0.12, 12, M.manif, -3.9, 0.5, 0, 0, 0, Math.PI / 2, 'acometida');
    }

    // Válvula corte entrada — conectada sin gaps
    box(0.18, 0.14, 0.14, M.valve, -1.7, 0.5, 0, 'vg_ent');
    cyl(0.05, 0.05, 0.22, 10, M.pipeS, -1.7, 0.5, 0, 0, 0, Math.PI / 2, 'vg_ent');
    cyl(0.04, 0.04, 0.18, 8, M.valve, -1.7, 0.64, 0, 0, 0, 0, 'vg_ent');
    pipe(-1.9, 0.5, 0, -1.7, 0.5, 0, pR, M.pipeS, 'vg_ent');
    pipe(-1.62, 0.5, 0, -1.7, 0.5, 0, pR, M.pipeS, 'vg_ent');

    // Filtro — conectado
    cyl(0.09, 0.09, 0.22, 10, M.filter, -1.35, 0.5, 0, 0, 0, Math.PI / 2, 'filtro');
    cyl(0.06, 0.04, 0.18, 8, M.filter, -1.35, 0.38, 0.05, 0.5, 0, 0, 'filtro');
    pipe(-1.62, 0.5, 0, -1.35, 0.5, 0, pR, M.pipeS, 'filtro');
    pipe(-1.35, 0.5, 0, -1.05, 0.5, 0, pR, M.pipeS, 'filtro');

    // Presostato succión — conectado
    cyl(0.06, 0.06, 0.08, 10, M.sensor, -1.05, 0.5, 0, 0, 0, Math.PI / 2, 'presost_s');
    cyl(0.04, 0.04, 0.14, 8, M.sensor, -1.05, 0.62, 0.0, 0, 0, 0, 'presost_s');
    sphere(0.07, 8, M.sensor, -1.05, 0.72, 0, 'presost_s');
    pipe(-1.05, 0.5, 0, -0.72, 0.5, 0, pR, M.pipeS, 'presost_s');

    // Manifold succión — continuo
    cyl(0.1, 0.1, 1.9, 12, M.manif, -0.72, 0.5, 0, 0, 0, Math.PI / 2, 'manif_s');
    sphere(0.1, 10, M.manif, -1.67, 0.5, 0, 'manif_s');
    sphere(0.1, 10, M.manif, 0.23, 0.5, 0, 'manif_s');
    elbow(-1.62, 0.5, 0, 0.04, M.pipeS, 'manif_s');
    elbow(0.18, 0.5, 0, 0.04, M.pipeS, 'manif_s');

    // BOMBAS
    bombPos.forEach((bx, i) => {
      const isReserve = i >= nt;
      const bMat = isReserve ? M.pump : M.pumpH;
      // succión down — la caja de válvula protruye en +z para que el raycast no pegue en el
      // motor de la bomba (antes quedaba oculta detrás del cilindro del motor y al hacer clic
      // se seleccionaba la bomba en vez de la válvula).
      pipe(bx, 0.5, 0, bx, 0.36, 0, pR, M.pipeS, vgSIds[i]);
      box(0.15, 0.13, 0.18, M.valve, bx, 0.3, 0.08, vgSIds[i]);
      pipe(bx, 0.24, 0, bx, 0.18, 0, pR, M.pipeS, bombIds[i]);
      // pump
      cyl(0.22, 0.22, 0.28, 16, bMat, bx, 0.14, 0, 0, 0, 0, bombIds[i]);
      cyl(0.14, 0.1, 0.12, 12, M.pump, bx, 0.01, 0, 0, 0, 0, bombIds[i]);
      box(0.32, 0.06, 0.28, M.pump, bx, -0.01, 0, bombIds[i]);
      cyl(0.14, 0.14, 0.38, 16, bMat, bx, 0.36, 0, 0, 0, 0, bombIds[i]);
      cyl(0.06, 0.06, 0.1, 10, M.pump, bx, 0.56, 0, 0, 0, 0, bombIds[i]);
      cyl(0.15, 0.15, 0.04, 16, M.pump, bx, 0.56, 0, 0, 0, 0, bombIds[i]);
      pipe(bx, 0.27, 0, bx, 0.5, 0, pRi, M.pipeI, vrdIds[i]);
      cyl(0.08, 0.08, 0.12, 10, M.check, bx, 0.54, 0, 0, 0, 0, vrdIds[i]);
      sphere(0.08, 8, M.check, bx, 0.6, 0, vrdIds[i]);
      pipe(bx, 0.66, 0, bx, 1.1, 0, pRi, M.pipeI, vrdIds[i]);
      elbow(bx, 1.1, 0, pRi, M.manifI, vrdIds[i]);
      pipe(bx, 1.1, 0, 0, 1.1, 0, pRi, M.manifI, 'manif_i');
    });

    // soportes de tubería
    [-0.72, 0].forEach((x) => {
      cyl(
        0.025,
        0.025,
        0.5,
        8,
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.4 }),
        x,
        0.25,
        0,
        0,
        0,
        0,
        x === -0.72 ? 'manif_s' : 'manif_i',
      );
      box(
        0.12,
        0.02,
        0.12,
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 }),
        x,
        0.02,
        0,
        x === -0.72 ? 'manif_s' : 'manif_i',
      );
    });

    const mLen = numBombs === 2 ? 1.5 : 2.1;
    cyl(0.09, 0.09, mLen, 12, M.manifI, 0, 1.1, 0, 0, 0, Math.PI / 2, 'manif_i');
    sphere(0.09, 10, M.manifI, -mLen / 2, 1.1, 0, 'manif_i');
    sphere(0.09, 10, M.manifI, mLen / 2, 1.1, 0, 'manif_i');

    // PSV — con codo visible a manifold
    elbow(0, 1.1, 0, pRi * 0.9, M.manifI, 'psv');
    pipe(0, 1.1, 0, 0, 1.5, 0, pRi * 0.8, M.pipeI, 'psv');
    box(0.12, 0.14, 0.12, M.psv, 0, 1.6, 0, 'psv');
    cyl(0.04, 0.04, 0.18, 8, M.psv, 0, 1.72, 0, 0, 0, 0, 'psv');

    // manometro — con codo
    elbow(0.5, 1.1, 0, 0.04, M.manifI, 'manometro');
    pipe(0.5, 1.1, 0, 0.5, 1.4, 0, 0.025, M.pipeI, 'manometro');
    sphere(0.07, 10, M.gauge, 0.5, 1.46, 0, 'manometro');
    cyl(0.06, 0.06, 0.04, 10, M.gauge, 0.5, 1.46, 0, 0, 0, 0, 'manometro');

    // tanque
    sphere(0.48, 20, M.tank, 2.4, 0.88, 0, 'tank');
    [-0.25, 0.25].forEach((dz) => {
      cyl(0.03, 0.03, 0.5, 8, M.valve, 2.4, 0.3, dz, 0.3, 0, 0, 'tank');
    });
    pipe(1.8, 1.1, 0, 2.1, 1.1, 0, pRi, M.pipeI, 'tank');
    pipe(2.1, 1.1, 0, 2.1, 0.88, 0, pRi, M.pipeI, 'tank');
    pipe(2.1, 0.88, 0, 2.22, 0.88, 0, pRi, M.pipeI, 'tank');
    cyl(0.025, 0.025, 0.12, 8, M.gauge, 2.4, 1.4, 0, 0, 0, 0, 'tank');
    sphere(0.04, 8, M.gauge, 2.4, 1.47, 0, 'tank');

    // presostato control
    pipe(0.9, 1.1, 0, 0.9, 1.38, 0, 0.025, M.pipeI, 'presost_r');
    box(0.12, 0.1, 0.1, M.sensor, 0.9, 1.44, 0, 'presost_r');
    cyl(0.04, 0.04, 0.1, 8, M.sensor, 0.9, 1.54, 0, 0, 0, 0, 'presost_r');

    // valvula salida a red — sin huecos, con bridas
    pipe(mLen / 2, 1.1, 0, mLen / 2 + 0.37, 1.1, 0, pRi, M.pipeI, 'vg_red');
    cyl(0.05, 0.05, 0.02, 12, M.valve, mLen / 2 + 0.37, 1.1, 0, 0, 0, Math.PI / 2, 'vg_red');
    box(0.14, 0.13, 0.13, M.valve, mLen / 2 + 0.44, 1.1, 0, 'vg_red');
    cyl(0.04, 0.04, 0.18, 8, M.valve, mLen / 2 + 0.44, 1.23, 0, 0, 0, 0, 'vg_red');
    cyl(0.05, 0.05, 0.02, 12, M.valve, mLen / 2 + 0.51, 1.1, 0, 0, 0, Math.PI / 2, 'vg_red');
    pipe(mLen / 2 + 0.51, 1.1, 0, 3.6, 1.1, 0, pRi, M.pipeI, 'vg_sal');
    // soporte bajo válvula
    cyl(
      0.02,
      0.02,
      0.45,
      8,
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.4 }),
      mLen / 2 + 0.44,
      0.88,
      0,
      0,
      0,
      0,
      'vg_red',
    );
    box(
      0.1,
      0.02,
      0.1,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 }),
      mLen / 2 + 0.44,
      0.66,
      0,
      'vg_red',
    );
    cyl(0.08, 0.08, 1.0, 10, M.manifI, 3.6, 0.85, 0, 0, 0, 0, 'vg_sal');
    sphere(0.08, 10, M.manifI, 3.6, 1.35, 0, 'vg_sal');
    sphere(0.08, 10, M.manifI, 3.6, 0.35, 0, 'vg_sal');
    [-0.2, 0, 0.2].forEach((dz) => {
      pipe(3.6, 0.9 - dz * 0.22, 0, 3.9, 0.9 - dz * 0.22, 0, 0.025, M.pipeI, 'vg_sal');
      box(0.08, 0.07, 0.07, M.valve, 3.96, 0.9 - dz * 0.22, 0, 'vg_sal');
    });
    // tablero — montado en pared con canalización conectada (antes flotaba)
    // pared de soporte
    box(
      1.05,
      1.55,
      0.08,
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }),
      0,
      2.0,
      0.34,
      'tablero',
    );
    // gabinete principal
    box(0.8, 1.2, 0.25, M.board, 0, 2.0, 0.5, 'tablero');
    // marco metálico
    box(
      0.82,
      1.22,
      0.02,
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.6 }),
      0,
      2.0,
      0.64,
      'tablero',
    );
    box(0.72, 1.1, 0.05, M.boardF, 0, 2.0, 0.65, 'tablero');
    // display LCD
    box(
      0.5,
      0.22,
      0.01,
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0x1e3a5f,
        emissiveIntensity: 0.2,
      }),
      0,
      2.25,
      0.66,
      'tablero',
    );
    [-0.2, 0, 0.2].forEach((dx, i) => {
      const colors = [0x22c55e, 0xf59e0b, 0xef4444];
      const mat2 = new THREE.MeshStandardMaterial({
        color: colors[i],
        emissive: colors[i],
        emissiveIntensity: 0.4,
      });
      cyl(0.03, 0.03, 0.01, 8, mat2, dx, 2.05, 0.66, 0, 0, 0, 'tablero');
    });
    // botonera
    [-0.15, 0, 0.15].forEach((dx) => {
      cyl(
        0.025,
        0.025,
        0.02,
        8,
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 }),
        dx,
        1.85,
        0.66,
        0,
        0,
        0,
        'tablero',
      );
    });
    // manija
    box(
      0.04,
      0.35,
      0.04,
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.8 }),
      0.35,
      2.0,
      0.66,
      'tablero',
    );
    // canalización conectada — vertical del tablero + horizontal en z + bandeja en x a bombas
    box(
      0.06,
      0.62,
      0.06,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 }),
      0,
      1.11,
      0.5,
      'tablero',
    );
    elbow(
      0,
      0.8,
      0.5,
      0.04,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 }),
      'tablero',
    );
    // tramo en Z del tablero a la línea de bombas
    box(
      0.04,
      0.04,
      0.52,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 }),
      0,
      0.8,
      0.25,
      'tablero',
    );
    elbow(
      0,
      0.8,
      0,
      0.04,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 }),
      'tablero',
    );
    // bandeja horizontal en X sobre bombas (conectada)
    const ductLen = Math.max(1.8, ntot * 0.9);
    box(
      ductLen,
      0.06,
      0.08,
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 }),
      0,
      0.8,
      0,
      'tablero',
    );
    bombPos.forEach((bx) => {
      box(
        0.02,
        0.12,
        0.02,
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 }),
        bx,
        0.74,
        0,
        'tablero',
      );
      // bajada corta a cada bomba
      box(
        0.02,
        0.18,
        0.02,
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.6 }),
        bx,
        0.68,
        0,
        'tablero',
      );
    });

    // orbit manual
    const spherical = { theta: Math.PI / 4, phi: Math.PI / 3.5, r: 12 };
    const target = new THREE.Vector3(0, 0.8, 0);
    const updateCamera = () => {
      camera.position.x =
        target.x + spherical.r * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = target.y + spherical.r * Math.cos(spherical.phi);
      camera.position.z =
        target.z + spherical.r * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(target);
    };
    updateCamera();
    // expose view switcher
    viewFnRef.current = (v: string) => {
      const targets: Record<string, typeof spherical> = {
        iso: { theta: Math.PI / 4, phi: Math.PI / 3.8, r: 12 },
        front: { theta: 0, phi: Math.PI / 2.01, r: 11 },
        side: { theta: Math.PI / 2, phi: Math.PI / 2.01, r: 11 },
        top: { theta: Math.PI / 4, phi: 0.1, r: 13 },
        back: { theta: Math.PI, phi: Math.PI / 2.01, r: 11 },
      };
      const end = targets[v] ?? targets.iso;
      const start = { ...spherical };
      let step = 0;
      const steps = 30;
      const dur = 600;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const iv = setInterval(() => {
        step++;
        const t = ease(step / steps);
        spherical.theta = start.theta + (end.theta - start.theta) * t;
        spherical.phi = start.phi + (end.phi - start.phi) * t;
        spherical.r = start.r + (end.r - start.r) * t;
        updateCamera();
        if (step >= steps) clearInterval(iv);
      }, dur / steps);
    };

    let isDown = false;
    let prevX = 0,
      prevY = 0;
    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      isDown = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) {
        // hover label handled separately
        return;
      }
      const dx = (e.clientX - prevX) * 0.005;
      const dy = (e.clientY - prevY) * 0.005;
      spherical.theta -= dx;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.05, spherical.phi + dy));
      prevX = e.clientX;
      prevY = e.clientY;
      updateCamera();
    };
    const onWheel = (e: WheelEvent) => {
      spherical.r = Math.max(2, Math.min(22, spherical.r + e.deltaY * 0.01));
      updateCamera();
      e.preventDefault();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // raycaster for click/hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const labelEl = document.getElementById('ep-label3d');
    let downPos = { x: 0, y: 0 };
    const onMouseDownPos = (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUpPick = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - downPos.x),
        dy = Math.abs(e.clientY - downPos.y);
      if (dx > 5 || dy > 5) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(allMeshes);
      if (hits.length && (hits[0].object.userData as { compId?: string }).compId) {
        selectComp((hits[0].object.userData as { compId: string }).compId);
      } else if (selectedIdRef.current) {
        // click en vacío deselecciona — antes solo se podía desde el panel
        const meshes = meshesRef.current;
        const map = matsOrig.current;
        const cur = selectedIdRef.current;
        meshes
          .filter((m) => (m.userData as { compId?: string }).compId === cur)
          .forEach((m) => {
            const orig = map.get(m.uuid);
            if (orig) (m as THREE.Mesh).material = orig;
          });
        setSelectedId(null);
      }
    };
    const onHover = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(allMeshes);
      if (labelEl) {
        if (hits.length && (hits[0].object.userData as { compId?: string }).compId) {
          const comp = COMPS.find(
            (c) => c.id === (hits[0].object.userData as { compId: string }).compId,
          );
          if (comp) {
            labelEl.style.display = 'block';
            labelEl.style.left = e.clientX - rect.left + 14 + 'px';
            labelEl.style.top = e.clientY - rect.top - 10 + 'px';
            labelEl.textContent = comp.name;
          }
        } else labelEl.style.display = 'none';
      }
    };
    canvas.addEventListener('mousedown', onMouseDownPos);
    canvas.addEventListener('mouseup', onMouseUpPick);
    canvas.addEventListener('mousemove', onHover);

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
    const animate = () => {
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDownPos);
      canvas.removeEventListener('mouseup', onMouseUpPick);
      canvas.removeEventListener('mousemove', onHover);
      renderer.dispose();
      allMeshes.forEach((m) => {
        (m.geometry as THREE.BufferGeometry).dispose();
      });
      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCistern, ntot, nt]);

  // filtered comps for sidebar
  const showIds = new Set<string>([
    'acometida',
    'vg_ent',
    'filtro',
    'presost_s',
    'manif_s',
    ...Array.from({ length: ntot }, (_, i) => `vg_s${i + 1}`),
    ...Array.from({ length: ntot }, (_, i) => `b${i + 1}`),
    ...Array.from({ length: ntot }, (_, i) => `vrd${i + 1}`),
    'manif_i',
    'psv',
    'manometro',
    'tank',
    'presost_r',
    'vg_red',
    'tablero',
    ...(hasCistern ? ['cisterna'] : []),
    'vg_sal',
  ]);
  const visible = COMPS.filter((c) => showIds.has(c.id));
  const selected = COMPS.find((c) => c.id === selectedId) ?? null;

  const cfgLabel = hasCistern ? `Cisterna · ${nt}T+${nr}R` : `${nt}T+${nr}R · Succión directa`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flex: 1,
        minHeight: 0,
        maxHeight: '100%',
        background: 'var(--bg)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
      }}
    >
      {/* header — compacto */}
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
        <span style={{ fontWeight: 800, fontSize: 11, color: 'var(--acc)' }}>CIVILFLOW</span>
        <span style={{ fontSize: 10, color: 'var(--txt3)' }}>· Esquema 3D EPC</span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 9,
            fontWeight: 600,
            background: 'var(--acc)',
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 10,
          }}
        >
          {cfgLabel}
        </span>
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
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 520, maxHeight: 620, overflow: 'hidden' }}>
        {/* sidebar — grilla 2-col; nombres completos en una línea, sin subtítulo, sin scroll */}
        <div
          style={{
            width: 420,
            background: '#161b27',
            borderRight: '1px solid #2a3348',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            alignSelf: 'stretch',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: 9,
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              borderBottom: '1px solid #2a3348',
              flexShrink: 0,
            }}
          >
            Componentes del sistema
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 5,
              padding: 6,
              overflow: 'hidden',
              alignContent: 'start',
              flex: 1,
              minHeight: 0,
            }}
          >
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectComp(c.id)}
                title={`${c.name} — ${c.desc}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: selectedId === c.id ? 'rgba(59,130,246,.18)' : '#1e2535',
                  border: `1px solid ${selectedId === c.id ? '#3b82f6' : '#2a3348'}`,
                  borderRadius: 6,
                  color: '#e2e8f0',
                }}
              >
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: selectedId === c.id ? '#3b82f6' : '#0f1117',
                    border: '1px solid #2a3348',
                    fontSize: 11,
                    fontWeight: 700,
                    color: selectedId === c.id ? '#fff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  {c.num}
                </span>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.25 }}
                  >
                    {c.name}
                  </div>
                </span>
              </button>
            ))}
          </div>
          <div
            style={{
              borderTop: '1px solid #2a3348',
              padding: '6px 10px',
              background: '#1e2535',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#60a5fa',
                marginBottom: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selected ? selected.name : '—'}
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#94a3b8',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {selected ? selected.desc : 'Selecciona un componente para ver su descripción.'}
            </div>
          </div>
        </div>

        {/* canvas — fondo blanco, todo el dibujo visible sin scroll, sin estirar (contain) */}
        <div
          ref={wrapRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#ffffff',
            minHeight: 0,
          }}
        >
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          <div
            id="ep-label3d"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              display: 'none',
              background: 'rgba(255,255,255,.95)',
              border: '1px solid #3b82f6',
              color: '#1e40af',
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 5,
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            }}
          />
          <div
            style={{ position: 'absolute', bottom: 58, left: 10, fontSize: 9, color: '#94a3b8' }}
          >
            Clic en componente → info · Arrastrar → girar · Scroll → zoom
          </div>
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(255,255,255,.92)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 10px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,.06)',
            }}
          >
            <div
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 6,
              }}
            >
              Convención
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 22, height: 3, background: '#3b82f6', borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#475569' }}>Succión · AC</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 22, height: 3, background: '#f97316', borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#475569' }}>Impulsión · ACS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 14, height: 8, background: '#8b5cf6', borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#475569' }}>Bombeo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 8, background: '#06b6d4', borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#475569' }}>Tanque</span>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              display: 'flex',
              gap: 2,
              padding: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            }}
          >
            {(['iso', 'front', 'side', 'top'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setActiveView(v);
                  viewFnRef.current(v);
                }}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeView === v ? '#3b82f6' : 'transparent',
                  color: activeView === v ? '#fff' : '#6b7280',
                }}
              >
                {v === 'iso'
                  ? 'Isométrico'
                  : v === 'front'
                    ? 'Frontal'
                    : v === 'side'
                      ? 'Lateral'
                      : 'Planta'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
