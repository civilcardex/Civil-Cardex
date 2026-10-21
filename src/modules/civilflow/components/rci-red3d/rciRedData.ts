// ── DATOS RED CONTRA INCENDIO (port verbatim del HTML Isometrico_RCI_Open_Code_v19) ──
export interface RciRedLabel {
  pos: [number, number, number];
  scale: number;
  dir: number;
  vdir: number;
  ang: number;
  L1: number;
  L2: number;
  ref?: number;
}

export const COMPONENTS = [
  { id: 1, name: 'Tubería de acero negro', color: '#f85149', detail: null },
  { id: 2, name: 'Rociador automático', color: '#e3b341', detail: 'rociador' },
  { id: 3, name: 'Válvula check (retención)', color: '#388bfd', detail: null },
  { id: 4, name: 'Válvula mariposa', color: '#3fb950', detail: null },
  { id: 5, name: 'Válvula de drenaje y prueba', color: '#58a6ff', detail: null },
  { id: 6, name: 'Purga de aire / alivio de presión', color: '#f0883e', detail: null },
  { id: 7, name: 'Detector de flujo', color: '#00ffff', detail: null },
  { id: 8, name: 'Manómetro', color: '#7d8590', detail: null },
  { id: 9, name: 'Gabinete contra incendio', color: '#d29922', detail: null },
  { id: 10, name: 'Siamesa', color: '#ff6b6b', detail: null },
  { id: 11, name: 'Colgante (hanger)', color: '#a5a5a5', detail: 'colgante' },
  { id: 12, name: 'Soporte sísmico longitudinal', color: '#a5a5a5', detail: 'soporte_long' },
  { id: 13, name: 'Soporte sísmico transversal', color: '#a5a5a5', detail: 'soporte_transv' },
  { id: 14, name: 'Soporte sísmico 4 vías', color: '#a5a5a5', detail: 'soporte_4vias' },
];

export const COMP_DESC: Record<number, { body: string; norm: string }> = {
  1: {
    body: 'Conduce el agua desde la fuente hasta rociadores y gabinetes: riser, matrices y ramales. Su diámetro sale del cálculo hidráulico.',
    norm: 'NTC 2301 · NSR-10 J.4 · ASTM A53 / A795',
  },
  2: {
    body: 'Se abre solo cuando el calor rompe su bulbo o fusible y descarga agua sobre el fuego. Cada uno actúa de forma independiente.',
    norm: 'NTC 2301 · UL 199',
  },
  3: {
    body: 'Deja pasar el agua en un solo sentido e impide que regrese a la fuente o a la siamesa.',
    norm: 'NTC 2301 · NTC 1669 · UL 312',
  },
  4: {
    body: 'Abre o cierra el paso por zona o piso y muestra a la vista su posición. Debe estar supervisada abierta.',
    norm: 'NTC 2301 · UL 1091 · FM 1112',
  },
  5: {
    body: 'Permite vaciar el sistema y probar el flujo y la alarma.',
    norm: 'NTC 2301 · NFPA 25',
  },
  6: {
    body: 'La purga saca el aire atrapado; el alivio descarga el exceso de presión.',
    norm: 'NTC 2301 · NFPA 20 · UL 1478A',
  },
  7: {
    body: 'Detecta el paso de agua y envía la alarma al panel, indicando la zona activada.',
    norm: 'NTC 2301 · NSR-10 J.4 · UL 346',
  },
  8: {
    body: 'Muestra la presión del sistema para verificar que esté cargado.',
    norm: 'NTC 2301 · UL 393',
  },
  9: {
    body: 'Contiene manguera, boquilla y válvula para el ataque manual del fuego.',
    norm: 'NTC 1669 · NSR-10 J.4 · UL 668',
  },
  10: {
    body: 'Toma exterior por donde los bomberos inyectan agua al sistema.',
    norm: 'NTC 1669 · NTC 2301 · UL 405',
  },
  11: {
    body: 'Sostiene el peso de la tubería horizontal desde la estructura. Espaciamiento y diámetro según diseño.',
    norm: 'NTC 2301 cap. 9 (NFPA 13 vigente cap. 17) · UL 203',
  },
  12: {
    body: 'Impide que la tubería se desplace a lo largo de su eje durante un sismo.',
    norm: 'NTC 2301 §9.3 (NFPA 13 vigente cap. 18) · NSR-10 A.9 · UL 203A',
  },
  13: {
    body: 'Impide que la tubería se desplace perpendicularmente a su eje durante un sismo.',
    norm: 'NTC 2301 §9.3 (NFPA 13 vigente cap. 18) · NSR-10 A.9 · UL 203A',
  },
  14: {
    body: 'Restringe el movimiento horizontal y vertical en ambas direcciones durante un sismo; va en la parte superior de los risers.',
    norm: 'NTC 2301 §9.3 (NFPA 13 vigente cap. 18) · NSR-10 A.9 · UL 203A',
  },
};

