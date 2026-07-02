import { APARATOS_DEF, SAN_UC_IDS } from './engineeringDataFixtures';

export const UD_BASE_INIT = APARATOS_DEF
  .filter(d => SAN_UC_IDS.includes(d.id))
  .map(d => ({ id: d.id, nombre: d.nombre, ud: d.ud }));

export const V_MIN = 0.45;
export const V_MAX = 4.0;
export const Y_D_MAX = 0.75;
export const FUERZA_TRACTIVA_MIN = 0.15;

export const APS_DEFAULT = APARATOS_DEF.map(d => ({
  id: d.id,
  s: d.sigla,
  n: d.nombre,
  g: d.grupo,
  ucaf: d.uc_af,
  ucac: d.uc_ac,
  ud: d.ud,
  pmin: d.pmin,
  pmax: d.pmax,
  qg: d.qgas,
  ctrl: d.grupo === 'g' ? 'Llave' : (d.id === 'san' || d.id === 'sif' ? 'Tanque' : 'Llave'),
  _blkUd: (d.ud || 0) === 0,
}));

export const PROFS_DEFAULT=[
  {id:'san',red:'Sanitaria',col:'var(--san)',prof:-0.70,norma:'RAS 2000 §D.4.1',nota:'Bajo losa'},
  {id:'ll',red:'Aguas lluvias',col:'var(--ll)',prof:-0.50,norma:'RAS 2000 §D.4.2',nota:'Bajo losa'},
  {id:'af',red:'Agua fría',col:'var(--af)',prof:-0.05,norma:'NTC 1500 §5.4',nota:'A nivel NPT'},
  {id:'ac',red:'Agua caliente',col:'var(--ac)',prof:-0.10,norma:'NTC 1500 §5.4',nota:'Bajo NPT'},
  {id:'gas',red:'Gas',col:'var(--gas)',prof:-0.15,norma:'NTC 3728 §4.3',nota:'Con protección'},
  {id:'rci',red:'Contra incendio',col:'var(--rci)',prof:-0.45,norma:'NFPA 13 §6',nota:'Zona protegida'},
];

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

export const REDES_MAT = [
  { id: 'san', lbl: 'Sanitaria',        mat: 'PVC-S',                       prof: -0.70, fixed: true },
  { id: 'll',  lbl: 'Aguas lluvias',    mat: 'PVC-S',                       prof: -0.50, fixed: true },
  { id: 'af',  lbl: 'Agua fría',        mat: 'PVC-PR',                      prof: -0.05, fixed: true },
  { id: 'ac', lbl: 'Agua caliente', mat: 'PVC-PR', prof: -0.10, fixed: true },
  { id: 'rci', lbl: 'Contra incendio',  mat: 'A.C. SCH 40',      prof: -0.45,
    opts: ['A.C. SCH 10', 'A.C. SCH 40', 'PVC C900 RDE 14', 'PVC C900 RDE 18', 'Acero HG'] },
  { id: 'gas', lbl: 'Gas',              mat: 'PE al PE',                    prof: -0.15,
    opts: ['Acero HG', 'A.C.', 'Cobre rígido', 'Cobre flexible', 'PE al PE', 'PEAD'] },
];
