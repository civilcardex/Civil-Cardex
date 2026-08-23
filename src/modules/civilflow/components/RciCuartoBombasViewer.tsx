/* eslint-disable react-hooks/refs, react-hooks/immutability */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

type Comp = { n: number; nm: string; x: number; y: number; z: number };

// 26 componentes — alturas corregidas según isométrico NFPA 20
const COMP: Comp[] = [
  { n: 1, nm: 'Válvula compuerta OS&Y (control succión)', x: -3.2, y: 0.5, z: 0 },
  { n: 2, nm: 'Reductor excéntrico', x: -2.5, y: 0.5, z: 0 },
  { n: 3, nm: 'Mano-vacuómetro de succión', x: -1.9, y: 1.05, z: 0 },
  { n: 4, nm: 'Manómetro de descarga', x: -0.9, y: 1.6, z: 0.35 },
  { n: 5, nm: 'Válvula automática de liberación de aire', x: -1.0, y: 2.1, z: 0 },
  { n: 6, nm: 'Válvula de alivio', x: -0.5, y: 1.1, z: -0.6 },
  { n: 7, nm: 'Cono de descarga', x: -1.0, y: 1.35, z: 0 },
  { n: 8, nm: 'Válvula check a la descarga de la bomba', x: 0.5, y: 3.2, z: 0 },
  { n: 9, nm: 'Válvula mariposa en cabezal de pruebas', x: -3.6, y: 3.0, z: -1.6 },
  { n: 10, nm: 'Cabezal de pruebas', x: -4.3, y: 3.0, z: -1.6 },
  { n: 11, nm: 'Válvula mariposa control descarga', x: 2.2, y: 3.2, z: 0 },
  { n: 12, nm: 'Caudalímetro', x: -2.7, y: 3.0, z: -1.6 },
  { n: 13, nm: 'Válvula mariposa en caudalímetro', x: -2.0, y: 3.0, z: -1.6 },
  { n: 14, nm: 'Controlador bomba contra incendio', x: 1.2, y: 2.0, z: -2.2 },
  { n: 15, nm: 'Controlador bomba jockey', x: 0.0, y: 2.0, z: -2.2 },
  { n: 16, nm: 'Línea sensor presión bomba CI', x: 2.0, y: 3.6, z: -1.1 },
  { n: 17, nm: 'Línea sensor presión bomba jockey', x: 0.5, y: 3.6, z: -1.1 },
  { n: 18, nm: 'Bomba jockey', x: -2.0, y: 0.4, z: 1.5 },
  { n: 19, nm: 'Válvula aislamiento succión jockey', x: -3.0, y: 0.4, z: 1.5 },
  { n: 20, nm: 'Válvula check descarga jockey', x: -1.4, y: 0.4, z: 1.5 },
  { n: 21, nm: 'Válvula aislamiento descarga jockey', x: -0.8, y: 0.4, z: 1.5 },
  { n: 22, nm: 'Válvula check conexión bomberos', x: 3.2, y: 0.5, z: 2.2 },
  { n: 23, nm: 'Conexión para bomberos', x: 4.0, y: 0.7, z: 2.2 },
  { n: 24, nm: 'Tanque de combustible', x: 4.2, y: 1.2, z: -1.2 },
  { n: 25, nm: 'Tubería escape gases motor', x: 1.6, y: 2.8, z: -0.5 },
  { n: 26, nm: 'Baterías', x: 0.6, y: 0.25, z: 0.9 },
];

type ViewName = 'planta' | 'frente' | 'lateral' | 'iso';
const VIEW_PRESETS: Record<ViewName, { t: number; p: number }> = {
  planta: { t: 0, p: 0.05 },
  frente: { t: 0, p: Math.PI / 2 },
  lateral: { t: Math.PI / 2, p: Math.PI / 2 },
  iso: { t: Math.PI / 4.5, p: Math.PI / 3.4 },
};