export const GLB_POSITIONS: Record<string, [number, number, number]> = {
  mamposteria: [-0.017, -1.1, 0.758],
  piso1_bombas: [0.01, -1.1, 0.755],
  red_completa: [0.473, -0.25, 0.17],
  entrepiso: [0.003, 4.1, 0.758],
  cubierta: [0.003, 9.48, 0.758],
};

export const INITIAL_SCALES: Record<string, [number, number, number]> = {
  mamposteria: [3.744, 3.89, 4.563],
  piso1_bombas: [1.0, 1.0, 1.086],
  red_completa: [1.0, 0.87, 1.28],
  entrepiso: [0.999, 1.0, 1.085],
  cubierta: [0.999, 1.0, 1.085],
};

export const SPLIT_BUILDS: Record<
  string,
  {
    mount: [number, number, number];
    wrapperScale?: [number, number, number];
    rot?: [number, number, number];
    parts: Array<{
      sub: string;
      meshes: number[];
      scale: [number, number, number];
      off: [number, number, number];
      bakeY?: number;
    }>;
  }
> = {
  abrazadera_4p: {
    mount: [14.763, 9.11, -4.63],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.021, 0.02, 0.05], off: [0, 0, 0] },
      { sub: 'varilla', meshes: [3, 5], scale: [0.021, 0.085, 0.05], off: [0, -0.23, 0] },
    ],
  },
  abrazadera_4p_h2: {
    mount: [14.763, 9.11, -6.24],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.021, 0.02, 0.05], off: [0, 0, 0] },
      { sub: 'varilla', meshes: [3, 5], scale: [0.021, 0.085, 0.05], off: [0, -0.23, 0] },
    ],
  },
  abrazadera_2p: {
    mount: [13.163, 9.122, -4.449], // tu calibracion del dia
    wrapperScale: [1.12, 0.79, 1.11], // tu escala calibrada del conjunto
    rot: [0, 90, 0], // GIRADA 90 en Y
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.0115, 0.02, 0.0275], off: [0, 0, 0] }, // ~55% de la de 4-pulg (envuelve el tubo de 2)
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.115, 0.028],
        off: [0, -0.724, 0],
        bakeY: -3.39,
      }, // la varilla calibrada (0.389 m - su L)
    ],
  },
  abrazadera_2p_n1: {
    mount: [14.776, 9.121, -1.139], // tu calibracion del dia
    wrapperScale: [1.02, 1.0, 1.0], // tu escala calibrada del conjunto
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.011, 0.02, 0.028], off: [0, 0, 0] },
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.087, 0.028],
        off: [0, -0.534, 0],
        bakeY: -3.39,
      }, // tu calibracion del dia
    ],
  },

  abrazadera_2p_n2: {
    mount: [13.163, 9.122, 0.063], // tu calibracion del dia (Opcion A terminada en 0.063)
    wrapperScale: [1.12, 0.79, 1.11],
    rot: [0, 90, 0],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.011, 0.02, 0.028], off: [0, 0, 0] }, // tu calibracion del dia
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.115, 0.028],
        off: [0, -0.724, 0],
        bakeY: -3.39,
      },
    ],
  },

  abrazadera_4p_inf: {
    mount: [14.763, 3.8, -4.63], // tu calibracion del dia
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.021, 0.02, 0.05], off: [0, 0, 0] },
      { sub: 'varilla', meshes: [3, 5], scale: [0.021, 0.085, 0.05], off: [0, -0.23, 0] },
    ],
  },
  abrazadera_4p_h2_inf: {
    mount: [14.763, 3.8, -6.24], // tu calibracion del dia
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.021, 0.02, 0.05], off: [0, 0, 0] },
      { sub: 'varilla', meshes: [3, 5], scale: [0.021, 0.085, 0.05], off: [0, -0.23, 0] },
    ],
  },
  abrazadera_2p_inf: {
    mount: [13.163, 3.812, -4.449], // tu calibracion del dia
    wrapperScale: [1.12, 0.79, 1.11],
    rot: [0, 90, 0],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.011, 0.02, 0.028], off: [0, 0, 0] },
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.115, 0.028],
        off: [0, -0.724, 0],
        bakeY: -3.39,
      },
    ],
  },
  abrazadera_2p_n1_inf: {
    mount: [14.776, 3.811, -1.139], // tu calibracion del dia
    wrapperScale: [1.02, 1.0, 1.0],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.011, 0.02, 0.028], off: [0, 0, 0] },
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.087, 0.028],
        off: [0, -0.534, 0],
        bakeY: -3.39,
      }, // tu calibracion del dia
    ],
  },
  abrazadera_2p_n2_inf: {
    mount: [13.163, 3.812, 0.063], // tu calibracion del dia
    wrapperScale: [1.12, 0.79, 1.11],
    rot: [0, 90, 0],
    parts: [
      { sub: 'argolla', meshes: [1], scale: [0.011, 0.02, 0.028], off: [0, 0, 0] }, // tu calibracion del dia
      {
        sub: 'varilla',
        meshes: [3, 5],
        scale: [0.011, 0.115, 0.028],
        off: [0, -0.724, 0],
        bakeY: -3.39,
      },
    ],
  },
};

