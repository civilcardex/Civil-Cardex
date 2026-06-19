// REDES: UI-display network definitions (lbl, sub, ico, icoImg, col as CSS var).
// For drawing-engine definitions use PlanoState.NETS instead (has ucType, bmType, etc).
export const REDES=[
  {id:'san',lbl:'Sanitaria', sub:'RAS D · Manning n=0.009', ico:'♻️', icoImg:'/iconos_diseno_redes/sanitaria/red_sanitaria.webp', col:'var(--san)'},
  {id:'ll', lbl:'Aguas lluvias', sub:'Método Racional · IDF', ico:'🌧️', icoImg:'/iconos_diseno_redes/aguas_lluvias/red_aguas_lluvias.webp', col:'var(--ll)'},
  {id:'af', lbl:'Agua fría', sub:'NTC 1500 · Hazen-Williams', ico:'💧', icoImg:'/iconos_diseno_redes/hidraulica/red_agua_fria.webp', col:'var(--af)'},
  {id:'ac', lbl:'Agua caliente', sub:'NTC 1500 · CPVC RDE 11', ico:'🔥', icoImg:'/iconos_diseno_redes/hidraulica/red_agua_caliente.webp', col:'var(--ac)'},
  {id:'ep', lbl:'Equipo presión', sub:'Bomba + recipiente vejiga', ico:'⚡', icoImg:'/iconos_diseno_redes/equipos/red_equipo_presion.webp', col:'var(--ep)'},
  {id:'bom',lbl:'Bomba AR', sub:'Aguas residuales presión', ico:'⬆️', icoImg:'/iconos_diseno_redes/equipos/red_bomba_ar.webp', col:'var(--bom)'},
  {id:'rci',lbl:'Contra incendio', sub:'NSR-10 J · NFPA 13:2022', ico:'🔴', icoImg:'/iconos_diseno_redes/rci/red_contra_incendio.webp', col:'var(--rci)'},
  {id:'gas',lbl:'Gas', sub:'NTC 3728 · Baja presión', ico:'⛽', icoImg:'/iconos_diseno_redes/gas/red_de_gas.webp', col:'var(--gas)'},
];

export const USOS=['Vivienda unifamiliar','Vivienda multifamiliar','Comercial','Institucional','Mixto'];

export const NAV_TABS=[
  {id:'info',  l:'Información general',  ico:'🏗️', icoImg:'/iconos_info_general/Informacion_del_proyecto.webp'},
  {id:'planos',l:'Carga de planos',      ico:'📐', icoImg:'/iconos_carga_planos/carga_de_planos.webp'},
  {id:'datos', l:'Parámetros de diseño', ico:'📊', icoImg:'/iconos_parametros_de_diseno/catalogo_maestro.webp'},
  {id:'visor', l:'Dibujo de redes',      ico:'✏️', icoImg:'/iconos_aparatos/dibujo_de_redes.webp'},
  {id:'redes', l:'Diseño de redes y equipos',      ico:'🔧', icoImg:'/iconos_diseno_redes/general/diseno_redes.webp'},
  {id:'iso',   l:'Isometría',            ico:'', icoImg:'/isometria.webp'},
  {id:'inf',   l:'Informes',             ico:'📄', icoImg:'/Informes.webp'},
  {id:'crit',  l:'Normativa',            ico:'§',  icoImg:'/normativa.webp'},
];

export const FILTROS_NORM=[{k:'todos',l:'Todos'},{k:'af',l:'AF/AC'},{k:'san',l:'Sanitaria'},{k:'ll',l:'Lluvias'},{k:'gas',l:'Gas'},{k:'rci',l:'RCI'}];

export const NORM_COL={af:'var(--af)',ac:'var(--ac)',san:'var(--san)',ll:'var(--ll)',gas:'var(--gas)',rci:'var(--rci)',ep:'var(--ep)',bom:'var(--bom)'};
export const MAT_COL = NORM_COL; // Alias — same color mapping

export const R_OPTIONS=[{value:'1/4',label:'1/4'},{value:'7/24',label:'7/24'}];

export const REQ_ITEMS=[
  {ico:'📏', icoImg:'/iconos_carga_planos/escala.webp', t:'Escala', s:'Definir escala a trabajar'},
  {ico:'📄', icoImg:'/iconos_carga_planos/plano_por_nivel.webp', t:'1 plano', s:'Por nivel'},
  {ico:'🏷️', icoImg:'/iconos_carga_planos/cotas.webp', t:'Cotas NPT', s:'En planta'},
  {ico:'🎨', icoImg:'/iconos_carga_planos/redes_por_color.webp', t:'Redes color', s:'Definir colores por redes'},
  {ico:'🚿', icoImg:'/iconos_carga_planos/simbologia.webp', t:'Simbología', s:'NTC 1500'},
];
