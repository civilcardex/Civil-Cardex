export const APARATOS_DEF = [
  {id:'sif', sigla:'Sif:', nombre:'Sifón', grupo:'h', uc_af:0, uc_ac:0, ud:2, pmin:0, pmax:0, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvm', sigla:'Lvm:', nombre:'Lavamanos', grupo:'h', uc_af:0.5, uc_ac:0.5, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'san', sigla:'Ino:', nombre:'Inodoro', grupo:'h', uc_af:2.2, uc_ac:0, ud:4, pmin:0.71, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvp', sigla:'Lvp:', nombre:'Lavaplatos cocina', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'duc', sigla:'Duc:', nombre:'Ducha', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:1.02, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'tin', sigla:'Tin:', nombre:'Tina', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvra',sigla:'Lvra:', nombre:'Lavadora', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvro',sigla:'Lvro:', nombre:'Lavadero', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'nev', sigla:'Nev:', nombre:'Nevera', grupo:'h', uc_af:0.5, uc_ac:0, ud:0, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'lavav',sigla:'Lavav:', nombre:'Lavavajillas', grupo:'h', uc_af:0, uc_ac:1.5, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'ori', sigla:'Ori:', nombre:'Orinal/Urinal', grupo:'h', uc_af:2.2, uc_ac:0, ud:5, pmin:0.71, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'flu', sigla:'Flu:', nombre:'Sanitario fluxómetro', grupo:'h', uc_af:6.0, uc_ac:0, ud:6, pmin:0.71, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'est4', sigla:'Est:', nombre:'Estufa 4 quemadores', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.35, norma:'NTC 3728 T1'},
  {id:'est2', sigla:'Est2:', nombre:'Estufa 2 quemadores', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:0.68, norma:'NTC 3728 T1'},
  {id:'hor_g',sigla:'Hor:', nombre:'Horno grande', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.15, norma:'NTC 3728 T1'},
  {id:'hor_m',sigla:'HorM:', nombre:'Horno mediano', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:0.81, norma:'NTC 3728 T1'},
  {id:'hor_p',sigla:'HorP:', nombre:'Horno pequeño', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:0.54, norma:'NTC 3728 T1'},
  {id:'sec_g',sigla:'SecG:', nombre:'Secadora grande', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:0.81, norma:'NTC 3728 T1'},
  {id:'sec_p',sigla:'SecP:', nombre:'Secadora pequeña', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:0.54, norma:'NTC 3728 T1'},
  {id:'cal_b',sigla:'Cal:', nombre:'Caldera pequeña', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.76, norma:'NTC 3728 T1'},
  {id:'cal6', sigla:'Cal6:', nombre:'Calentador P.D. 6 LPM', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.11, norma:'NTC 3728 T1'},
  {id:'cal11',sigla:'Cal11:',nombre:'Calentador P.D. 11 LPM',grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.88, norma:'NTC 3728 T1'},
  {id:'cal21',sigla:'Cal21:',nombre:'Calentador P.D. 21 LPM',grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:4.35, norma:'NTC 3728 T1'},
  {id:'jac', sigla:'Jac:', nombre:'Jacuzzi', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:3.38, norma:'NTC 3728 T1'},
  {id:'pisc', sigla:'Pis:', nombre:'Calentador piscina', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:6.08, norma:'NTC 3728 T1'},
  {id:'sauna',sigla:'Sau:', nombre:'Baño sauna', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.08, norma:'NTC 3728 T1'},
  {id:'turco',sigla:'Tur:', nombre:'Baño turco', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.35, norma:'NTC 3728 T1'},
];

export const AF_UC_IDS = ['san', 'lvm', 'duc', 'lvp', 'tin', 'lvra', 'lvro', 'nev'];
export const AC_UC_IDS = ['san', 'lvm', 'duc', 'lvp', 'tin', 'lvra', 'lvro', 'lavav'];
export const SAN_UC_IDS = ['sif', 'lvm', 'san', 'duc', 'lvra', 'tin', 'lvp', 'lvro', 'lavav'];