export default function RciCuartoBombasViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ n: number; nm: string; x: number; y: number } | null>(
    null,
  );
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [activeView, setActiveView] = useState<ViewName>('iso');

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sph: { r: number; t: number; p: number };
    target: THREE.Vector3;
    labelData: { v: THREE.Vector3; el: HTMLDivElement }[];
    animId: number;
    W: number;
    H: number;
  } | null>(null);

  const selectedRef = useRef<number | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const handleSelect = useCallback((n: number, clientX?: number, clientY?: number) => {
    if (selectedRef.current === n) {
      setSelected(null);
      setTooltip(null);
      return;
    }
    setSelected(n);
    const comp = COMP.find((c) => c.n === n);
    if (comp && clientX != null && clientY != null) {
      setTooltip({ n: comp.n, nm: comp.nm, x: clientX, y: clientY });
      if (clientX < 0) setTimeout(() => setTooltip(null), 2500);
    } else if (comp) {
      setTooltip({ n: comp.n, nm: comp.nm, x: -1, y: -1 });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const labelLayer = labelLayerRef.current;
    if (!canvas || !container || !labelLayer) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x0f1117, 1);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(8, 14, 6);
    dl.castShadow = true;
    scene.add(dl);
    const fl = new THREE.DirectionalLight(0x8899bb, 0.35);
    fl.position.set(-6, 4, -6);
    scene.add(fl);
    {
      const grid = new THREE.GridHelper(
        20,
        20,
        0x1e2535 as unknown as number,
        0x1e2535 as unknown as number,
      );
      const gm = grid.material as THREE.Material & { opacity?: number; transparent?: boolean };
      gm.opacity = 0.35;
      gm.transparent = true;
      scene.add(grid);
    }

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);

    // --- materiales (paleta del isométrico) ---
    const PI2 = Math.PI / 2;
    const Mpipe = new THREE.MeshPhongMaterial({ color: 0xb03030, shininess: 55 }); // tubería rojo CI
    const Msuct = new THREE.MeshPhongMaterial({ color: 0x3a3f4a, shininess: 45 }); // succión gris oscuro
    const Mfit = new THREE.MeshPhongMaterial({ color: 0xd97a2b, shininess: 70 }); // fittings naranja/cobre
    const Mblue = new THREE.MeshPhongMaterial({ color: 0x2f5fd0, shininess: 80 }); // válvulas azules
    const Mwheel = new THREE.MeshPhongMaterial({ color: 0xc0392b, shininess: 60 }); // volantes rojos
    const Msteel = new THREE.MeshPhongMaterial({ color: 0xb9c2cc, shininess: 120 }); // plateado
    const Mgray = new THREE.MeshPhongMaterial({ color: 0x6b7280, shininess: 50 });
    const Mdark = new THREE.MeshLambertMaterial({ color: 0x232a38 });
    const Mslab = new THREE.MeshLambertMaterial({ color: 0x2e3646 });
    const MpumpRed = new THREE.MeshPhongMaterial({ color: 0xc22a2a, shininess: 70 }); // carcaza bomba
    const Mpanel = new THREE.MeshPhongMaterial({ color: 0xb02020, shininess: 45 }); // controladores rojos
    const MpanelDark = new THREE.MeshPhongMaterial({ color: 0x1a1f2b, shininess: 30 });
    const Mbat = new THREE.MeshPhongMaterial({ color: 0x14181f, shininess: 20 });
    const Myel = new THREE.MeshBasicMaterial({ color: 0xf5d327 }); // flechas de flujo
    const Mgn = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const Mfuel = new THREE.MeshPhongMaterial({ color: 0x9aa4ae, shininess: 100 });
    const Mbrass = new THREE.MeshPhongMaterial({ color: 0xc9973a, shininess: 110 }); // latón para FDC

    const mg = new THREE.Group();
    scene.add(mg);

    function bx(
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      mg.add(m);
      return m;
    }
    function cy(
      rt: number,
      rb: number,
      h: number,
      seg: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      mg.add(m);
      return m;
    }
    const px = (r: number, l: number, mat: THREE.Material, x: number, y: number, z: number) =>
      cy(r, r, l, 14, mat, x, y, z, 0, 0, PI2);
    const py = (r: number, l: number, mat: THREE.Material, x: number, y: number, z: number) =>
      cy(r, r, l, 14, mat, x, y, z, 0, 0, 0);
    const pz = (r: number, l: number, mat: THREE.Material, x: number, y: number, z: number) =>
      cy(r, r, l, 14, mat, x, y, z, PI2, 0, 0);
    const cone = (
      r1: number,
      r2: number,
      h: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0,
    ) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      mg.add(m);
      return m;
    };
    // flecha amarilla de flujo (apunta hacia abajo por defecto)
    const arrowDown = (x: number, y: number, z: number, s = 0.22) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2, 10), Myel);
      m.position.set(x, y, z);
      m.rotation.set(Math.PI, 0, 0);
      mg.add(m);
    };

    // válvula compuerta OS&Y: cuerpo azul + volante rojo en volante superior (eje Y)
    const gateValveY = (r: number, x: number, y: number, z: number) => {
      cy(r * 1.5, r * 1.5, r * 2.2, 12, Mblue, x, y, z, 0, 0, PI2);
      py(r * 0.35, r * 2.2, Msteel, x, y + r * 1.6, z);
      cy(r * 1.1, r * 1.1, r * 0.28, 12, Mwheel, x, y + r * 2.7, z);
    };
    // válvula de mariposa: lenteja + caja + palanca
    const butterflyX = (r: number, x: number, y: number, z: number) => {
      cy(r * 1.35, r * 1.35, r * 0.9, 14, Mblue, x, y, z, 0, 0, 0);
      cy(r * 0.16, r * 0.16, r * 1.6, 8, Msteel, x, y + r * 0.9, z);
      bx(r * 0.3, r * 1.1, r * 0.12, Mwheel, x, y + r * 1.5, z);
    };
    // manómetro: tubito + gauge circular
    const gauge = (x: number, y: number, z: number, stem = 0.3) => {
      py(0.025, stem, Msteel, x, y + stem / 2, z);
      cy(0.11, 0.11, 0.05, 14, MpanelDark, x, y + stem + 0.08, z, PI2, 0, 0);
      cy(0.08, 0.08, 0.02, 14, Mgn, x, y + stem + 0.08, z + 0.028, PI2, 0, 0);
    };

    // ================= LOSA + BASE =================
    bx(12, 0.15, 9, Mslab, 0, -0.075, 0);
    bx(2.6, 0.3, 1.6, Mgray, -0.8, 0.15, 0); // base de bombas

    // ================= SUCCIÓN PRINCIPAL (y≈0.5) =================
    // entrada vertical desde tanque subterráneo
    py(0.16, 1.0, Msuct, -4.5, 0.0, 0);
    arrowDown(-4.5, -0.7, 0);
    cy(0.16, 0.16, 0.32, 14, Mfit, -4.5, 0.5, 0, PI2, 0, 0); // codo a horizontal
    px(0.16, 1.3, Msuct, -3.85, 0.5, 0);
    // 1: OS&Y
    gateValveY(0.17, -3.2, 0.5, 0);
    px(0.16, 0.8, Msuct, -2.5, 0.5, 0);
    // 2: reductor excéntrico
    cone(0.16, 0.11, 0.5, Mfit, -2.1, 0.5, 0, 0, PI2);
    px(0.11, 0.5, Msuct, -1.7, 0.5, 0);
    // 3: mano-vacuómetro
    gauge(-1.9, 0.6, 0, 0.45);
    // tramo a bomba
    cy(0.11, 0.11, 0.22, 14, Mfit, -1.5, 0.5, 0, PI2, 0, 0);
    px(0.11, 0.5, Msuct, -1.3, 0.5, 0);

    // ================= BOMBA PRINCIPAL =================
    cy(0.24, 0.24, 0.55, 18, MpumpRed, -1.0, 0.55, 0, 0, 0, PI2); // voluta
    cy(0.28, 0.28, 0.12, 18, Mgray, -0.72, 0.55, 0, 0, 0, PI2); // acople
    cy(0.2, 0.2, 0.9, 16, Msteel, -0.15, 0.55, 0, 0, 0, PI2); // motor
    cy(0.22, 0.22, 0.1, 16, Mdark, 0.35, 0.55, 0, 0, 0, PI2); // tapa motor
    // 7: cono de descarga — sube desde la voluta
    cone(0.13, 0.22, 0.6, Mfit, -1.0, 0.95, 0);

    // ================= DESCARGA: SUBIDA VERTICAL → CABEZAL ALTO (y=3.2) =================
    // subida vertical desde el cono hasta y=3.2
    py(0.13, 1.85, Mpipe, -1.0, 2.05, 0);
    // 5: válvula liberación de aire (sobre la subida)
    cy(0.07, 0.07, 0.16, 10, Mblue, -1.0, 2.1, 0);
    cy(0.05, 0.05, 0.1, 10, Msteel, -1.0, 2.23, 0);
    // 4: manómetro descarga (junto al cono)
    gauge(-0.9, 1.4, 0.35, 0.25);
    // codo a horizontal alto
    cy(0.13, 0.13, 0.26, 14, Mfit, -1.0, 3.15, 0, PI2, 0, 0);
    // cabezal horizontal alto y=3.2
    px(0.14, 5.5, Mpipe, 1.75, 3.2, 0);
    // 8: check descarga (en cabezal alto)
    cy(0.24, 0.24, 0.35, 14, Mblue, 0.5, 3.2, 0, 0, 0, PI2);
    py(0.06, 0.4, Msteel, 0.5, 3.6, 0);
    cy(0.14, 0.14, 0.06, 12, Mwheel, 0.5, 3.82, 0);
    // 11: mariposa control descarga (en cabezal alto)
    butterflyX(0.17, 2.2, 3.2, 0);
    // codo bajada derecha (x=4.5)
    cy(0.14, 0.14, 0.28, 14, Mfit, 4.5, 3.15, 0, PI2, 0, 0);
    py(0.14, 2.65, Mpipe, 4.5, 1.8, 0); // baja a y=0.5
    // 6: válvula de alivio — bypass retorno a succión
    py(0.05, 0.3, Mpipe, -0.8, 1.2, -0.4);
    cy(0.09, 0.09, 0.2, 12, Mblue, -0.8, 1.4, -0.55, 0, 0, PI2);
    py(0.05, 0.35, Msteel, -0.8, 1.6, -0.55);
    cy(0.1, 0.1, 0.06, 12, Mwheel, -0.8, 1.8, -0.55);
    pz(0.05, 0.5, Mpipe, -0.8, 0.5, -0.8); // retorno a succión

    // ================= RAMA CONEXIÓN BOMBEROS (z≈2.2) =================
    // del descendente derecho, codo a +z
    cy(0.14, 0.14, 0.28, 14, Mfit, 4.5, 0.5, 0, 0, 0, PI2);
    pz(0.14, 2.2, Mpipe, 4.5, 0.5, 1.1);
    cy(0.14, 0.14, 0.28, 14, Mfit, 4.5, 0.5, 2.25, 0, 0, PI2);
    // 22: check conexión bomberos
    cy(0.2, 0.2, 0.3, 14, Mblue, 3.2, 0.5, 2.2, 0, 0, PI2);
    px(0.14, 0.9, Mpipe, 3.65, 0.5, 2.2);
    // 23: conexión para bomberos (siamesa)
    cy(0.14, 0.14, 0.25, 12, Mbrass, 4.0, 0.6, 2.2);
    cy(0.09, 0.09, 0.3, 10, Msteel, 3.92, 0.9, 2.2, 0.35, 0, 0.2);
    cy(0.09, 0.09, 0.3, 10, Msteel, 4.08, 0.9, 2.2, -0.35, 0, -0.2);
    cy(0.11, 0.11, 0.06, 10, Mwheel, 3.88, 1.07, 2.14, 0.35, 0, 0.2);
    cy(0.11, 0.11, 0.06, 10, Mwheel, 4.12, 1.07, 2.26, -0.35, 0, -0.2);
    py(0.14, 0.3, Mpipe, 4.0, 0.25, 2.2);
    arrowDown(4.0, -0.05, 2.2);

    // ================= RAMA CABEZAL DE PRUEBAS (y=3.0, z=-1.6) =================
    // rama desde cabezal alto hacia -z
    cy(0.09, 0.09, 0.2, 12, Mfit, -1.0, 3.2, -0.15, PI2, 0, 0);
    pz(0.09, 1.45, Mpipe, -1.0, 3.2, -0.88);
    // codo a horizontal -x a y=3.0
    cy(0.09, 0.09, 0.2, 12, Mfit, -1.0, 3.0, -1.6, 0, 0, PI2);
    px(0.09, 1.0, Mpipe, -1.5, 3.0, -1.6);
    // 13: mariposa en caudalímetro
    butterflyX(0.12, -2.0, 3.0, -1.6);
    // 12: caudalímetro
    cy(0.17, 0.17, 0.7, 14, Msteel, -2.7, 3.0, -1.6, 0, 0, PI2);
    py(0.04, 0.3, Msteel, -2.7, 3.25, -1.6);
    cy(0.1, 0.1, 0.05, 12, MpanelDark, -2.7, 3.42, -1.6, PI2, 0, 0);
    px(0.09, 0.9, Mpipe, -3.5, 3.0, -1.6);
    // 9: mariposa cabezal pruebas
    butterflyX(0.13, -3.6, 3.0, -1.6);
    px(0.09, 0.7, Mpipe, -4.2, 3.0, -1.6);
    // 10: cabezal de pruebas (caja con bocas de dren)
    bx(0.35, 0.3, 0.35, Mgray, -4.3, 3.0, -1.6);
    py(0.06, 0.45, Mpipe, -4.38, 2.65, -1.52);
    py(0.06, 0.45, Mpipe, -4.22, 2.65, -1.68);
    py(0.09, 0.7, Mpipe, -4.3, 2.25, -1.6);
    arrowDown(-4.3, 1.8, -1.6);

    // ================= BOMBA JOCKEY (z≈1.5, y≈0.4) =================
    // succión jockey: rama desde succión principal hacia +z
    py(0.07, 0.3, Msuct, -3.0, 0.35, 0.75);
    cy(0.07, 0.07, 0.14, 12, Mfit, -3.0, 0.4, 0.92, PI2, 0, 0);
    px(0.07, 0.6, Msuct, -2.7, 0.4, 1.5);
    // 19: aislamiento succión jockey
    gateValveY(0.08, -3.0, 0.4, 1.5);
    px(0.06, 0.7, Msuct, -2.5, 0.4, 1.5);
    // 18: bomba jockey
    cy(0.13, 0.13, 0.35, 14, MpumpRed, -2.0, 0.4, 1.5, 0, 0, PI2);
    cy(0.11, 0.11, 0.45, 12, Msteel, -1.65, 0.4, 1.5, 0, 0, PI2);
    bx(0.7, 0.08, 0.5, Mdark, -1.85, 0.1, 1.5);
    // 20: check descarga jockey
    cy(0.12, 0.12, 0.22, 12, Mblue, -1.4, 0.4, 1.5, 0, 0, PI2);
    px(0.06, 0.5, Mpipe, -1.05, 0.4, 1.5);
    // 21: aislamiento descarga jockey
    gateValveY(0.09, -0.8, 0.4, 1.5);
    px(0.06, 0.5, Mpipe, -0.4, 0.4, 1.5);
    // sube y se une a descarga principal (codo al cabezal alto)
    py(0.06, 0.3, Mpipe, -0.2, 0.55, 1.5);
    cy(0.06, 0.06, 0.14, 10, Mfit, -0.2, 0.7, 1.5, PI2, 0, 0);
    pz(0.06, 1.5, Mpipe, -0.2, 0.7, 0.75);
    cy(0.06, 0.06, 0.14, 10, Mfit, -0.2, 0.7, 0.05, PI2, 0, 0);
    py(0.06, 2.5, Mpipe, -0.2, 2.0, 0.05); // sube al cabezal alto

    // ================= CONTROLADORES (en rack, y≈2.0) =================
    // 14: controlador bomba CI (grande)
    bx(0.75, 1.3, 0.4, Mpanel, 1.2, 2.0, -2.2);
    bx(0.6, 0.35, 0.06, MpanelDark, 1.2, 2.4, -1.98);
    cy(0.03, 0.03, 0.04, 8, Mgn, 1.05, 2.55, -1.97, PI2, 0, 0);
    cy(0.03, 0.03, 0.04, 8, Myel, 1.35, 2.55, -1.97, PI2, 0, 0);
    bx(0.12, 1.3, 0.12, Mdark, 0.88, 1.0, -2.2); // pata izq
    bx(0.12, 1.3, 0.12, Mdark, 1.52, 1.0, -2.2); // pata der
    // 15: controlador jockey (pequeño)
    bx(0.5, 0.9, 0.35, Mpanel, 0.0, 2.0, -2.2);
    bx(0.38, 0.25, 0.05, MpanelDark, 0.0, 2.25, -2.01);
    bx(0.1, 0.9, 0.1, Mdark, -0.18, 1.55, -2.2); // pata

    // líneas sensoras (tubería fina):
    // 16: desde cabezal alto hasta controlador CI
    py(0.022, 0.6, Mpipe, 2.0, 3.5, -0.5);
    pz(0.022, 1.5, Mpipe, 2.0, 3.8, -1.25);
    px(0.022, 0.8, Mpipe, 1.6, 3.8, -2.2);
    py(0.022, 0.8, Mpipe, 1.2, 3.4, -2.2);
    // 17: desde jockey hasta controlador jockey
    py(0.022, 0.3, Mpipe, 0.5, 0.7, 0.5);
    py(0.022, 3.1, Mpipe, 0.5, 2.3, -1.0);
    pz(0.022, 1.0, Mpipe, 0.5, 3.6, -1.5);
    px(0.022, 0.5, Mpipe, 0.25, 3.6, -2.2);
    py(0.022, 0.8, Mpipe, 0.0, 3.2, -2.2);

    // ================= TANQUE COMBUSTIBLE (x≈4.2, y≈1.2) =================
    // 24: tanque cilíndrico horizontal sobre patas
    cy(0.55, 0.55, 1.9, 20, Mfuel, 4.2, 1.2, -1.2, 0, 0, PI2);
    cy(0.56, 0.56, 0.06, 20, Mgray, 3.23, 1.2, -1.2, 0, 0, PI2);
    cy(0.56, 0.56, 0.06, 20, Mgray, 5.17, 1.2, -1.2, 0, 0, PI2);
    bx(0.08, 0.7, 0.08, Mdark, 3.6, 0.35, -1.2);
    bx(0.08, 0.7, 0.08, Mdark, 4.8, 0.35, -1.2);
    // boquilla de llenado
    py(0.06, 0.2, Msteel, 4.2, 1.88, -1.2);

    // ================= ESCAPE DE GASES (25) =================
    // del motor sube con silenciador
    py(0.09, 0.8, Msteel, 0.35, 1.0, 0);
    cy(0.09, 0.09, 0.2, 12, Mfit, 0.35, 1.5, -0.1, PI2 / 4, 0, 0);
    cy(0.16, 0.16, 0.8, 14, Msteel, 1.0, 2.3, -0.35, Math.PI / 4, 0, -Math.PI / 4);
    py(0.09, 0.5, Msteel, 1.5, 2.8, -0.7);
    pz(0.09, 0.5, Msteel, 1.5, 2.8, -1.0);
    px(0.09, 2.5, Msteel, 2.75, 2.8, -1.0);
    py(0.09, 0.5, Msteel, 3.85, 2.55, -1.0);
    // paraguas
    cy(0.16, 0.02, 0.1, 12, Msteel, 3.85, 2.85, -1.0);

    // ================= BATERÍAS (26) =================
    bx(0.55, 0.3, 0.35, Mbat, 0.6, 0.25, 0.9);
    bx(0.55, 0.25, 0.35, Mbat, 0.6, 0.53, 0.9);
    cy(0.02, 0.02, 0.05, 8, Mfit, 0.45, 0.68, 0.85);
    cy(0.02, 0.02, 0.05, 8, Mfit, 0.75, 0.68, 0.85);

    // ================= ETIQUETAS =================
    const labelData: { v: THREE.Vector3; el: HTMLDivElement }[] = [];
    labelLayer.innerHTML = '';
    COMP.forEach((c) => {
      const v = new THREE.Vector3(c.x, c.y, c.z);
      const el = document.createElement('div');
      el.className = 'rci-lbl';
      el.dataset.n = String(c.n);
      el.innerHTML = `<span class="rci-ld"></span><span class="rci-chip">${c.n}</span>`;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handleSelect(c.n, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
      });
      labelLayer.appendChild(el);
      labelData.push({ v, el });
    });

    const sph = { r: 14, t: Math.PI / 4.5, p: Math.PI / 3.4 };
    const target = new THREE.Vector3(0, 1.8, 0);
    const updateCamera = () => {
      camera.position.set(
        target.x + sph.r * Math.sin(sph.p) * Math.sin(sph.t),
        target.y + sph.r * Math.cos(sph.p),
        target.z + sph.r * Math.sin(sph.p) * Math.cos(sph.t),
      );
      camera.lookAt(target);
    };
    updateCamera();

    let W = 800;
    let H = 600;
    const onResize = () => {
      W = container.clientWidth;
      H = container.clientHeight;
      canvas.width = W;
      canvas.height = H;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      if (threeRef.current) {
        threeRef.current.W = W;
        threeRef.current.H = H;
      }
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    onResize();

    // controles órbita/pan/zoom (igual que antes)
    let isDrag = false;
    let isPan = false;
    const prev = { x: 0, y: 0 };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isDrag = true;
      if (e.button === 2) isPan = true;
      prev.x = e.clientX;
      prev.y = e.clientY;
    };
    const onMouseUp = () => {
      isDrag = false;
      isPan = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (isDrag) {
        sph.t -= dx * 0.008;
        sph.p = Math.max(0.05, Math.min(Math.PI - 0.05, sph.p + dy * 0.008));
        updateCamera();
      }
      if (isPan) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
        target.addScaledVector(right, -dx * 0.03);
        target.addScaledVector(camera.up, dy * 0.03);
        updateCamera();
      }
      prev.x = e.clientX;
      prev.y = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      sph.r = Math.max(3, Math.min(45, sph.r + e.deltaY * 0.02));
      updateCamera();
      e.preventDefault();
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    let pt: { x: number; y: number } | null = null;
    let pp: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) pt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      else if (e.touches.length === 2)
        pp = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && pt) {
        const dx = e.touches[0].clientX - pt.x;
        const dy = e.touches[0].clientY - pt.y;
        sph.t -= dx * 0.008;
        sph.p = Math.max(0.05, Math.min(Math.PI - 0.05, sph.p + dy * 0.008));
        updateCamera();
        pt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (pp != null) {
          sph.r = Math.max(3, Math.min(45, sph.r - (d - pp) * 0.05));
          updateCamera();
        }
        pp = d;
      }
      e.preventDefault();
    };
    const onTouchEnd = () => {
      pt = null;
      pp = null;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    threeRef.current = { renderer, scene, camera, sph, target, labelData, animId: 0, W, H };

    const animate = () => {
      const id = requestAnimationFrame(animate);
      if (threeRef.current) threeRef.current.animId = id;
      renderer.render(scene, camera);
      const w = threeRef.current?.W ?? W;
      const h = threeRef.current?.H ?? H;
      labelData.forEach(({ v, el }) => {
        const p = v.clone().project(camera);
        if (p.z > 1) {
          el.style.display = 'none';
          return;
        }
        el.style.display = 'flex';
        el.style.left = `${(p.x * 0.5 + 0.5) * w}px`;
        el.style.top = `${(-p.y * 0.5 + 0.5) * h}px`;
      });
    };
    animate();

    (container as unknown as Record<string, unknown>).__rci = { sph, target, updateCamera };

    return () => {
      cancelAnimationFrame(threeRef.current?.animId ?? 0);
      ro.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else if (mat) mat.dispose();
      });
    };
  }, [handleSelect]);

  useEffect(() => {
    const layer = labelLayerRef.current;
    if (!layer) return;
    layer.querySelectorAll('.rci-lbl').forEach((el) => {
      const n = Number((el as HTMLElement).dataset.n);
      el.classList.toggle('hl', n === selected);
    });
  }, [selected]);

  const setView = useCallback((name: ViewName) => {
    setActiveView(name);
    const c = containerRef.current as unknown as {
      __rci?: { sph: { t: number; p: number }; updateCamera: () => void };
    } | null;
    const rci = c?.__rci;
    if (!rci) return;
    const v = VIEW_PRESETS[name];
    const st = rci.sph.t;
    const sp = rci.sph.p;
    const t0 = performance.now();
    const animate = (now: number) => {
      const tt = Math.min((now - t0) / 400, 1);
      const e = 1 - Math.pow(1 - tt, 3);
      rci.sph.t = st + (v.t - st) * e;
      rci.sph.p = sp + (v.p - sp) * e;
      rci.updateCamera();
      if (tt < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  const resetView = useCallback(() => {
    const c = containerRef.current as unknown as {
      __rci?: {
        sph: { r: number; t: number; p: number };
        target: THREE.Vector3;
        updateCamera: () => void;
      };
    } | null;
    const rci = c?.__rci;
    if (rci) {
      rci.sph.r = 14;
      rci.sph.t = Math.PI / 4.5;
      rci.sph.p = Math.PI / 3.4;
      rci.target.set(0, 1.8, 0);
      rci.updateCamera();
    }
    setActiveView('iso');
    setSelected(null);
    setTooltip(null);
  }, []);

  const BTN_BASE: React.CSSProperties = {
    height: 26,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
  const btnStyle = (on: boolean): React.CSSProperties => ({
    ...BTN_BASE,
    border: `1px solid ${on ? 'var(--acc, #0ea5e9)' : 'var(--line, #2a3347)'}`,
    background: on ? 'rgba(14,165,233,.12)' : 'var(--surface, #1e2535)',
    color: on ? 'var(--acc, #0ea5e9)' : 'var(--txt3, #64748b)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          padding: '8px 10px',
          background: 'var(--panel, #161b27)',
          border: '1px solid var(--border, #2a3347)',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt, #e2e8f0)' }}>
            Cuarto de Bombas
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 4,
              background: 'var(--tag, #1e3a5f)',
              color: 'var(--tag-text, #7dd3fc)',
              fontWeight: 700,
            }}
          >
            Red CI · NFPA 20 / NSR-10 J
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(['planta', 'frente', 'lateral', 'iso'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={btnStyle(activeView === v)}
            >
              {v === 'planta'
                ? 'Planta'
                : v === 'frente'
                  ? 'Frente'
                  : v === 'lateral'
                    ? 'Lateral'
                    : 'ISO'}
            </button>
          ))}
          <span
            style={{ width: 1, height: 16, background: 'var(--line, #2a3347)', margin: '0 4px' }}
          />
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            title={showLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
            style={{ ...btnStyle(showLabels), width: 28, padding: 0, fontSize: 11 }}
          >
            L
          </button>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            title={showLegend ? 'Ocultar leyenda' : 'Mostrar leyenda'}
            style={{ ...btnStyle(showLegend), width: 28, padding: 0 }}
          >
            ≡
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Restablecer vista"
            style={{ ...btnStyle(false), width: 28, padding: 0 }}
          >
            ↺
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 520, maxHeight: '70vh' }}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#0f1117',
            borderRadius: 8,
            border: '1px solid var(--border, #2a3347)',
            minHeight: 420,
          }}
          onClick={() => {
            setSelected(null);
            setTooltip(null);
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'block',
              cursor: 'grab',
              width: '100%',
              height: '100%',
            }}
          />
          <div
            ref={labelLayerRef}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: showLabels ? 1 : 0,
            }}
          />
          <style>{`.rci-lbl{position:absolute;display:flex;align-items:center;gap:4px;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer}.rci-ld{width:8px;height:8px;border-radius:50%;background:#0ea5e9;border:2px solid rgba(255,255,255,.3);box-shadow:0 0 6px rgba(14,165,233,.6)}.rci-lbl.hl .rci-ld{background:#fff}.rci-chip{background:rgba(15,17,23,.9);border:1px solid #0ea5e9;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:800;color:#0ea5e9;white-space:nowrap;line-height:1}.rci-lbl.hl .rci-chip{background:#3b82f6;border-color:#3b82f6;color:#fff}`}</style>

          {tooltip && tooltip.x >= 0 && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(tooltip.x + 12, 580),
                top: Math.max(tooltip.y - 40, 8),
                background: 'var(--panel, #161b27)',
                border: '1px solid #0ea5e9',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11,
                color: 'var(--txt, #e2e8f0)',
                pointerEvents: 'none',
                zIndex: 5,
                maxWidth: 220,
                boxShadow: '0 8px 24px rgba(0,0,0,.4)',
              }}
            >
              <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 800, marginBottom: 2 }}>
                Comp. {tooltip.n}
              </div>
              <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{tooltip.nm}</div>
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                padding: '4px 10px',
                background: 'rgba(15,17,23,.75)',
                border: '1px solid var(--border, #2a3347)',
                borderRadius: 6,
                fontSize: 10,
                color: '#64748b',
              }}
            >
              Sistema: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Red CI</span>
            </div>
            <div
              style={{
                padding: '4px 10px',
                background: 'rgba(15,17,23,.75)',
                border: '1px solid var(--border, #2a3347)',
                borderRadius: 6,
                fontSize: 10,
                color: '#64748b',
              }}
            >
              Norma: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>NFPA 20 / NSR-10 J</span>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              pointerEvents: 'none',
              background: 'rgba(15,17,23,.6)',
              border: '1px solid var(--border, #2a3347)',
              borderRadius: 6,
              padding: '6px 8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: '#64748b',
              }}
            >
              <span
                style={{
                  padding: '1px 5px',
                  background: '#1e2535',
                  border: '1px solid #2a3347',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                Arrastrar
              </span>
              Rotar
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: '#64748b',
              }}
            >
              <span
                style={{
                  padding: '1px 5px',
                  background: '#1e2535',
                  border: '1px solid #2a3347',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                Scroll
              </span>
              Zoom
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: '#64748b',
              }}
            >
              <span
                style={{
                  padding: '1px 5px',
                  background: '#1e2535',
                  border: '1px solid #2a3347',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                Der.
              </span>
              Mover
            </div>
          </div>
        </div>

        {showLegend && (
          <div
            style={{
              width: 250,
              flexShrink: 0,
              background: 'var(--panel, #161b27)',
              border: '1px solid var(--border, #2a3347)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxHeight: '100%',
            }}
          >
            <div
              style={{
                padding: '10px 12px 8px',
                borderBottom: '1px solid var(--border, #2a3347)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#64748b',
                }}
              >
                Componentes
              </span>
              <span style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 700 }}>{COMP.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {COMP.map((c) => (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={c.n}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelect(c.n, -1, -1);
                  }}
                  onClick={() => handleSelect(c.n, -1, -1)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    borderLeft: `2px solid ${selected === c.n ? '#3b82f6' : 'transparent'}`,
                    background: selected === c.n ? 'rgba(59,130,246,.10)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: selected === c.n ? '#3b82f6' : 'var(--surface, #1e2535)',
                      border: `1px solid ${selected === c.n ? '#3b82f6' : 'var(--border, #2a3347)'}`,
                      fontSize: 9,
                      fontWeight: 800,
                      color: selected === c.n ? '#fff' : '#7dd3fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {c.n}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--txt, #e2e8f0)', lineHeight: 1.3 }}>
                    {c.nm}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{ fontSize: 11, color: 'var(--txt3, #64748b)', lineHeight: 1.5, padding: '0 2px' }}
      >
        Esquema tipo <strong style={{ color: 'var(--txt, #e2e8f0)' }}>cuarto de bombas RCI</strong>{' '}
        según NFPA 20 — 26 componentes numerados. Rotá, acercá y seleccioná para ubicarlos.
      </div>
    </div>
  );
}
