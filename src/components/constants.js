export function pisoLbl(n) {
  if (n < 0) return `Sótano ${Math.abs(n)}`;
  if (n === 99) return `Cubierta`;
  return `Piso ${n}`;
}

export function pisoCorto(n) {
  if (n < 0) return `S${Math.abs(n)}`;
  if (n === 99) return `Cub`;
  return `P${n}`;
}

export const APARATOS_DEF = [
  {id:'lvm', sigla:'Lvm:', nombre:'Lavamanos', grupo:'h', uc_af:0.5, uc_ac:0.5, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'san', sigla:'San:', nombre:'Sanitario con tanque', grupo:'h', uc_af:2.2, uc_ac:0, ud:4, pmin:0.71, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvp', sigla:'Lvp:', nombre:'Lavaplatos', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'duc', sigla:'Duc:', nombre:'Ducha', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:1.02, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'tin', sigla:'Tin:', nombre:'Tina de baño', grupo:'h', uc_af:1.0, uc_ac:1.0, ud:2, pmin:0.51, pmax:14.10, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvra',sigla:'Lvra:', nombre:'Lavadora', grupo:'h', uc_af:1.0, uc_ac:0, ud:4, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
  {id:'lvro',sigla:'Lvro:', nombre:'Lavadero', grupo:'h', uc_af:0.75,uc_ac:0.75,ud:2, pmin:0.51, pmax:5.63, qgas:0, norma:'NTC 1500 T1'},
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
  {id:'jac', sigla:'Jac:', nombre:'Jacuzzi', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:3.38, norma:'NTC 3728 T1'},
  {id:'pisc', sigla:'Pis:', nombre:'Calentador piscina', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:6.08, norma:'NTC 3728 T1'},
  {id:'sauna',sigla:'Sau:', nombre:'Baño sauna', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.08, norma:'NTC 3728 T1'},
  {id:'turco',sigla:'Tur:', nombre:'Baño turco', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.35, norma:'NTC 3728 T1'},
];

export const REDES=[
  {id:'san',lbl:'Red Sanitaria', sub:'RAS D · maning n=0.009', ico:'♻️',col:'var(--san)'},
  {id:'ven',lbl:'Ventilación', sub:'NTC 1500 §9 · D mín 1½"', ico:'💨',col:'var(--ven)'},
  {id:'ll', lbl:'Aguas Lluvias', sub:'Método Racional · IDF', ico:'🌧️',col:'var(--ll)'},
  {id:'af', lbl:'Agua Fría', sub:'NTC 1500 · Hazen-Williams', ico:'💧',col:'var(--af)'},
  {id:'ac', lbl:'Agua Caliente', sub:'NTC 1500 · CPVC RDE 11', ico:'🔥',col:'var(--ac)'},
  {id:'ep', lbl:'Equipo Presión', sub:'Bomba + recipiente vejiga', ico:'⚡',col:'var(--ep)'},
  {id:'bom',lbl:'Bomba AR', sub:'Aguas residuales presión', ico:'⬆️',col:'var(--bom)'},
  {id:'rec',lbl:'Recirculación AC',sub:'Solo si L > 15 m', ico:'🔄',col:'var(--rec)'},
  {id:'rci',lbl:'Contra Incendio', sub:'NSR-10 J · NFPA 13:2022', ico:'🔴',col:'var(--rci)'},
  {id:'gas',lbl:'Gas', sub:'NTC 3728 · Baja presión', ico:'⛽',col:'var(--gas)'},
];

export const TABS=[
  {id:'plano', lbl:'Planos', ico:'📐'},
  {id:'mats', lbl:'Caract. Materiales', ico:'📋'},
  {id:'apars', lbl:'Dispositivos', ico:'🚿'},
  {id:'cud', lbl:'Cálculo UD', ico:'📊'},
];

export const MATERIALES = {
  af: {lbl:'Agua Fría', opts:['PVC-PR','CPVC','Cobre rígido','Polipropileno PP-R']},
  ac: {lbl:'Agua Caliente', opts:['CPVC','Cobre rígido','Polipropileno PP-R','PEX']},
  san: {lbl:'Sanitaria', opts:['PVC-S','Novatec','Hierro fundido','Concreto']},
  ll: {lbl:'Aguas Lluvias', opts:['PVC-S','Novatec','Hierro fundido','Concreto','Gres cerámico']},
  gas: {lbl:'Gas', opts:['PE al PE','Cobre rígido','A.C.','Acero HG','Polipropileno PP-R']},
  ven: {lbl:'Ventilación', opts:['PVC-V','Novatec']},
  rci: {lbl:'Contra Incendio', opts:['A.C. SCH 40','A.C. SCH 10','Acero HG','CPVC CPVC-CI','PVC C900 RDE 14']},
};

export const MATS_DEFAULT=Object.fromEntries(Object.entries(MATERIALES).map(([k,v])=>[k,v.opts.map((o,i)=>({id:k+i,val:o}))]));
export const USOS=['Vivienda unifamiliar','Vivienda multifamiliar','Comercial','Institucional','Mixto'];
export const EMPRES=['EMAB - Floridablanca','Aguas de Bucaramanga','EAAB - Bogotá','EPM - Medellín','Otra'];

export const UD_BASE_INIT=[
  {id:'sif',nombre:'Sifones',ud:2},
  {id:'lvm',nombre:'Lavamanos',ud:2},
  {id:'san',nombre:'Sanitarios',ud:4},
  {id:'duc',nombre:'Duchas',ud:2},
  {id:'lvra',nombre:'Lavadoras',ud:4},
  {id:'tin',nombre:'Tina',ud:2},
  {id:'lvp',nombre:'Lavaplatos',ud:2},
  {id:'lvro',nombre:'Lavadero',ud:2},
];

export const UD_PISO_MAP={
  sif:'Sifones',lvm:'Lavamanos',san:'Sanitarios',duc:'Duchas',
  lvra:'Lavadoras',tin:'Tina',lvp:'Lavaplatos',lvro:'Lavadero',
};

export const NAV_TABS=[
  {id:'info',  l:'Información general',  ico:'🏗️'},
  {id:'planos',l:'Carga de planos',      ico:'📐'},
  {id:'datos', l:'Parámetros de diseño', ico:'📊'},
  {id:'visor', l:'Dibujo de Redes',      ico:'✏️'},
  {id:'redes', l:'Diseño de redes',      ico:'🔧'},
  {id:'inf',   l:'Informes',             ico:'📄'},
  {id:'crit',  l:'Normativa',            ico:'§'},
];

export const INFO_SUBTABS=[
  {id:'gral',   l:'📋 Datos generales',   s:'Nombre, uso, empresa, dotación'},
  {id:'niveles',l:'🏢 Niveles / NPT',     s:'Generador de pisos y sótanos'},
  {id:'redes',  l:'🔌 Redes activas',     s:'Selección de redes a calcular'},
  {id:'plano',  l:'📐 Planos',            s:'Carga y análisis'},
];

export const REDES_SAN_LL=REDES.filter(r=>r.id==='san'||r.id==='ll');

export const FILTROS_NORM=[{k:'todos',l:'Todos'},{k:'af',l:'AF/AC'},{k:'san',l:'Sanitaria'},{k:'ll',l:'Lluvias'},{k:'gas',l:'Gas'},{k:'rci',l:'RCI'}];

export const NORM_COL={af:'var(--af)',ac:'var(--ac)',san:'var(--san)',ll:'var(--ll)',gas:'var(--gas)',rci:'var(--rci)',ven:'var(--ven)',ep:'var(--ep)',bom:'var(--bom)',rec:'var(--rec)'};
export const MAT_COL={af:'var(--af)',ac:'var(--ac)',san:'var(--san)',ll:'var(--ll)',ven:'var(--ven)',gas:'var(--gas)',rci:'var(--rci)',ep:'var(--ep)',bom:'var(--bom)',rec:'var(--rec)'};

export const CRIT0=[
{id:'a1',red:'af',param:'V mínima AF/AC',val:'0.50',uni:'m/s',norma:'NTC 1500:2020',art:'§5.4',cumple:'V ≥ 0.50 m/s todos tramos',nota:'Evita sedimentación'},
{id:'a2',red:'af',param:'V máxima AF/AC',val:'2.50',uni:'m/s',norma:'NTC 1500:2020',art:'§5.4',cumple:'V ≤ 2.50 m/s todos tramos',nota:'Conservador'},
{id:'a3',red:'af',param:'C HW PVC presión',val:'150',uni:'—',norma:'RAS 2000',art:'§B.6.4.2',cumple:'C=150 en Hf',nota:'PVC nuevo'},
{id:'a4',red:'af',param:'P mín inodoro',val:'0.71',uni:'mca',norma:'NTC 1500:2020',art:'Tabla 3',cumple:'P fin ≥ 0.71 mca',nota:'1 PSI=0.704 mca'},
{id:'a5',red:'af',param:'P mín ducha',val:'1.02',uni:'mca',norma:'NTC 1500:2020',art:'Tabla 3',cumple:'P fin ≥ 1.02 mca',nota:'Válvula de mezcla'},
{id:'a6',red:'af',param:'P mín lvm/lvp',val:'0.51',uni:'mca',norma:'NTC 1500:2020',art:'Tabla 3',cumple:'P fin ≥ 0.51 mca',nota:'Grifería convencional'},
{id:'s1',red:'san',param:'V mín auto-limpieza',val:'0.45',uni:'m/s',norma:'RAS 2000',art:'§D.4.3',cumple:'V real ≥ 0.45 m/s',nota:'Evita taponamiento'},
{id:'s2',red:'san',param:'V máx sanitaria',val:'4.00',uni:'m/s',norma:'RAS 2000',art:'§D.4.3',cumple:'V real ≤ 4.00 m/s',nota:'Evita erosión'},
{id:'s3',red:'san',param:'Manning n PVC',val:'0.009',uni:'—',norma:'RAS 2000',art:'Tabla D.4.3',cumple:'n=0.009',nota:'PVC liso'},
{id:'s4',red:'san',param:'S mínima ≥2"',val:'2.00',uni:'%',norma:'NTC 1500:2020',art:'§8.3',cumple:'S ≥ 2% ramales',nota:'1% con justificación'},
{id:'s5',red:'san',param:'y/D máx',val:'0.75',uni:'—',norma:'RAS 2000',art:'§D.4.3',cumple:'y/D ≤ 0.75',nota:'25% libre para picos'},
{id:'l1',red:'ll',param:'Método cálculo LL',val:'Racional',uni:'—',norma:'RAS 2000',art:'§D.2',cumple:'Q=C×I×A/360000',nota:'Áreas < 2 km²'},
{id:'l2',red:'ll',param:'Tr diseño cubierta',val:'5',uni:'años',norma:'RAS 2000',art:'Tabla D.2.2',cumple:'IDF Tr=5 años',nota:'Comercial: Tr=10a'},
{id:'g1',red:'gas',param:'ΔP máx baja presión',val:'9.81',uni:'mbar',norma:'NTC 3728',art:'§6.2',cumple:'ΔP ≤ 9.81 mbar',nota:'1 mbar=10.2 mmH₂O'},
{id:'g2',red:'gas',param:'V máx gas',val:'10.0',uni:'m/s',norma:'NTC 3728',art:'§6.3',cumple:'V ≤ 10 m/s',nota:'Evita ruido'},
{id:'g3',red:'gas',param:'K PE al PE',val:'49',uni:'—',norma:'NTC 3728',art:'Tabla 1',cumple:'K=49 Renouard',nota:'Cobre=54.2'},
{id:'r1',red:'rci',param:'Densidad Riesgo leve',val:'0.10',uni:'gpm/pie²',norma:'NFPA 13:2022',art:'§11.2.3',cumple:'Dens ≥ 0.10 gpm/pie²',nota:'NSR-10 J.4.3'},
{id:'r2',red:'rci',param:'P mín rociador',val:'7.0',uni:'PSI',norma:'NFPA 13:2022',art:'§7.2.1.1',cumple:'P roc ≥ 7 PSI',nota:'K=5.6 QR'},
{id:'r3',red:'rci',param:'C acero SCH 40',val:'120',uni:'—',norma:'NFPA 13:2022',art:'§28.2.1',cumple:'C=120 acero nuevo',nota:'RCI hidráulico'},
];

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

export const R_OPTIONS=[{value:'1/4',label:'1/4'},{value:'7/24',label:'7/24'}];

export const REQ_ITEMS=[
  ['📏','Escala explícita','Barra gráfica o nota 1:50 · 1:75 · 1:100'],
  ['📄','Plantas separadas','Una página por nivel (Sótano 1, 2... / Piso 1, 2...)'],
  ['🏷️','Cotas NPT','Nivel piso terminado en cada planta'],
  ['🎨','Redes por color','AF · AC · SAN · LL · VEN · GAS con leyenda'],
  ['🚿','Símbolos NTC','Lvm · San · Duc · Lvp · Tin · Lvra'],
];

export const BD_SUBTABS=[
  { id:'mats', l:'📦 Materiales por red', s:'Tipos de tubería editables' },
  { id:'apars', l:'🚿 Aparatos y Calentadores', s:'UC · UD · Q gas · Catálogo' },
  { id:'profs', l:'📏 Profundidades', s:'Instalación por red' },
];

export const CALS=[
  { l: 'HACEB 6 LPM', lpm: 6, kw: 11.5, m3h: 1.11, ef: 87 },
  { l: 'BOSCH 8 LPM', lpm: 8, kw: 14.5, m3h: 1.40, ef: 88 },
  { l: 'HACEB 10 LPM', lpm: 10, kw: 20.5, m3h: 1.98, ef: 89 },
  { l: 'HACEB 12 LPM', lpm: 12, kw: 24.0, m3h: 2.32, ef: 88 },
  { l: 'RHEEM 16 LPM', lpm: 16, kw: 31.0, m3h: 3.00, ef: 90 },
  { l: 'BOSCH 21 LPM', lpm: 21, kw: 45.0, m3h: 4.35, ef: 88 },
];

export const V_MIN = 0.45;
export const V_MAX = 4.0;
export const Y_D_MAX = 0.75;
export const Q_RATIO_MAX = 1.0;
export const FR_SUBCRITICO = 0.9;
export const FR_SUPERCRITICO = 1.1;
export const FUERZA_TRACTIVA_MIN = 0.15;

export const APS_DEFAULT=[
{id:'lvm',s:'Lvm:',n:'Lavamanos',g:'h',ucaf:0.5,ucac:0.5,ud:2,pmin:0.51,pmax:5.63,qg:0},
{id:'san',s:'San:',n:'Sanitario',g:'h',ucaf:2.2,ucac:0,ud:4,pmin:0.71,pmax:14.1,qg:0},
{id:'duc',s:'Duc:',n:'Ducha',g:'h',ucaf:1.0,ucac:1.0,ud:2,pmin:1.02,pmax:5.63,qg:0},
{id:'lvp',s:'Lvp:',n:'Lavaplatos',g:'h',ucaf:1.0,ucac:1.0,ud:2,pmin:0.51,pmax:5.63,qg:0},
{id:'tin',s:'Tin:',n:'Tina',g:'h',ucaf:1.0,ucac:1.0,ud:2,pmin:0.51,pmax:14.1,qg:0},
{id:'lvra',s:'Lvra:',n:'Lavadora',g:'h',ucaf:1.0,ucac:0,ud:4,pmin:0.51,pmax:5.63,qg:0},
{id:'est4',s:'Est4:',n:'Estufa 4Q',g:'g',ucaf:0,ucac:0,ud:0,pmin:17,pmax:25,qg:1.35},
{id:'cal',s:'Cal:',n:'Calentador',g:'g',ucaf:0,ucac:0,ud:0,pmin:17,pmax:25,qg:1.76},
{id:'hor',s:'Hor:',n:'Horno',g:'g',ucaf:0,ucac:0,ud:0,pmin:17,pmax:25,qg:1.15},
];

export const PROFS_DEFAULT=[
{id:'san',red:'Sanitaria',col:'var(--san)',prof:-0.70,norma:'RAS 2000 §D.4.1',nota:'Bajo losa'},
{id:'ll',red:'Aguas Lluvias',col:'var(--ll)',prof:-0.50,norma:'RAS 2000 §D.4.2',nota:'Bajo losa'},
{id:'af',red:'Agua Fría',col:'var(--af)',prof:0.00,norma:'NTC 1500 §5.4',nota:'A nivel NPT'},
{id:'ac',red:'Agua Caliente',col:'var(--ac)',prof:-0.10,norma:'NTC 1500 §5.4',nota:'Bajo NPT'},
{id:'gas',red:'Gas',col:'var(--gas)',prof:-0.15,norma:'NTC 3728 §4.3',nota:'Con protección'},
{id:'ven',red:'Ventilación',col:'var(--ven)',prof:0.00,norma:'NTC 1500 §9.2',nota:'A nivel NPT'},
{id:'rci',red:'Contra Incendio',col:'var(--rci)',prof:-0.45,norma:'NFPA 13 §6',nota:'Zona protegida'},
];