export const APARATO_IMG = {
  sif:'/iconos_aparatos/sifon.webp', lvm:'/iconos_aparatos/lavamanos.webp', san:'/iconos_aparatos/inodoro.webp',
  lvp:'/iconos_aparatos/lavaplatos.webp', duc:'/iconos_aparatos/ducha.webp', tin:'/iconos_aparatos/tina.webp',
  lvra:'/iconos_aparatos/lavadora.webp', lvro:'/iconos_aparatos/lavadero.webp', nev:'/iconos_aparatos/nevera.webp',
  lavav:'/iconos_aparatos/lavavajillas.webp',
  est4:'/iconos_aparatos/estufa_4_puestos.webp', est2:'/iconos_aparatos/estufa_2_puestos.webp',
  hor_g:'/iconos_aparatos/horno_grande.webp', hor_m:'/iconos_aparatos/horno_mediano.webp',
  hor_p:'/iconos_aparatos/horno_pequeño.webp', sec_g:'/iconos_aparatos/secadora_grande.webp',
  sec_p:'/iconos_aparatos/secadora_pequeña.webp', cal_b:'/iconos_aparatos/caldera_pequeña.webp',
  cal6:'/iconos_aparatos/calentador_6LPM.webp', cal11:'/iconos_aparatos/calentador_11LPM.webp', cal21:'/iconos_aparatos/calentador_21LPM.webp',
  jac:'/iconos_aparatos/jacuzzi.webp', pisc:'/iconos_aparatos/calentador_piscina.webp',
  sauna:'/iconos_aparatos/sauna.webp', turco:'/iconos_aparatos/turco.webp',
};

