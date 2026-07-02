export const ACCESORIOS_HIDRO = [
  {id:'codo90rc',emoji:'🔩',nombre:'Codo corto 90°',icono:'/iconos_accesorios/codo90rc.svg', cat: 'Codos'},
  {id:'codo45rc',emoji:'🔩',nombre:'Codo corto 45°',icono:'/iconos_accesorios/codo45rc.svg', cat: 'Codos'},
  {id:'codo90rm',emoji:'🔩',nombre:'Codo medio 90°',icono:'/iconos_accesorios/codo90rm.svg', cat: 'Codos'},
  {id:'codo90rl',emoji:'🔩',nombre:'Codo largo 90°',icono:'/iconos_accesorios/codo90rl.svg', cat: 'Codos'},
  {id:'teeDirecto',emoji:'🔧',nombre:'Tee paso directo',icono:'/iconos_accesorios/teeDirecto.svg', cat: 'Tees'},
  {id:'teeReduccion',emoji:'🔧',nombre:'Tee c/ reducción',icono:'/iconos_accesorios/teeReduccion.svg', cat: 'Tees'},
  {id:'teeLado',emoji:'🔧',nombre:'Tee paso lado',icono:'/iconos_accesorios/teeLado.svg', cat: 'Tees'},
  {id:'teeBilateral',emoji:'🔧',nombre:'Tee salida bilateral',icono:'/iconos_accesorios/teeBilateral.svg', cat: 'Tees'},
  {id:'valvGlobo',emoji:'🚰',nombre:'Válvula globo',icono:'/iconos_accesorios/valvGlobo.svg', cat: 'Válvulas'},
  {id:'valvCompuerta',emoji:'🚰',nombre:'Válvula compuerta',icono:'/iconos_accesorios/valvCompuerta.svg', cat: 'Válvulas'},
  {id:'valvCheque',emoji:'✔️',nombre:'Válvula cheque',icono:'/iconos_accesorios/valvCheque.svg', cat: 'Válvulas'},
  {id:'valvPie',emoji:'🪣',nombre:'Válvula pie',icono:'/iconos_accesorios/valvPie.svg', cat: 'Válvulas'},
  {id:'valvAngulo',emoji:'🚰',nombre:'Válvula ángulo',icono:'/iconos_accesorios/valvAngulo.svg', cat: 'Válvulas'},
  {id:'reduccion',emoji:'🔽',nombre:'Reducción',icono:'/iconos_accesorios/reduccion.svg', cat: 'Otros'},
  {id:'ampliacion',emoji:'🔼',nombre:'Ampliación',icono:'/iconos_accesorios/ampliacion.svg', cat: 'Otros'},
  {id:'otros',emoji:'➕',nombre:'Otros',icono:'/iconos_accesorios/otros.svg', cat: 'Otros'},
];

export const ACCESORIOS_YEE = [
  {id:'yeeSimple', emoji:'🔧', nombre:'Yee simple', icono:'/iconos_accesorios/ye_simple.svg', cat:'Tees'},
  {id:'yeeDoble', emoji:'🔧', nombre:'Yee doble', icono:'/iconos_accesorios/ye_doble.svg', cat:'Tees'},
];

export const SAN_ACCESORIOS = [
  ...ACCESORIOS_HIDRO.filter(a => a.id === 'codo90rm' || a.id === 'codo45rc'),
  {id:'codo90rmSube',emoji:'🔩',nombre:'Codo medio 90° sube',icono:'/iconos_accesorios/codo90rm.svg', cat: 'Codos'},
  {id:'codo90rmBaja',emoji:'🔩',nombre:'Codo medio 90° baja',icono:'/iconos_accesorios/codo90rm.svg', cat: 'Codos'},
  {id:'codoReventilado',emoji:'🔩',nombre:'Codo reventilado',icono:'/iconos_accesorios/codo90rl.svg', cat: 'Codos'},
  {id:'sifon',emoji:'🧼',nombre:'Sifón',icono:'/iconos_aparatos/sifon.svg', cat:'Otros'},
  ...ACCESORIOS_YEE,
  {id:'tee',emoji:'🔧',nombre:'Tee',icono:'/iconos_accesorios/te_ramal.svg', cat:'Tees'},
];

export const GAS_ACCESORIOS = [
  {id:'codos_90_std', emoji:'🔩', nombre:'Codos 90° std', icono:'/iconos_accesorios/codo90rc.svg', cat:'Codos'},
  {id:'codos_90_rl',  emoji:'🔩', nombre:'Codos 90° rl',  icono:'/iconos_accesorios/codo90rl.svg', cat:'Codos'},
  {id:'te_linea',     emoji:'🔧', nombre:'Te en línea',    icono:'/iconos_accesorios/te_en_linea.svg', cat:'Tees'},
  {id:'te_ramal',     emoji:'🔧', nombre:'Te ramal',       icono:'/iconos_accesorios/te_ramal.svg', cat:'Tees'},
  {id:'valvula_bola', emoji:'🚰', nombre:'Válvula bola',   icono:'/iconos_accesorios/valvBola.svg', cat:'Válvulas'},
];
