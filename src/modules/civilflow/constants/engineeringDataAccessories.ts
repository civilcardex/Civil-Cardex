export const ACCESORIOS_HIDRO = [
  {id:'codo90rc',emoji:'🔩',nombre:'Codo corto 90°',icono:'/iconos_civilflow/accesorios/codo90rc.webp', cat: 'Codos'},
  {id:'codo45rc',emoji:'🔩',nombre:'Codo corto 45°',icono:'/iconos_civilflow/accesorios/codo45rc.webp', cat: 'Codos'},
  {id:'codo90rm',emoji:'🔩',nombre:'Codo 90°',icono:'/iconos_civilflow/accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codo90rl',emoji:'🔩',nombre:'Codo largo 90°',icono:'/iconos_civilflow/accesorios/codo90rl.webp', cat: 'Codos'},
  {id:'codo90rmSube',emoji:'🔩',nombre:'Codo 90° sube',icono:'/iconos_civilflow/accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codo90rmBaja',emoji:'🔩',nombre:'Codo 90° baja',icono:'/iconos_civilflow/accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'teeDirecto',emoji:'🔧',nombre:'Tee',icono:'/iconos_civilflow/accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'teeReduccion',emoji:'🔧',nombre:'Tee c/ reducción',icono:'/iconos_civilflow/accesorios/teeReduccion.webp', cat: 'Tees'},
  {id:'teeLado',emoji:'🔧',nombre:'Tee paso lado',icono:'/iconos_civilflow/accesorios/teeLado.webp', cat: 'Tees'},
  {id:'teeBilateral',emoji:'🔧',nombre:'Tee salida bilateral',icono:'/iconos_civilflow/accesorios/teeBilateral.webp', cat: 'Tees'},
  {id:'teeSube',emoji:'🔧',nombre:'Tee sube',icono:'/iconos_civilflow/accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'teeBaja',emoji:'🔧',nombre:'Tee baja',icono:'/iconos_civilflow/accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'teeTapon',emoji:'🔧',nombre:'Tee con tapón',icono:'/iconos_civilflow/accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'teeLlaveTerminal',emoji:'🔧',nombre:'Tee con llave terminal',icono:'/iconos_civilflow/accesorios/teeDirecto.webp', cat: 'Tees'},
  {id:'tapon',emoji:'🔘',nombre:'Tapón',icono:'/iconos_civilflow/accesorios/otros.webp', cat: 'Otros'},
  {id:'valvGlobo',emoji:'🚰',nombre:'Válvula globo',icono:'/iconos_civilflow/accesorios/valvGlobo.webp', cat: 'Válvulas'},
  {id:'valvCompuerta',emoji:'🚰',nombre:'Válvula compuerta',icono:'/iconos_civilflow/accesorios/valvCompuerta.webp', cat: 'Válvulas'},
  {id:'valvCheque',emoji:'✔️',nombre:'Válvula cheque',icono:'/iconos_civilflow/accesorios/valvCheque.webp', cat: 'Válvulas'},
  {id:'valvPie',emoji:'🪣',nombre:'Válvula pie',icono:'/iconos_civilflow/accesorios/valvPie.webp', cat: 'Válvulas'},
  {id:'valvAngulo',emoji:'🚰',nombre:'Válvula ángulo',icono:'/iconos_civilflow/accesorios/valvAngulo.webp', cat: 'Válvulas'},
  {id:'llaveTerminal',emoji:'🚰',nombre:'Llave Terminal',icono:'/iconos_civilflow/accesorios/valvCompuerta.webp', cat: 'Válvulas'},
  {id:'reduccion',emoji:'🔽',nombre:'Reducción',icono:'/iconos_civilflow/accesorios/reduccion.webp', cat: 'Otros'},
  {id:'ampliacion',emoji:'🔼',nombre:'Ampliación',icono:'/iconos_civilflow/accesorios/ampliacion.webp', cat: 'Otros'},
  {id:'otros',emoji:'➕',nombre:'Otros',icono:'/iconos_civilflow/accesorios/otros.webp', cat: 'Otros'},
];

export const ACCESORIOS_YEE = [
  {id:'yeeSimple', emoji:'🔧', nombre:'Yee simple', icono:'/iconos_civilflow/accesorios/ye_simple.webp', cat:'Tees'},
  {id:'yeeDoble', emoji:'🔧', nombre:'Yee doble', icono:'/iconos_civilflow/accesorios/ye_doble.webp', cat:'Tees'},
];

export const SAN_ACCESORIOS = [
  ...ACCESORIOS_HIDRO.filter(a => a.id === 'codo90rm' || a.id === 'codo45rc'),
  {id:'codo90rmSube',emoji:'🔩',nombre:'Codo 90° sube',icono:'/iconos_civilflow/accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codo90rmBaja',emoji:'🔩',nombre:'Codo 90° baja',icono:'/iconos_civilflow/accesorios/codo90rm.webp', cat: 'Codos'},
  {id:'codoReventilado',emoji:'🔩',nombre:'Codo reventilado',icono:'/iconos_civilflow/accesorios/codo90rl.webp', cat: 'Codos'},
  {id:'sifon',emoji:'🪤',nombre:'Sifón',icono:'/iconos_civilflow/accesorios/otros.webp', cat: 'Otros'},
  ...ACCESORIOS_YEE,
];

export const GAS_ACCESORIOS = [
  {id:'codos_90_std', emoji:'🔩', nombre:'Codos 90° std', icono:'/iconos_civilflow/accesorios/codo90rc.webp', cat:'Codos'},
  {id:'codos_90_rl',  emoji:'🔩', nombre:'Codos 90° rl',  icono:'/iconos_civilflow/accesorios/codo90rl.webp', cat:'Codos'},
  {id:'te_linea',     emoji:'🔧', nombre:'Te en línea',    icono:'/iconos_civilflow/accesorios/te_en_linea.webp', cat:'Tees'},
  {id:'te_ramal',     emoji:'🔧', nombre:'Te ramal',       icono:'/iconos_civilflow/accesorios/te_ramal.webp', cat:'Tees'},
  {id:'valvula_bola', emoji:'🚰', nombre:'Válvula bola',   icono:'/iconos_civilflow/accesorios/valvBola.webp', cat:'Válvulas'},
];