export const LABEL_POSITIONS: Record<string, RciRedLabel> = {
  1: { pos: [14.82, 6.89, -7.048], scale: 0.75, dir: 1, vdir: 0, ang: 35, L1: 25, L2: 60, ref: 1 }, // Tubería acero negro
  '1b': {
    pos: [14.796, 9.147, -1.918],
    scale: 0.75,
    dir: 1,
    vdir: 1,
    ang: 0,
    L1: 35,
    L2: 60,
    ref: 1,
  },
  '1c': {
    pos: [14.97, 7.019, -7.15],
    scale: 0.75,
    dir: 0,
    vdir: 0,
    ang: 30,
    L1: 30,
    L2: 65,
    ref: 1,
  },
  '1d': { pos: [7.07, 9.098, 0.051], scale: 0.75, dir: 1, vdir: 1, ang: 0, L1: 40, L2: 60, ref: 1 },
  2: { pos: [13.749, 9.041, 0.05], scale: 0.75, dir: 1, vdir: 1, ang: 0, L1: 40, L2: 60, ref: 2 }, // Rociador automático (ajustada v8)

  3: { pos: [14.794, 9.087, -6.452], scale: 0.75, dir: 0, vdir: 1, ang: 0, L1: 40, L2: 60, ref: 3 }, // Válvula check (fijada v9)
  4: { pos: [14.79, 9.1, -6.75], scale: 0.75, dir: 0, vdir: 1, ang: 0, L1: 40, L2: 60, ref: 4 }, // Válvula mariposa (fijada v9)
  5: { pos: [15.14, 1.25, -7.09], scale: 0.75, dir: 0, vdir: 0, ang: 25, L1: 40, L2: 60, ref: 5 }, // Válvula de drenaje / purga (fijada v9)
  6: { pos: [14.791, 11.209, -7.09], scale: 0.75, dir: 0, vdir: 0, ang: 0, L1: 40, L2: 60, ref: 6 }, // Purga de aire / alivio (fijada v9)
  7: { pos: [14.79, 9.24, -6.11], scale: 0.75, dir: 1, vdir: 0, ang: 0, L1: 40, L2: 60, ref: 7 }, // Detector de flujo (fijada v10)
  8: {
    pos: [14.829, 10.898, -7.084],
    scale: 0.75,
    dir: 0,
    vdir: 0,
    ang: 30,
    L1: 30,
    L2: 60,
    ref: 8,
  }, // Manómetro (fijada v10)
  9: { pos: [13.67, 6.442, -7.2], scale: 0.75, dir: 0, vdir: 0, ang: 0, L1: 40, L2: 60, ref: 9 }, // Gabinete (fijada v10)
  10: {
    pos: [18.871, -0.715, -8.987],
    scale: 0.75,
    dir: 0,
    vdir: 0,
    ang: 0,
    L1: 40,
    L2: 60,
    ref: 10,
  }, // Siamesa (fijada v11)
  11: {
    pos: [13.157, 9.12, -1.146],
    scale: 0.75,
    dir: 0,
    vdir: 1,
    ang: 0,
    L1: 40,
    L2: 60,
    ref: 11,
  }, // Colgante (fijada v11)
  12: {
    pos: [14.273, 9.119, 0.046],
    scale: 0.75,
    dir: 0,
    vdir: 1,
    ang: 0,
    L1: 40,
    L2: 60,
    ref: 12,
  }, // Soporte sísmico longitudinal (fijada v11)
  13: {
    pos: [14.789, 9.12, -2.509],
    scale: 0.75,
    dir: 0,
    vdir: 1,
    ang: 0,
    L1: 40,
    L2: 60,
    ref: 13,
  }, // Soporte sísmico transversal (fijada v11)
  14: {
    pos: [14.794, 8.556, -6.986],
    scale: 0.75,
    dir: 1,
    vdir: 0,
    ang: 35,
    L1: 30,
    L2: 60,
    ref: 14,
  }, // Soporte sísmico 4 vías (fijada v11)
};

// Pose ISO calibrada del visor principal.
export const ISO_DEFAULT = { pos: [23.967, 4.763, 9.433], tgt: [9.809, 3.883, -5.382] } as const;