export const ACCESORIOS_HIDRO = [
  {id:'codo90rc',emoji:'🔩',nombre:'Codo RC 90°',icono:'/iconos_accesorios/codo90rc.webp', cat: 'Codos'},
  {id:'codo45rc',emoji:'🔩',nombre:'Codo RC 45°',icono:'/iconos_accesorios/codo45rc.webp', cat: 'Codos'},
  {id:'codo90rm',emoji:'🔩',nombre:'Codo RM 90°',icono:'/iconos_accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codo90rl',emoji:'🔩',nombre:'Codo RL 90°',icono:'/iconos_accesorios/codo90rl.webp', cat: 'Codos'},
  {id:'teeDirecto',emoji:'🔧',nombre:'Tee paso directo',icono:'/iconos_accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'teeReduccion',emoji:'🔧',nombre:'Tee c/ reducción',icono:'/iconos_accesorios/teeReduccion.webp', cat: 'Tees'},
  {id:'teeLado',emoji:'🔧',nombre:'Tee paso lado',icono:'/iconos_accesorios/teeLado.webp', cat: 'Tees'},
  {id:'teeBilateral',emoji:'🔧',nombre:'Tee salida bilateral',icono:'/iconos_accesorios/teeBilateral.webp', cat: 'Tees'},
  {id:'valvGlobo',emoji:'🚰',nombre:'Válvula globo',icono:'/iconos_accesorios/valvGlobo.webp', cat: 'Válvulas'},
  {id:'valvCompuerta',emoji:'🚰',nombre:'Válvula compuerta',icono:'/iconos_accesorios/valvCompuerta.webp', cat: 'Válvulas'},
  {id:'valvCheque',emoji:'✔️',nombre:'Válvula cheque',icono:'/iconos_accesorios/valvCheque.webp', cat: 'Válvulas'},
  {id:'valvPie',emoji:'🪣',nombre:'Válvula pie',icono:'/iconos_accesorios/valvPie.webp', cat: 'Válvulas'},
  {id:'valvAngulo',emoji:'🚰',nombre:'Válvula ángulo',icono:'/iconos_accesorios/valvAngulo.webp', cat: 'Válvulas'},
  {id:'reduccion',emoji:'🔽',nombre:'Reducción',icono:'/iconos_accesorios/reduccion.webp', cat: 'Otros'},
  {id:'ampliacion',emoji:'🔼',nombre:'Ampliación',icono:'/iconos_accesorios/ampliacion.webp', cat: 'Otros'},
  {id:'otros',emoji:'➕',nombre:'Otros',icono:'/iconos_accesorios/otros.webp', cat: 'Otros'},
];

export const ACCESORIOS_YEE = [
  {id:'yeeSimple', emoji:'🔧', nombre:'Yee simple', icono:'/iconos_accesorios/ye_simple.webp', cat:'Tees'},
  {id:'yeeDoble', emoji:'🔧', nombre:'Yee doble', icono:'/iconos_accesorios/ye_doble.webp', cat:'Tees'},
];

export const SAN_ACCESORIOS = [
  ...ACCESORIOS_HIDRO.filter(a => a.id === 'codo90rm'),
  {id:'codo90rmSube',emoji:'🔩',nombre:'Codo RM 90° sube',icono:'/iconos_accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codo90rmBaja',emoji:'🔩',nombre:'Codo RM 90° baja',icono:'/iconos_accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codoReventilado',emoji:'🔩',nombre:'Codo reventilado',icono:'/iconos_accesorios/codo90rl.webp', cat: 'Codos'},
  ...ACCESORIOS_YEE,
];

export const GAS_ACCESORIOS = [
  {id:'codos_90_std', emoji:'🔩', nombre:'Codos 90° std', icono:'/iconos_accesorios/codo90rc.webp', cat:'Codos'},
  {id:'codos_90_rl',  emoji:'🔩', nombre:'Codos 90° rl',  icono:'/iconos_accesorios/codo90rl.webp', cat:'Codos'},
  {id:'te_linea',     emoji:'🔧', nombre:'Te en línea',    icono:'/iconos_accesorios/te_en_linea.webp', cat:'Tees'},
  {id:'te_ramal',     emoji:'🔧', nombre:'Te ramal',       icono:'/iconos_accesorios/te_ramal.webp', cat:'Tees'},
  {id:'valvula_bola', emoji:'🚰', nombre:'Válvula bola',   icono:'/iconos_accesorios/valvBola.webp', cat:'Válvulas'},
];

export const MATERIALES = {
  af: {lbl:'Agua fría', opts:['PVC-PR','CPVC','Cobre rígido','Polipropileno PP-R']},
  ac: {lbl:'Agua caliente', opts:['PVC-PR','CPVC','Cobre rígido','Polipropileno PP-R','PEX']},
  san: {lbl:'Sanitaria', opts:['PVC-S','Novatec','Hierro fundido','Concreto']},
  ll: {lbl:'Aguas lluvias', opts:['PVC-S','Novatec','Hierro fundido','Concreto','Gres cerámico']},
  gas: {lbl:'Gas', opts:['PE al PE','Cobre rígido','A.C.','Acero HG','Polipropileno PP-R']},
  rci: {lbl:'Contra incendio', opts:['A.C. SCH 40','A.C. SCH 10','Acero HG','CPVC CPVC-CI','PVC C900 RDE 14']},
};

export const MATS_DEFAULT=Object.fromEntries(Object.entries(MATERIALES).map(([k,v])=>[k,v.opts.map((o,i)=>({id:k+i,val:o}))]));

export const MAT_LONGFORM = {
  'PVC-PR': 'PVC Presión',
  'PVC-S': 'PVC Sanitario',
  'PVC C900 RDE 14': 'PVC C900 RDE 14',
  'PVC C900 RDE 18': 'PVC C900 RDE 18',
  'CPVC': 'CPVC (cloruro de polivinilo clorado)',
  'CPVC CPVC-CI': 'CPVC contra incendio',
  'Cobre rígido': 'Cobre rígido',
  'Cobre flexible': 'Cobre flexible',
  'Polipropileno PP-R': 'Polipropileno PP-R (PP-R)',
  'PEX': 'PEX (polietileno reticulado)',
  'PE al PE': 'Polietileno (PE)',
  'Polietileno': 'Polietileno (PE)',
  'PEAD': 'Polietileno alta densidad (PEAD)',
  'A.C.': 'Acero al carbono',
  'A.C. SCH 10': 'Acero al carbono SCH 10',
  'A.C. SCH 40': 'Acero al carbono SCH 40',
  'Acero HG': 'Acero galvanizado (HG)',
  'Novatec': 'Novatec (PVC Novafort)',
  'Hierro fundido': 'Hierro fundido',
  'Concreto': 'Concreto',
  'Gres cerámico': 'Gres cerámico',
};

export function matLongName(short: string) {
  if (!short) return '—';
  return (MAT_LONGFORM as Record<string, string>)[short] || short;
}

export const MAT_MANNING = {
  'PVC-S': 0.009,
  'PVC-V': 0.009,
  'PVC-PR': 0.009,
  'PVC C900 RDE 14': 0.009,
  'PVC C900 RDE 18': 0.009,
  'Novatec': 0.009,
  'CPVC': 0.009,
  'Hierro fundido': 0.013,
  'Concreto': 0.013,
  'Gres cerámico': 0.013,
  'Cobre rígido': 0.011,
  'Cobre flexible': 0.011,
  'Polipropileno PP-R': 0.009,
  'PEX': 0.009,
  'PE al PE': 0.009,
  'Polietileno': 0.009,
  'PEAD': 0.009,
  'A.C.': 0.015,
  'A.C. SCH 10': 0.012,
  'A.C. SCH 40': 0.012,
  'Acero HG': 0.015,
};

export function matManning(short: string) {
  if (!short) return null;
  return (MAT_MANNING as Record<string, number>)[short] ?? null;
}

export const DIAM_OPTIONS=[
  {pulg:1.5,label:'1 1/2"',mm:42.68},
  {pulg:2,label:'2"',mm:54.48},
  {pulg:3,label:'3"',mm:76.20},
  {pulg:4,label:'4"',mm:107.70},
  {pulg:6,label:'6"',mm:160.04},
];

export const DIAM_BAN=[
  { pulg:1.5, mm:42.68, nom:'1½"' },
  { pulg:2, mm:54.48, nom:'2"' },
  { pulg:3, mm:76.20, nom:'3"' },
  { pulg:4, mm:107.70,nom:'4"' },
  { pulg:6, mm:160.04,nom:'6"' },
  { pulg:8, mm:213.20,nom:'8"' },
];

export const DIAM_VENT=[
  { pulg:1.5, mm:42.68, nom:'1½"' },
  { pulg:2, mm:54.48, nom:'2"' },
  { pulg:3, mm:76.20, nom:'3"' },
  { pulg:4, mm:107.70,nom:'4"' },
  { pulg:6, mm:160.04,nom:'6"' },
];

export const GAS = [
  { mat: 'Acero galvanizado', K: 57.50, rows: [
    { dn: '3/8', d: 9.50 }, { dn: '1/2', d: 12.70 }, { dn: '3/4', d: 19.00 },
    { dn: '1', d: 25.40 }, { dn: '2', d: 50.80 },
  ]},
  { mat: 'Acero al carbono', K: 57.50, rows: [
    { dn: '3/8', d: 10.00 }, { dn: '1/2', d: 13.40 }, { dn: '3/4', d: 19.50 },
    { dn: '1', d: 26.00 }, { dn: '2', d: 52.00 },
  ]},
  { mat: 'Cobre rígido', K: 54.20, rows: [
    { dn: '3/8', d: 8.70 }, { dn: '1/2', d: 10.90 }, { dn: '3/4', d: 17.40 },
  ]},
  { mat: 'Cobre flexible', K: 54.20, rows: [
    { dn: '3/8', d: 9.00 }, { dn: '1/2', d: 11.20 },
  ]},
  { mat: 'PE al PE', K: 49.00, rows: [
    { dn: '3/8', d: 12.00 }, { dn: '1/2', d: 16.00 },
    { dn: '3/4', d: 20.00 }, { dn: '1', d: 25.00 },
  ]},
  { mat: 'Polietileno', K: 50.60, rows: [
    { dn: '1/2', d: 14.50 }, { dn: '3/4', d: 21.50 }, { dn: '1', d: 27.80 },
  ]},
];

export const CALS=[
  { l: 'HACEB 6 LPM', lpm: 6, kw: 11.5, m3h: 1.11, ef: 87 },
  { l: 'BOSCH 8 LPM', lpm: 8, kw: 14.5, m3h: 1.40, ef: 88 },
  { l: 'HACEB 10 LPM', lpm: 10, kw: 20.5, m3h: 1.98, ef: 89 },
  { l: 'HACEB 12 LPM', lpm: 12, kw: 24.0, m3h: 2.32, ef: 88 },
  { l: 'RHEEM 16 LPM', lpm: 16, kw: 31.0, m3h: 3.00, ef: 90 },
  { l: 'BOSCH 21 LPM', lpm: 21, kw: 45.0, m3h: 4.35, ef: 88 },
];

export const CAT_APS = [
  { id: 'sif',  n: 'Sifones',                 s: 'Sif',  ctrl: 'N.A.',                 af: 0,   ac: 0  },
  { id: 'san',  n: 'Inodoro',                s: 'Ino',  ctrl: 'Tanque',               af: 2.2, ac: 0  },
  { id: 'lvm',  n: 'Lavamanos',              s: 'Lvm',  ctrl: 'Llave',                af: 0.5, ac: 0.5},
  { id: 'duc',  n: 'Ducha',                  s: 'Duc',  ctrl: 'Válvula de mezclado',  af: 1,   ac: 1  },
  { id: 'lvp',  n: 'Lavaplatos cocina',      s: 'Lvp',  ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'tin',  n: 'Tina',                   s: 'Tin',  ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'lvra', n: 'Lavadora',               s: 'Lvra', ctrl: 'Automático',           af: 1,   ac: 1  },
  { id: 'lvro', n: 'Lavadero',               s: 'Lvro', ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'nev',  n: 'Nevera',                 s: 'Nev',  ctrl: 'Llave',                af: 0.5, ac: 0  },
  { id: 'lavav',n: 'Lavavajillas',           s: 'Lavav',ctrl: 'Llave',                af: 0,   ac: 1.5},
];

export const DIAM_BY_MAT: Record<string, Array<{ n: string }>> = {
  'PVC-S': [
    { n: '1½" — 42.7 mm' }, { n: '2" — 54.5 mm' }, { n: '3" — 76.2 mm' },
    { n: '4" — 107.7 mm' }, { n: '6" — 160.0 mm' },
  ],
  'PVC-PR': [
    { n: '½" — 21.3 mm' }, { n: '¾" — 26.7 mm' }, { n: '1" — 33.4 mm' },
    { n: '1¼" — 42.2 mm' }, { n: '1½" — 48.3 mm' }, { n: '2" — 60.3 mm' },
    { n: '2½" — 73.0 mm' }, { n: '3" — 88.9 mm' }, { n: '4" — 114.3 mm' },
  ],
  'CPVC': [
    { n: '½" — 15.9 mm' }, { n: '¾" — 22.2 mm' }, { n: '1" — 28.6 mm' },
    { n: '1¼" — 34.9 mm' }, { n: '1½" — 41.3 mm' }, { n: '2" — 54.0 mm' },
    { n: '2½" — 66.7 mm' }, { n: '3" — 79.4 mm' }, { n: '4" — 104.8 mm' },
  ],
  'Cobre rígido': [
    { n: '½" — 12.7 mm' }, { n: '¾" — 19.1 mm' }, { n: '1" — 25.4 mm' },
    { n: '1¼" — 31.8 mm' }, { n: '1½" — 38.1 mm' }, { n: '2" — 50.8 mm' },
  ],
  'Cobre flexible': [
    { n: '½" — 12.7 mm' }, { n: '¾" — 19.1 mm' }, { n: '1" — 25.4 mm' },
    { n: '1¼" — 31.8 mm' }, { n: '1½" — 38.1 mm' }, { n: '2" — 50.8 mm' },
  ],
  'Novatec': [
    { n: '4" — 110.0 mm' }, { n: '6" — 160.0 mm' }, { n: '8" — 200.0 mm' },
    { n: '10" — 250.0 mm' }, { n: '12" — 315.0 mm' },
  ],
  'Hierro fundido': [
    { n: '2" — 50.0 mm' }, { n: '3" — 80.0 mm' }, { n: '4" — 100.0 mm' },
    { n: '6" — 150.0 mm' },
  ],
  'Concreto': [
    { n: '6" — 150.0 mm' }, { n: '8" — 200.0 mm' }, { n: '10" — 250.0 mm' },
    { n: '12" — 300.0 mm' },
  ],
  'Gres cerámico': [
    { n: '4" — 100.0 mm' }, { n: '6" — 150.0 mm' },
  ],
  'Polipropileno PP-R': [
    { n: '½" — 20.0 mm' }, { n: '¾" — 25.0 mm' }, { n: '1" — 32.0 mm' },
    { n: '1¼" — 40.0 mm' }, { n: '1½" — 50.0 mm' }, { n: '2" — 63.0 mm' },
  ],
  'PEX': [
    { n: '½" — 16.0 mm' }, { n: '¾" — 20.0 mm' }, { n: '1" — 25.0 mm' },
  ],
  'A.C. SCH 40': [
    { n: '½" — 15.8 mm' }, { n: '¾" — 21.0 mm' }, { n: '1" — 26.6 mm' },
    { n: '1¼" — 35.1 mm' }, { n: '1½" — 40.9 mm' }, { n: '2" — 52.5 mm' },
    { n: '2½" — 62.7 mm' }, { n: '3" — 77.9 mm' }, { n: '4" — 102.3 mm' },
    { n: '6" — 154.1 mm' }, { n: '8" — 202.7 mm' },
  ],
  'A.C. SCH 10': [
    { n: '2" — 56.0 mm' }, { n: '2½" — 68.8 mm' }, { n: '3" — 85.4 mm' },
    { n: '4" — 109.0 mm' }, { n: '6" — 163.8 mm' }, { n: '8" — 210.9 mm' },
  ],
  'Acero HG': [
    { n: '½" — 15.8 mm' }, { n: '¾" — 21.0 mm' }, { n: '1" — 26.6 mm' },
    { n: '1¼" — 35.1 mm' }, { n: '1½" — 40.9 mm' }, { n: '2" — 52.5 mm' },
    { n: '2½" — 62.7 mm' }, { n: '3" — 77.9 mm' }, { n: '4" — 102.3 mm' },
  ],
  'CPVC CPVC-CI': [
    { n: '¾" — 22.2 mm' }, { n: '1" — 28.6 mm' }, { n: '1¼" — 34.9 mm' },
    { n: '1½" — 41.3 mm' }, { n: '2" — 54.0 mm' }, { n: '2½" — 66.7 mm' },
    { n: '3" — 79.4 mm' },
  ],
  'PVC C900 RDE 14': [
    { n: '4" — 114.3 mm' }, { n: '6" — 168.3 mm' }, { n: '8" — 218.4 mm' },
    { n: '10" — 272.8 mm' }, { n: '12" — 323.9 mm' },
  ],
  'PE al PE': [
    { n: '½" — 16.0 mm' }, { n: '¾" — 20.0 mm' }, { n: '1" — 25.0 mm' },
    { n: '1¼" — 32.0 mm' }, { n: '1½" — 40.0 mm' }, { n: '2" — 50.0 mm' },
    { n: '2½" — 63.0 mm' }, { n: '3" — 75.0 mm' }, { n: '4" — 90.0 mm' },
    { n: '6" — 110.0 mm' },
  ],
};

export const DIAM_DEFAULT_BY_NET: Record<string, string> = {
  san: '',
  ll: '',
  af: '',
  ac: '',
  rci: '',
};

export const CAT_GAS = [
  { id: 'pisc',   n: 'Calentador de piscina',     s: 'Cpisc',   q: 6.08 },
  { id: 'cal6',   n: 'Calentador P.D. Cap. 6 LPM',s: 'Cal 6LPM',q: 1.11 },
  { id: 'cal11',  n: 'Calentador P.D. Cap. 11 LPM',s:'Cal 11LPM',q: 1.88 },
  { id: 'cal21',  n: 'Calentador P.D. Cap. 21 LPM',s:'Cal 21LPM',q: 4.35 },
  { id: 'jac',    n: 'Jacuzzi',                   s: 'Jac',     q: 3.38 },
  { id: 'est2',   n: 'Estufa de 2 quemadores',    s: 'Est 2Q',  q: 0.68 },
  { id: 'est4',   n: 'Estufa de 4 quemadores',    s: 'Est 4Q',  q: 1.35 },
  { id: 'bt',     n: 'Baño turco',                s: 'BT',      q: 1.35 },
  { id: 'bs',     n: 'Baño sauna',                s: 'BS',      q: 1.08 },
  { id: 'hor_p',  n: 'Horno pequeño',             s: 'HP',      q: 0.54 },
  { id: 'hor_m',  n: 'Horno mediano',             s: 'HM',      q: 0.81 },
  { id: 'hor_g',  n: 'Horno grande',              s: 'HG',      q: 1.15 },
  { id: 'srp',    n: 'Secadora de ropa pequeña',  s: 'SRP',     q: 0.54 },
  { id: 'srg',    n: 'Secadora de ropa grande',   s: 'SRG',     q: 0.81 },
  { id: 'calp',   n: 'Caldera pequeña',           s: 'Calp',    q: 1.76 },
];
