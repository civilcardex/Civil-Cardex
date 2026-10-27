// Pasos de los tours por pantalla/pestaña: visor, cada pestaña del workarea flow y cada
// sección de CivilManager. Cada paso ancla por selector (data-tour/aria-label/clase ya
// existentes); si el ancla no existe u está oculta, la tarjeta va centrada — no se rompe.
// Textos destilados de la guía de ayuda (helpGuideFlow / helpGuideManager).
import type { TourStep } from './TourOverlay.tsx';

export type TourClave = string;

/** Qué tour corresponde a la pantalla del contexto de Ayuda actual (null si ninguno).
 *  Sub-contexto recortado: cf:redes:san → cf:tab:redes; cm:catalogos:insumos viaja completo. */
export function tourDe(keyAyuda: string): TourClave | null {
  if (keyAyuda === 'cf:visor') return 'cf:visor';
  // El editor de recorte publica SU contexto mientras está abierto: repetir tour = su tour.
  if (keyAyuda === 'cf:recorte') return 'cf:recorte';
  if (keyAyuda.startsWith('cf:iso')) {
    const n = Number(keyAyuda.split(':')[2]) || 1;
    return `cf:tab:iso:${n}`;
  }
  if (keyAyuda.startsWith('cf:')) return `cf:tab:${keyAyuda.split(':')[1]}`;
  if (keyAyuda.startsWith('cm:')) return keyAyuda;
  return null;
}

const cierre = {
  titulo: '¡Listo!',
  desc: 'El botón AYUDA de la barra superior trae la guía completa de esta pantalla cuando la necesites.',
};

