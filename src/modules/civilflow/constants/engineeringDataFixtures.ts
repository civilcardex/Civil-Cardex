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
  {id:'cal6', sigla:'Cal6:', nombre:'Calentador P.D. 6 LPM', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.11, norma:'NTC 3728 T1'},
  {id:'cal11',sigla:'Cal11:',nombre:'Calentador P.D. 11 LPM',grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.88, norma:'NTC 3728 T1'},
  {id:'cal21',sigla:'Cal21:',nombre:'Calentador P.D. 21 LPM',grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:4.35, norma:'NTC 3728 T1'},
  {id:'jac', sigla:'Jac:', nombre:'Jacuzzi', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:3.38, norma:'NTC 3728 T1'},
  {id:'pisc', sigla:'Pis:', nombre:'Calentador piscina', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:6.08, norma:'NTC 3728 T1'},
  {id:'sauna',sigla:'Sau:', nombre:'Baño sauna', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.08, norma:'NTC 3728 T1'},
  {id:'turco',sigla:'Tur:', nombre:'Baño turco', grupo:'g', uc_af:0,uc_ac:0,ud:0, pmin:17,pmax:25, qgas:1.35, norma:'NTC 3728 T1'},
];

export const AF_UC_IDS = ['san', 'lvm', 'duc', 'lvp', 'tin', 'lvra', 'lvro', 'nev'];
export const AC_UC_IDS = ['lvm', 'duc', 'lvp', 'tin', 'lvra', 'lvro', 'lavav'];
export const SAN_UC_IDS = ['sif', 'lvm', 'san', 'duc', 'lvra', 'tin', 'lvp', 'lvro', 'lavav'];

export const APARATO_IMG = {
  sif:'/iconos_aparatos/sifon.webp', lvm:'/iconos_aparatos/lavamanos.webp', san:'/iconos_aparatos/inodoro.webp',
  lvp:'/iconos_aparatos/lavaplatos.webp', duc:'/iconos_aparatos/ducha.webp', tin:'/iconos_aparatos/tina.webp',
  lvra:'/iconos_aparatos/lavadora.webp', lvro:'/iconos_aparatos/lavadero.webp', nev:'/iconos_aparatos/nevera.webp',
  lavav:'/iconos_aparatos/lavavajillas.webp',
  est4:'/iconos_aparatos/estufa_4_puestos.webp', est2:'/iconos_aparatos/estufa_2_puestos.webp',
  hor_g:'/iconos_aparatos/horno_grande.webp', hor_m:'/iconos_aparatos/horno_mediano.webp',
  hor_p:'/iconos_aparatos/horno_pequeño.webp', sec_g:'/iconos_aparatos/secadora_grande.webp',
  sec_p:'/iconos_aparatos/secadora_pequeña.webp',
  cal6:'/iconos_aparatos/calentador_6LPM.webp', cal11:'/iconos_aparatos/calentador_11LPM.webp', cal21:'/iconos_aparatos/calentador_21LPM.webp',
  jac:'/iconos_aparatos/jacuzzi.webp', pisc:'/iconos_aparatos/calentador_piscina.webp',
  sauna:'/iconos_aparatos/sauna.webp', turco:'/iconos_aparatos/turco.webp',
};

export const CAT_APS = [
  { id: 'sif',  n: 'Sifones',                 s: 'Sif',  ctrl: 'N.A.',                 af: 0,   ac: 0  },
  { id: 'san',  n: 'Inodoro',                s: 'Ino',  ctrl: 'Tanque',               af: 2.2, ac: 0  },
  { id: 'lvm',  n: 'Lavamanos',              s: 'Lvm',  ctrl: 'Llave',                af: 0.5, ac: 0.5},
  { id: 'duc',  n: 'Ducha',                  s: 'Duc',  ctrl: 'Válvula de mezclado',  af: 1,   ac: 1  },
  { id: 'lvp',  n: 'Lavaplatos cocina',      s: 'Lvp',  ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'tin',  n: 'Tina',                   s: 'Tina',                   ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'lvra', n: 'Lavadora',               s: 'Lvra', ctrl: 'Automático',           af: 1,   ac: 1  },
  { id: 'lvro', n: 'Lavadero',               s: 'Lvro', ctrl: 'Grifería',             af: 1,   ac: 1  },
  { id: 'nev',  n: 'Nevera',                 s: 'Nev',  ctrl: 'Llave',                af: 0.5, ac: 0  },
  { id: 'lavav',n: 'Lavavajillas',           s: 'Lavav',ctrl: 'Llave',                af: 0,   ac: 1.5},
];