export const TOURS: Record<TourClave, TourStep[]> = {
  'cf:visor': [
    {
      sel: '[data-tour="redes"]',
      titulo: 'Redes y escala',
      desc: 'Elige sobre qué red dibujas: sanitaria, lluvias, agua fría/caliente, gas, ventilación… El chip de escala muestra los m/px de la lámina.',
    },
    {
      sel: '[data-tour="toolbar"]',
      titulo: 'Herramientas de dibujo',
      desc: 'Seleccionar, trazar ramales, tributarios, cotas, áreas y textos. Los trazos se dibujan sobre el PDF con la escala calibrada.',
    },
    {
      sel: '[data-tour="canvas"]',
      titulo: 'Lienzo',
      desc: 'Clic derecho sobre un elemento abre su menú (diámetro, dirección, asociar entre pisos). La rueda hace zoom y el clic central desplaza.',
    },
    {
      sel: '.visor-sidebar-right',
      titulo: 'Panel de edición',
      desc: 'Lo que hayas seleccionado se edita aquí: aparatos del tramo, diámetros, asociaciones. También se copian elementos de otro piso.',
    },
    {
      sel: '[data-tour="planos-pisos"]',
      titulo: 'Planos y pisos',
      desc: 'Cambia de piso aquí: cada piso (sótano, niveles, cubierta) es una lámina del proyecto con su propio dibujo. "+ Agregar" sube más planos PDF.',
    },
    cierre,
  ],

  'cf:tab:info': [
    {
      sel: '[data-tour="cf-tab-info"]',
      titulo: 'Información general',
      desc: 'Datos del proyecto (nombre, ubicación, clientes) y la guía de uso recomendada: el orden de pestañas es el flujo del diseño.',
    },
    {
      sel: '[data-tour="barra-redes"]',
      titulo: 'Redes del proyecto',
      desc: 'La barra inferior salta al diseño de cualquier red activa desde cualquier pestaña.',
    },
    cierre,
  ],
  'cf:tab:planos': [
    {
      sel: '[data-tour="planos-requisitos"]',
      titulo: 'Requisitos del plano',
      desc: 'Antes de subir: formato, escala y elementos que debe traer tu PDF para que la calibración salga bien.',
    },
    {
      sel: '[data-tour="planos-recorte"]',
      titulo: 'Recorte (isometría)',
      desc: 'Opcional: define qué zona del plano se ve en la isometría. No afecta al visor de dibujo; el tour del editor se repite desde Ayuda.',
    },
    {
      sel: '[data-tour="planos-pendientes"]',
      titulo: 'Pendientes de subir',
      desc: 'Arrastra aquí los PDF de cada piso (o usa «Subir planos»): todavía no entran al visor hasta calibrarlos.',
    },
    {
      sel: '[data-tour="planos-cargados"]',
      titulo: 'Planos cargados',
      desc: 'Los pisos listos: selecciónalos para abrirlos en el visor. El estado de calibración se marca en cada tarjeta.',
    },
    cierre,
  ],
  'cf:tab:datos': [
    {
      sel: '[data-tour="datos-materiales"]',
      titulo: 'Materiales por red',
      desc: 'Define el material de cada sistema: con esto se calculan las pérdidas y los diámetros propuestos.',
    },
    {
      sel: '[data-tour="datos-aparatos"]',
      titulo: 'Catálogo de aparatos sanitarios',
      desc: 'Los aparatos y sus unidades de desagüe (UD): lo que dibujas en el visor toma sus valores de aquí.',
    },
    {
      sel: '[data-tour="datos-gas"]',
      titulo: 'Catálogo de gasodomésticos',
      desc: 'Equipos de gas con su consumo: alimenta el diseño de la red de gas.',
    },
    cierre,
  ],
  'cf:tab:redes': [
    {
      sel: '[data-tour="redes-chips"]',
      titulo: 'Selector de red',
      desc: 'Cada botón es una red activa del proyecto: al entrar se cargan sus parámetros de diseño específicos.',
    },
    {
      sel: '[data-tour="redes-contenido"]',
      titulo: 'Contenido de la red',
      desc: 'La página de la red activa: tablas de cálculo y resultados (p. ej. «Diseño de red aguas lluvias»). Revisa las filas y usa «EDITAR» para abrir el diseño en el visor.',
    },
    {
      sel: '[data-tour="barra-redes"]',
      titulo: 'Acceso rápido',
      desc: 'La barra inferior también salta entre redes desde cualquier pestaña.',
    },
    cierre,
  ],
  'cf:tab:iso:1': [
    {
      sel: '[data-tour="iso-toolbar"]',
      titulo: 'Barra de la isometría',
      desc: 'Filtra las redes visibles, muestra u oculta los planos de fondo y controla giro, altura y zoom de la vista 3D.',
    },
    {
      sel: '[data-tour="iso-sidebar"]',
      titulo: 'Panel de tramos',
      desc: 'Árbol de ramales y bajantes por red y piso: elige uno para ubicarlo en la isometría y ver sus totales.',
    },
    {
      sel: '[data-tour="iso-canvas"]',
      titulo: 'Isometría · Redes',
      desc: 'Vista 3D de las redes que dibujaste: gira con el mouse y revisa cómo quedó la instalación.',
    },
    cierre,
  ],
  'cf:tab:iso:2': [
    {
      sel: '[data-tour="iso-canvas"]',
      titulo: 'Isometría · Aparatos',
      desc: 'Los aparatos sanitarios en 3D, ubicados donde los dibujaste en el visor.',
    },
    {
      sel: '[data-tour="iso-viewer-sidebar"]',
      titulo: 'Panel de aparatos',
      desc: 'Desplegable con el catálogo de aparatos, la descripción del seleccionado y la nota normativa (RAS / NTC 1500).',
    },
    cierre,
  ],
  'cf:tab:iso:3': [
    {
      sel: '[data-tour="iso-canvas"]',
      titulo: 'Isometría · Cuarto de bombas RCI',
      desc: 'Modelo del cuarto de bombas de la red contra incendio.',
    },
    {
      sel: '[data-tour="iso-viewer-sidebar"]',
      titulo: 'Panel de componentes',
      desc: 'Catálogo del cuarto de bombas: al elegir un componente se muestra su descripción y su referencia normativa.',
    },
    cierre,
  ],
  'cf:tab:iso:4': [
    {
      sel: '[data-tour="iso-canvas"]',
      titulo: 'Isometría · Equipo de presión',
      desc: 'El equipo de presión constante (EPC) en 3D con sus componentes.',
    },
    {
      sel: '[data-tour="iso-viewer-sidebar"]',
      titulo: 'Panel del equipo',
      desc: 'Componentes del equipo de presión constante (EPC) — bombas, tanque y accesorios — con su descripción.',
    },
    cierre,
  ],
  'cf:tab:iso:5': [
    {
      sel: '[data-tour="iso-canvas"]',
      titulo: 'Isometría · Red contra incendio',
      desc: 'La red RCI completa en 3D: gabinetes, tuberías y recorridos.',
    },
    {
      sel: '[data-tour="iso-viewer-sidebar"]',
      titulo: 'Panel de la red',
      desc: 'Los componentes de la red (gabinetes, tuberías, válvulas…), su descripción y la nota NFPA. El botón LUPA de arriba activa la lupa.',
    },
    cierre,
  ],
  'cf:tab:inf': [
    {
      sel: '[data-tour="cf-tab-inf"]',
      titulo: 'Informes',
      desc: 'Tablas de diseño y memoria de cálculo por red, listas para revisar y exportar.',
    },
    cierre,
  ],
  'cf:tab:crit': [
    {
      sel: '[data-tour="cf-tab-crit"]',
      titulo: 'Normativa',
      desc: 'Verificación del diseño contra NTC 1500 y RAS: velocidad, recubrimientos, distancias y demás criterios.',
    },
    cierre,
  ],

  'cm:catalogos:configuracion': [
    {
      sel: '[aria-label="Configuración"]',
      titulo: 'Configuración',
      desc: 'Parámetros APU, factor prestacional, perfil de país, unidades y categorías: la base de todos los cálculos de costos.',
    },
    cierre,
  ],
  'cm:catalogos:colaboradores': [
    {
      sel: '.cm-main',
      titulo: 'Colaboradores',
      desc: 'Personal de la empresa con su cargo y costo horario: alimenta los APU y las cuadrillas.',
    },
    cierre,
  ],
  'cm:catalogos:cuadrillas': [
    {
      sel: '.cm-main',
      titulo: 'Cuadrillas',
      desc: 'Grupos de trabajo combinando colaboradores y equipos: se usan como unidad en los análisis de precios.',
    },
    cierre,
  ],
  'cm:catalogos:equipos': [
    {
      sel: '.cm-main',
      titulo: 'Equipos',
      desc: 'Maquinaria y herramientas con su costo: rendimiento horario y costos de posesión/operación.',
    },
    cierre,
  ],
  'cm:catalogos:insumos': [
    {
      sel: '.cm-main',
      titulo: 'Insumos',
      desc: 'Materiales con su unidad y precio: la base de los rendimientos y del presupuesto.',
    },
    cierre,
  ],
  'cm:catalogos:proveedores': [
    {
      sel: '.cm-main',
      titulo: 'Proveedores',
      desc: 'Catálogo de proveedores por tipo de insumo para comparar precios.',
    },
    cierre,
  ],
  'cm:apus': [
    {
      sel: '.cm-main',
      titulo: 'Análisis de precios unitarios',
      desc: 'Cada APU arma su costo por secciones (mano de obra, equipos, insumos, transporte), exportable a Excel/PDF.',
    },
    cierre,
  ],
  'cm:presupuestos': [
    {
      sel: '[aria-label="Presupuestos"]',
      titulo: 'Presupuestos',
      desc: 'Proyectos, ítems, resumen AIU e importación de formulario: construye y entrega el presupuesto desde aquí.',
    },
    cierre,
  ],
  'cf:recorte': [
    {
      sel: '[data-tour="recorte-gestos"]',
      titulo: 'Gestos del editor',
      desc: 'Clic izquierdo dibuja o mueve una esquina del rectángulo, clic central desplaza el plano y la rueda hace zoom.',
    },
    {
      sel: '[data-tour="recorte-canvas"]',
      titulo: 'Dibuja el recorte',
      desc: 'Arrastra un rectángulo sobre el plano: lo que queda DENTRO es lo que se verá en la isometría.',
    },
    {
      sel: '[data-tour="recorte-acciones"]',
      titulo: 'Aplicar o salir',
      desc: '«Guardar recorte» aplica; «Volver» sale sin aplicar; «Borrar rectángulo» limpia para empezar de nuevo.',
    },
    cierre,
  ],
  'cf:catmaestro': [
    {
      sel: '[aria-label="Paginación de catálogo"]',
      titulo: 'Catálogo Maestro',
      desc: 'Las tablas de referencia (materiales, aparatos, coeficientes) se organizan en páginas: navega con estas flechas.',
    },
    {
      sel: '[data-tour="catmaestro-contenido"]',
      titulo: 'Tablas de catálogo',
      desc: 'Cada tarjeta es una tabla editable de valores por defecto del sistema. Cambia aquí y se refleja en todos los proyectos.',
    },
    cierre,
  ],
};
