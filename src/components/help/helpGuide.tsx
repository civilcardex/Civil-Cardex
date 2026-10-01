// Guía contextual del panel de AYUDA (orig. usuario: "que sea algo guía para saber para qué
// funciona cada parte de la pestaña"). Contenido derivado del inventario funcional real de
// cada pestaña/visor — cada ítem es un elemento de UI con su propósito. Claves:
//   cf:<tab> · cf:iso:<sub> · cm:catalogos:<tab> · cm:<seccion>

export interface GuiaItem {
  nombre: string;
  desc: string;
}

export interface GuiaGrupo {
  titulo: string;
  items: GuiaItem[];
}

export type GUIA_TYPE = Record<string, GuiaGrupo[]>;

/** Icono material por grupo de ayuda (búsqueda por palabra en el título; primer match manda).
 *  AyudaPanel lo muestra junto al chevron — sin esto el modal se veía plano. */
const ICONOS_POR_TITULO: Array<[string, string]> = [
  // Primero: matchea antes que 'panel derecho' — icono propio del grupo "Panel derecho por elemento".
  ['por elemento', 'category'],
  ['herramienta', 'construction'],
  ['panel derecho', 'tune'],
  ['menú contextual', 'mouse'],
  ['redes', 'layers'],
  ['redes activa', 'layers'],
  ['barra superior', 'web_asset'],
  ['calibra', 'straighten'],
  ['subir', 'upload'],
  ['requisito', 'checklist'],
  ['origen', 'location_searching'],
  ['recorte', 'crop'],
  ['isometría', 'view_in_ar'],
  ['detalle', '3d_rotation'],
  ['bomba', 'heat_pump'],
  ['equipo de presión', 'compress'],
  ['contra incendio', 'fire_extinguisher'],
  ['material', 'inventory_2'],
  ['catálogo', 'book_2'],
  ['aparato', 'plumbing'],
  ['gasodom', 'cooking'],
  ['sanitaria', 'water_drop'],
  ['lluvia', 'rainy'],
  ['agua fría', 'ac_unit'],
  ['agua caliente', 'hot_tub'],
  ['equipo', 'precision_manufacturing'],
  ['gas', 'propane_tank'],
  ['informe', 'description'],
  ['memoria', 'article'],
  ['anexo', 'attach_file'],
  ['plano', 'map'],
  ['norma', 'gavel'],
  ['criterio', 'tune'],
  ['identificación', 'badge'],
  ['generador', 'layers'],
  ['área', 'select_all'],
  ['texto', 'title'],
  ['medir', 'rule'],
  ['guía', 'grid_on'],
  ['contador', 'speed'],
  ['caja', 'inbox'],
  ['borrador', 'delete'],
  ['snap', 'magnet'],
  ['grilla', 'grid_4x4'],
  ['guardar', 'save'],
  ['ajustar', 'fit_screen'],
  ['nivel', 'swap_vert'],
  ['copiar', 'content_copy'],
  ['dato', 'table_rows'],
  ['elemento', 'list_alt'],
  ['ramal', 'spline'],
  ['bajante', 'arrow_downward'],
  ['origen', 'arrow_upward'],
  ['bomba', 'heat_pump'],
  ['cámara', 'photo_camera'],
  ['potencia', 'bolt'],
  ['diámetro', 'radio_button_checked'],
  ['cisterna', 'water_tank'],
  ['setpoint', 'thermostat'],
  ['verificación', 'verified'],
  ['cómo funciona', 'info'],
  ['factor', 'calculate'],
  ['país', 'public'],
  ['salario', 'payments'],
  ['cargo', 'group'],
  ['insumo', 'forklift'],
  ['proveedor', 'store'],
  ['presupuesto', 'request_quote'],
  ['apu', 'functions'],
];

/** Icono para un título de grupo (fallback 'help'). */
export function iconoDeGrupo(titulo: string): string {
  const t = titulo.toLowerCase();
  for (const [palabra, icono] of ICONOS_POR_TITULO) {
    if (t.includes(palabra)) return icono;
  }
  return 'help';
}

export const GUIA: GUIA_TYPE = {
  // ─────────────────────────── CIVIL FLOW ───────────────────────────
  'cf:info': [
    {
      titulo: 'Identificación del proyecto',
      items: [
        {
          nombre: 'Nombre / Dirección / Ciudad / País',
          desc: 'Datos que aparecen en las memorias de cálculo y portadas de informes. Cambiar el nombre actualiza la base de datos.',
        },
        {
          nombre: 'Uso del edificio',
          desc: 'Vivienda, comercial, institucional… define dotaciones y criterios normativos por defecto.',
        },
        {
          nombre: 'Botón EDITAR / LISTO',
          desc: 'Cada tarjeta está protegida: pulsa el lápiz para editar sus campos y LISTO para confirmar.',
        },
      ],
    },
    {
      titulo: 'Redes activas',
      items: [
        {
          nombre: 'Conmutadores de red',
          desc: 'Activa/desactiva cada red (agua fría, sanitaria, lluvias, gas…). Solo las redes activas se dibujan, calculan y aparecen en informes.',
        },
        {
          nombre: 'Selector de color',
          desc: 'Elige el color de cada red: se usa en el visor, isometría y tablas. Se guarda con el proyecto.',
        },
        {
          nombre: 'Reglas automáticas',
          desc: 'Ventilación se activa/apaga junto con Sanitaria; Canal recolectora exige Aguas lluvias activa.',
        },
        {
          nombre: '¿Cómo se alimenta la red? (bajo Agua fría)',
          desc: 'Elige Equipo de presión, Tanque alto (ingresa el NPT de salida) o Red pública (presión garantizada en PSI). Alimenta los cálculos de presión de toda la red.',
        },
      ],
    },
    {
      titulo: 'Equipos activos',
      items: [
        {
          nombre: 'Equipo de presión / Bomba aguas residuales',
          desc: 'Habilita las secciones de diseño de esos equipos en Diseño de redes y sus páginas de resultados.',
        },
      ],
    },
    {
      titulo: 'Generador de pisos y niveles',
      items: [
        {
          nombre: 'Pisos / Altura entrepiso / Sótanos / NPT P1 / Incluir cubierta',
          desc: 'Genera automáticamente la lista de niveles del proyecto con sus NPT iniciales.',
        },
        {
          nombre: 'Niveles generados',
          desc: 'Cada nivel lista su NPT (editable, altura de la losa terminada). + Sótano y + Piso agregan niveles sueltos; ✕ elimina.',
        },
      ],
    },
  ],

  'cf:planos': [
    {
      titulo: 'Requisitos del plano',
      items: [
        {
          nombre: '📋 Requisitos para carga',
          desc: 'Abre la guía de exportación desde AutoCAD: configuración previa, PDF, calibración dual X/Y (Δ < 3%) y errores frecuentes. Léelo antes de subir el primer plano.',
        },
        {
          nombre: 'Tarjetas de requisitos',
          desc: 'Escala definida, 1 plano por nivel, cotas NPT, redes por color y simbología NTC 1500.',
        },
        {
          nombre: 'Recorte del plano',
          desc: 'Define un área de recorte que SOLO afecta la isometría (el visor sigue usando el plano completo). Zoom/pan y arrastre de rectángulo.',
        },
      ],
    },
    {
      titulo: 'Subir y organizar planos',
      items: [
        {
          nombre: 'Zona SOLTAR PARA SUBIR',
          desc: 'Arrastra uno o varios PDF (o usa SUBIR PLANO). Cada archivo queda como plano pendiente.',
        },
        {
          nombre: 'ASIGNAR PISO',
          desc: 'Vincula el plano a un nivel del proyecto y luego marca el origen (punto de coordenadas 0,0 compartido entre pisos).',
        },
        {
          nombre: 'CALIBRAR',
          desc: 'Abre el configurador para definir escala real del plano (ver grupo de abajo).',
        },
        {
          nombre: 'CONFIRMAR',
          desc: 'Fija el plano en su nivel. Solo los confirmados se pueden dibujar y se descargan en los planos de red.',
        },
        {
          nombre: '⚠ Origen compartido',
          desc: 'Aviso: dos hojas tienen el mismo origen en píxeles — revisa que el marcado de origen sea coherente para la navegación entre pisos.',
        },
        {
          nombre: 'DIBUJAR REDES EN ESTE PLANO →',
          desc: 'Va directo al visor con ese plano ya cargado.',
        },
      ],
    },
    {
      titulo: 'Recorte para isometría',
      items: [
        {
          nombre: 'Panel Recorte (isometría)',
          desc: 'Vive bajo la barra izquierda de Carga de planos, con un plano seleccionado: miniatura del PDF con el rectángulo naranja de la zona. Botones Recortar (editor de arrastre) y Quitar.',
        },
        {
          nombre: 'Alcance global',
          desc: 'La zona es UNA sola para todos los planos ya cargados (no por plano): la isometría recorta cada lámina con el mismo rectángulo relativo.',
        },
        {
          nombre: 'Tamaño mínimo',
          desc: 'El editor exige ancho y alto ≥ 2% de la hoja; debajo de eso no guarda.',
        },
        {
          nombre: 'Efecto en isometría',
          desc: 'Solo deforma la lámina de fondo (drawImage recortada); trazos, bajantes y cotas no se mueven.',
        },
      ],
    },
    {
      titulo: 'Calibración (configurador)',
      items: [
        {
          nombre: 'Δ x.x%',
          desc: 'Diferencia entre la calibración horizontal y vertical. Debe quedarse baja (< 3%); si no, re-traza las cotas.',
        },
        {
          nombre: 'Escala definida / calibrada',
          desc: 'La escala elegida en el plano original (1:50…) y la que se obtiene midiendo: es la que realmente gobierna el dibujo.',
        },
        {
          nombre: '📍 Definir origen',
          desc: 'Marca el punto del plano que coincide con el origen común de pisos (para que los trazos de varios pisos queden alineados).',
        },
        {
          nombre: 'Cal X / Cal Y',
          desc: 'Traza una línea de longitud conocida por eje para calcular el factor de escala real en cada dirección.',
        },
        { nombre: '💾 Guardar configuración', desc: 'Persiste nivel, escala y origen del plano.' },
      ],
    },
  ],

  'cf:datos': [
    {
      titulo: 'Materiales por red',
      items: [
        {
          nombre: 'Tubería (material)',
          desc: 'Material por defecto con el que se dibujan los tramos de cada red; define el n de Manning, coeficiente C y diámetros comerciales disponibles.',
        },
        {
          nombre: 'Profundidad de instalación (m)',
          desc: 'Profundidad respecto al NPT que se usa para calcular longitudes verticales y obras de protección mecánica.',
        },
      ],
    },
    {
      titulo: 'Catálogo de aparatos sanitarios',
      items: [
        {
          nombre: 'Sigla / Tipo de control',
          desc: 'Identifica cada aparato (LV, IN, DU…) y su control de descarga (llave, tanque, fluxómetro).',
        },
        {
          nombre: 'UC AF / UC AC / UD RS',
          desc: 'Unidades de consumo de agua fría y caliente y unidades de descarga sanitaria del aparato. Alimentan las tablas de diseño y el panel de aparatos del visor — ajústalas si tu norma o proyecto difiere.',
        },
      ],
    },
    {
      titulo: 'Catálogo de gasodomésticos',
      items: [
        {
          nombre: 'Consumo m³/hr',
          desc: 'Consumo de cada equipo a gas (NTC 3728) — base del caudal del método de Renouard. Solo lectura.',
        },
      ],
    },
    {
      titulo: 'Catálogo maestro',
      items: [
        {
          nombre: 'Botón Catálogo maestro',
          desc: 'Abre el catálogo completo de materiales: diámetros comerciales, coeficientes (n, C, K) y coeficientes de escorrentía C por material de cubierta.',
        },
      ],
    },
  ],

  'cf:visor': [
    {
      titulo: 'Barra superior de redes',
      items: [
        {
          nombre: 'Escala 1:X',
          desc: 'Escala calibrada del plano actual. Todo el dibujo se mide con ella.',
        },
        {
          nombre: 'Botones de red',
          desc: 'Cambian la red activa de dibujo (sanitaria, agua fría, lluvias, gas…). Cada red guarda su trazado por separado.',
        },
        { nombre: '👁 Ojo', desc: 'Muestra/oculta el trazado completo de esa red (no lo borra).' },
        {
          nombre: '🔒 Candado',
          desc: 'Bloquea la edición de esa red para no modificarla por accidente mientras trabajas en otra.',
        },
        {
          nombre: 'Cerrar dibujo',
          desc: 'Valida diámetros pendientes en todos los pisos, guarda y regresa al área de trabajo.',
        },
      ],
    },
    {
      titulo: 'Herramientas (barra izquierda)',
      items: [
        {
          nombre: 'Seleccionar (S)',
          desc: 'Clic sobre cualquier elemento para ver/editar sus datos. Shift+clic o arrastre agrega a la multi-selección.',
        },
        {
          nombre: 'Ramal principal (R) / Tributario (T)',
          desc: 'Traza tuberías de la red activa. El ramal recibe los aparatos; el tributario descarga en un ramal. Enter termina, Escape cancela.',
        },
        {
          nombre: 'Bajante (B) / Montante (M)',
          desc: 'Glifos verticales: bajantes (san/ll/vent) y montantes (af/ac/gas). Se conectan a ramales y entre pisos.',
        },
        {
          nombre: 'Área (A) / Texto (C) / Medir (D)',
          desc: 'Área de drenaje con su caudal, anotaciones libres y cotas con medida real calibrada.',
        },
        {
          nombre: 'Línea guía (U)',
          desc: 'Trazo auxiliar para alinear. Menú derecho: crear ramal/tributario desde la guía y ajustar a 45°/90°.',
        },
        {
          nombre: 'Contador (O) / Canal (L) / Cajas (J)',
          desc: 'Contadores y calentadores (af/gas), canal recolector con ramales interiores (lluvias) y cajas de inspección.',
        },
        {
          nombre: 'Borrador (E)',
          desc: 'Borra trazos al pasar; los tributarios quedan re-anclados automáticamente.',
        },
        {
          nombre: 'Snap (G) / Grilla (H)',
          desc: 'Imán a extremos/intersecciones existentes y rejilla visual.',
        },
        {
          nombre: 'Guardar / Deshacer / Rehacer',
          desc: 'Autoguardado con estado visible; Ctrl+Z / Ctrl+Y revierten elementos, aparatos y conteos.',
        },
        { nombre: 'Ajustar', desc: 'Encaja el PDF completo a la pantalla.' },
        {
          nombre: 'Borrar elementos de red / líneas guía',
          desc: 'Limpia todo el trazado de la red activa (con confirmación) o todas las guías de todos los pisos.',
        },
      ],
    },
    {
      titulo: 'Panel derecho de edición',
      items: [
        {
          nombre: 'Nivel',
          desc: 'Cambia de piso: lista los niveles con 🟢 si tienen plano confirmado. El trazado de cada piso es independiente y los bajantes enlazan entre pisos.',
        },
        {
          nombre: 'Copiar elementos',
          desc: 'Duplica el trazado de otro piso al actual: elige plano origen, redes y tipos de elemento. Pregunta qué hacer con los bajantes fantasma.',
        },
        {
          nombre: 'Aparatos (acordeón)',
          desc: 'Contadores +/− por aparato del ELEMENTO seleccionado: calcula UC/UD al instante y dibuja los símbolos. Sin selección dice "Selecciona un ramal/bajante"; con selección, "Asignado a <tramo>".',
        },
        {
          nombre: 'Accesorios (acordeón)',
          desc: 'Codos y accesorios por diámetro para AF/AC, y accesorios de gas, según el tramo seleccionado.',
        },
        {
          nombre: 'Elementos dibujados',
          desc: 'Lista de los elementos de la red activa; clic para localizarlos en el plano.',
        },
        {
          nombre: 'Botón ↻ grados',
          desc: 'Rota la etiqueta del elemento seleccionado entre 0/45/90/−45/−90 grados donde el editor lo permite.',
        },
      ],
    },
    {
      titulo: 'Panel derecho por elemento',
      items: [
        {
          nombre: 'Ramal / Tributario',
          desc: 'Etiqueta del tramo, nodo inicial/final (— inicial — / — final —), material, diámetro con validación ("no permitido" si viola la regla de la red), pendiente % (san/ll), ΔZ y descargas simultáneas. Pie con resumen L=…m · n pts · tipo.',
        },
        {
          nombre: 'Bajante / Montante / Caja',
          desc: 'Código editable del glifo y sus asociaciones entre pisos: origen (piso superior), destino y área drenada. Diámetro, dirección y llenado R se cambian desde el menú contextual.',
        },
        {
          nombre: 'Contador',
          desc: 'Datos del contador de agua fría o gas conectado al trazado; sus campos alimentan la red aguas abajo.',
        },
        {
          nombre: 'Calentador',
          desc: 'Datos del calentador de AC (capacidad/tipo): fija la presión de entrada de toda la red de agua caliente.',
        },
        {
          nombre: 'Canal',
          desc: 'Base, altura, longitud (cm) y pendiente % (0–15, con alerta fuera de rango) en una sola fila; base/longitud se normalizan a base-corta al escribir. Abajo, "Ramales del canal": por cada ramal interior, el desplegable elige su bajante de destino.',
        },
        {
          nombre: 'Área / Texto',
          desc: 'Etiqueta del área de drenaje (alimenta el método racional) o contenido de la anotación libre.',
        },
      ],
    },
    {
      titulo: 'Menú contextual (clic derecho)',
      items: [
        {
          nombre: 'Sobre un ramal',
          desc: 'Etiqueta, material, diámetro, dirección de flujo (con modal para decidir a qué ramal van las UC), bloquear movimiento, asignar accesorio en el cuerpo, convertir tributario↔ramal principal, segmento libre de la tee, bajantes y cajas asociados, y qué etiquetas mostrar (nombre/guía/dirección/material/longitud).',
        },
        {
          nombre: 'Sobre un bajante o montante',
          desc: 'Origen y destino (piso), área drenada, diámetro, dirección de flujo, razón de llenado R, unidades de descarga, cajas asociadas y asociar/desasociar la bomba del piso inferior.',
        },
        {
          nombre: 'Sobre un canal',
          desc: 'Datos del canal (base/altura/longitud/pendiente) y sus ramales con el bajante asociado de cada uno.',
        },
        {
          nombre: 'Sobre un contador o calentador',
          desc: 'Sus datos específicos y el tramo al que alimentan.',
        },
        {
          nombre: 'Sobre un área o texto',
          desc: 'Etiqueta/contenido y presentación.',
        },
        {
          nombre: 'Sobre una línea guía',
          desc: 'Crear ramal o tributario(s) desde la guía (con ajuste y recorte del trazo cruzado), Ajustar a 45°/90° de la red y eliminar la guía.',
        },
      ],
    },
  ],

  'cf:redes': [
    {
      titulo: 'Cómo funciona esta pestaña',
      items: [
        {
          nombre: 'Botonera de redes + flechas ‹ ›',
          desc: 'Cambia entre redes activas y entre las páginas de cada red (cálculo → diseño → chequeos → accesorios).',
        },
        {
          nombre: 'EDITAR / LISTO por tarjeta',
          desc: 'Los diámetros y campos de cálculo solo son editables con el lápiz activo. Todo lo demás es resultado en vivo de lo dibujado.',
        },
      ],
    },
    {
      titulo: 'Sanitaria',
      items: [
        {
          nombre: 'Cálculo de unidades de descarga',
          desc: 'Conteo de aparatos por piso y UD acumuladas por bajante (tabla NTC 1500).',
        },
        {
          nombre: 'Diseño sanitario',
          desc: 'Tramos con UD propia/de otros/acumulada, caudal, diámetro calculado vs propuesto (editable), tirante, Froude, velocidad y fuerza tractiva ≥ 0.15.',
        },
        {
          nombre: 'Bajantes y ventilación',
          desc: 'Por bajante: pisos, UD, fracción de llenado, capacidad % y velocidad terminal; bloque de ventilación con longitudes editables.',
        },
        {
          nombre: 'Resumen accesorios',
          desc: 'Totales de codos, tees y demás accesorios agrupados por diámetro para presupuestar.',
        },
      ],
    },
    {
      titulo: 'Aguas lluvias',
      items: [
        {
          nombre: 'Diseño lluvias',
          desc: 'Tramos con caudal acumulado por método racional, Manning y verificación de capacidad y Froude.',
        },
        {
          nombre: 'Chequeo bajantes',
          desc: 'Q de diseño vs capacidad Wyly-Eaton (razón de llenado y Manning del material), en % — ver Normatividad.',
        },
        {
          nombre: 'Chequeo canales',
          desc: 'Capacidad del canal de cubierta (vertedero + canal rectangular) con área, pendiente y base/altura editables.',
        },
      ],
    },
    {
      titulo: 'Agua fría y agua caliente',
      items: [
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'UC por aparato y piso; base del caudal de diseño por tramo (curva K).',
        },
        {
          nombre: 'Diseño de red (tabla grande)',
          desc: '23 columnas: UC propia/otros/caudal, K, diámetro estimado vs propuesto (editable), velocidad, pérdidas por fricción y presión inicial/final. Los chips "Otros Ramales" saltan a los tramos conectados.',
        },
        {
          nombre: 'Acometida (AF)',
          desc: 'Presión y diámetro de acometida + contador, con la presión garantizada o el tanque definidos en Información general.',
        },
        {
          nombre: 'Selección calentador (AC)',
          desc: 'Propone el calentador según el consumo de la red y hereda su presión.',
        },
      ],
    },
    {
      titulo: 'Gas',
      items: [
        {
          nombre: 'Datos generales',
          desc: 'Altitud, presión atmosférica, temperatura, presión mínima del operador y densidad relativa de la ciudad de diseño (Editar para modificar).',
        },
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'Unidades de consumo por aparato para el caudal de diseño de la red de gas.',
        },
        {
          nombre: 'Diseño de red + Chequeo',
          desc: 'Tabla de tramos con material y diámetro por Renouard (NTC 3728), diámetro interno, K y longitud; incluye el chequeo de la red y alimenta la memoria.',
        },
        {
          nombre: 'Resumen accesorios por diámetro',
          desc: 'Codos, tees y válvulas de la red de gas resumidos por diámetro nominal.',
        },
      ],
    },
    {
      titulo: 'Red contra incendio',
      items: [
        {
          nombre: 'Pestaña en construcción',
          desc: 'El diseño de la red contra incendio aún no está montado en Diseño de redes: este espacio queda reservado. Mientras tanto, el visor 3D del cuarto de bombas vive en Isometría.',
        },
      ],
    },
    {
      titulo: 'Equipos',
      items: [
        {
          nombre: 'Bomba aguas residuales',
          desc: 'Caudal de bombeo (reserva 25%), alturas y TDH, selección de bomba y dimensionamiento de cámara con ampliación.',
        },
        {
          nombre: 'Equipo de presión',
          desc: 'Datos de entrada, cálculo hidráulico y potencia, diámetros y cisterna del equipo de presión constante.',
        },
      ],
    },
  ],

  'cf:inf': [
    {
      titulo: 'Informes y descargas',
      items: [
        {
          nombre: 'Resumen del proyecto',
          desc: 'Ficha con nombre, dirección, uso y estado por red (✓ OK / ✗ Revisar) según las validaciones de diseño.',
        },
        {
          nombre: 'Memorias finales (Excel/Word/PDF)',
          desc: 'Memoria de cálculo completa por red: datos, tablas de diseño y verificaciones. Se desactiva mientras alguna red tenga errores.',
        },
        {
          nombre: 'Anexo — detalle de aparatos',
          desc: 'PDF fijo con el detalle de instalación de cada aparato hidrosanitario.',
        },
        {
          nombre: 'Planos de red',
          desc: 'PDF con los planos confirmados y sus redes dibujadas encima.',
        },
      ],
    },
  ],

  'cf:crit': [
    {
      titulo: 'Referencias normativas',
      items: [
        {
          nombre: 'Filtros (AF/AC, Sanitaria, Lluvias, Gas, RCI)',
          desc: 'Recortan las tarjetas de normas a la red de interés.',
        },
        {
          nombre: 'Tarjetas por norma',
          desc: 'Resumen práctico de NTC 1500, RAS 2000, NTC 3728, NSR-10 J, NFPA 13 y NTC 3096 con sus numerales clave.',
        },
      ],
    },
    {
      titulo: 'Criterios de diseño (tabla editable)',
      items: [
        {
          nombre: '+ Agregar / ✕',
          desc: 'Crea o elimina criterios propios del proyecto (parámetro, valor, unidad).',
        },
        {
          nombre: 'Norma / Artículo / Evidencia',
          desc: 'Documenta de dónde sale cada criterio y cómo se cumple — viaja con el proyecto a las memorias.',
        },
        {
          nombre: '↺ Restaurar',
          desc: 'Vuelve a los criterios por defecto de la app (CRIT0) borrando los personalizados.',
        },
      ],
    },
  ],

  // ── Isometría (sub-pestañas) ──
  'cf:iso:1': [
    {
      titulo: 'Redes',
      items: [
        {
          nombre: 'Vista isométrica',
          desc: 'Representación 3D de las cajas y redes dibujadas por nivel: revisa continuidad vertical y colisiones.',
        },
        {
          nombre: 'Navegación de cámara',
          desc: 'Rotar/pan/zoom para recorrer la instalación; usa el recorte definido en Carga de planos si existe.',
        },
      ],
    },
  ],
  'cf:iso:2': [
    {
      titulo: 'Aparatos',
      items: [
        {
          nombre: 'Desplegable "Aparato:"',
          desc: 'Elige el aparato a inspeccionar: el visor carga su modelo 3D de instalación.',
        },
        {
          nombre: 'Descripción y Referencia normativa',
          desc: 'Qué hace el aparato, qué norma lo rige (NTC 1500, RAS 2000…) y su nota normativa con links oficiales.',
        },
      ],
    },
  ],
  'cf:iso:3': [
    {
      titulo: 'Cuarto bomba red contra incendio',
      items: [
        {
          nombre: 'Desplegable "Componente:"',
          desc: 'Cada pieza del cuarto de bombas (tanque, bombas, siamesa, tableros, banco de pruebas…) con su función.',
        },
        {
          nombre: 'Referencia normativa',
          desc: 'Numeral exacto de NFPA 20/25, NSR-10 J, NTC 1669/2301/2050 y RETIE por componente.',
        },
        {
          nombre: 'Nota de diseño',
          desc: 'Alcance del esquema y descargo de responsabilidad con links a las normas oficiales.',
        },
      ],
    },
  ],
  'cf:iso:4': [
    {
      titulo: 'Equipo de presión constante',
      items: [
        {
          nombre: 'Desplegable "Componente:"',
          desc: 'Bomba, recipiente de vejiga, tablero y accesorios del equipo: qué hace cada uno.',
        },
        {
          nombre: 'Nota normativa',
          desc: 'RAS 2000, NTC 1500, RETIE y NFPA 20 cuando el equipo sirve a protección contra incendios.',
        },
      ],
    },
  ],
  'cf:iso:5': [
    {
      titulo: 'Red contra incendio',
      items: [
        {
          nombre: 'Desplegable "Componente:"',
          desc: 'Los 14 componentes de la red RCI (riser, gabinete, rociadores…) con su descripción.',
        },
        {
          nombre: 'Referencia normativa',
          desc: 'NFPA 13/20/25, NTC 2301/1669, NSR-10 J.4 y series UL/FM según el componente.',
        },
      ],
    },
  ],

  // ─────────────────────────── CIVIL MANAGER ───────────────────────────
  'cm:catalogos:configuracion': [
    {
      titulo: 'Parámetros APU',
      items: [
        {
          nombre: 'Salario base, auxilio, días/mes, horas/mes',
          desc: 'Base para calcular jornales y costo/hora de todos los cargos (respeta el perfil de país).',
        },
        {
          nombre: 'Herramienta menor %, Administración %, Imprevistos %, Utilidad %',
          desc: 'Porcentajes globales por defecto que usan los APU y presupuestos (pueden sobreescribirse por presupuesto).',
        },
        {
          nombre: 'Usar F.P. en cada APU / Aplicar AIU / Valor resumido',
          desc: 'Política de cálculo: factor prestacional incrustado o final, AIU por APU o al total, y si el presupuesto discrimina AIU.',
        },
      ],
    },
    {
      titulo: 'Factor prestacional y perfil de país',
      items: [
        {
          nombre: 'Tabla de factores por grupo',
          desc: 'Prestaciones, seguridad social y parafiscales (%): se suman al costo de cada cargo. Agrega los tuyos por grupo.',
        },
        {
          nombre: 'Perfil de país — Activo/Usar',
          desc: 'Copia moneda, SMMLV, auxilio y jornada de un país (31 perfiles precargados) a la configuración global.',
        },
      ],
    },
    {
      titulo: 'Listas auxiliares',
      items: [
        {
          nombre: 'Unidades, Categorías, Tipos de equipo, Orígenes, Unid. transporte',
          desc: 'Listas que alimentan los desplegables de insumos, APU y equipos. Borrado bloqueado si están en uso.',
        },
      ],
    },
  ],
  'cm:catalogos:colaboradores': [
    {
      titulo: 'Colaboradores (cargos)',
      items: [
        {
          nombre: 'N° Salarios Base',
          desc: 'Cuántos salarios mínimos gana el cargo (1.0 ayudante, 5.0 ingeniero jr…).',
        },
        {
          nombre: 'Costo Total Día / Hora',
          desc: 'Calculado: valor básico + factor prestacional, convertido a día y hora con la jornada del país. Se usa en cuadrillas y APU.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva de cargos con vista previa antes de aplicar.',
        },
        {
          nombre: 'Borrado con referencias',
          desc: 'No deja borrar un cargo usado en cuadrillas o APU — indica en qué.',
        },
      ],
    },
  ],
  'cm:catalogos:cuadrillas': [
    {
      titulo: 'Cuadrillas',
      items: [
        {
          nombre: 'Tabla maestro + panel derecho',
          desc: 'Selecciona una cuadrilla para editar su nombre y sus integrantes (cargo + cantidad).',
        },
        {
          nombre: 'Costo/día y Costo/hora',
          desc: 'Suma de los jornales de sus integrantes — es lo que divide el rendimiento en el APU.',
        },
        {
          nombre: 'Agregar Integrante',
          desc: 'Añade filas cargo/cantidad; el costo se recalcula en vivo.',
        },
      ],
    },
  ],
  'cm:catalogos:equipos': [
    {
      titulo: 'Equipos',
      items: [
        {
          nombre: 'Costo/Hora',
          desc: 'Tarifa horaria del equipo que se reparte por rendimiento en la sección Equipo del APU.',
        },
        {
          nombre: 'Cotizado',
          desc: 'Fecha de la última cotización — se resalta cuando está vieja para que la actualices.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva con vista previa; borrado bloqueado si el equipo está en algún APU.',
        },
      ],
    },
  ],
  'cm:catalogos:insumos': [
    {
      titulo: 'Insumos',
      items: [
        {
          nombre: 'Unidad / Costo Unitario',
          desc: 'Unidad de medida y precio de compra del material (categoría, marca y proveedor opcionales).',
        },
        {
          nombre: 'Origen = Preparado en obra',
          desc: 'El costo NO se digita: se toma del APU básico seleccionado (ej. concreto mezclado en sitio) y se actualiza en cadena.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva con vista previa; borrado bloqueado si el insumo está en APU.',
        },
      ],
    },
  ],
  'cm:catalogos:proveedores': [
    {
      titulo: 'Proveedores',
      items: [
        {
          nombre: 'Nombre, NIT, contacto, ciudad',
          desc: 'Ficha comercial del proveedor (teléfonos, correo, dirección, notas).',
        },
        {
          nombre: 'Asociación con catálogos',
          desc: 'Los equipos e insumos pueden referenciar al proveedor; el borrado se bloquea mientras exista esa referencia.',
        },
      ],
    },
  ],
  'cm:apus': [
    {
      titulo: 'Catálogo de APU',
      items: [
        {
          nombre: 'Nuevo APU',
          desc: 'Crea un análisis con código automático APU-xxx; elige categoría y unidad de obra.',
        },
        {
          nombre: 'Costo Unitario en vivo',
          desc: 'Se recalcula al editar cualquier recurso (motor de cálculo central).',
        },
        {
          nombre: 'Exportar Excel / PDF',
          desc: 'Ficha completa del APU (secciones A–D + total) para entregar o revisar.',
        },
        {
          nombre: 'APU básico (preparado en obra)',
          desc: 'Marca el APU como costo origen para insumos "preparado en obra".',
        },
      ],
    },
    {
      titulo: 'Editor por secciones',
      items: [
        {
          nombre: 'A. Mano de obra',
          desc: 'Cargos × cantidad de personas y rendimiento (und/día): el jornal sale con su factor prestacional.',
        },
        { nombre: 'B. Equipo', desc: 'Equipos con su rendimiento y costo/hora.' },
        {
          nombre: 'C. Insumos',
          desc: 'Consumo por unidad + desperdicio % (5% por defecto). Los "preparado en obra" toman el precio del APU básico.',
        },
        {
          nombre: 'D. Transporte',
          desc: 'Tarifa × distancia (km) según unidad de transporte; Global ignora distancia.',
        },
        {
          nombre: 'Resumen',
          desc: 'Mano de obra + herramienta menor % + prestaciones + equipo + insumos + transporte = Total directo.',
        },
      ],
    },
  ],
  'cm:presupuestos': [
    {
      titulo: 'Proyectos',
      items: [
        {
          nombre: 'Nuevo Presupuesto',
          desc: 'Crea un presupuesto que copia (snapshot) catálogos, factores y APU del momento: lo que calcule después no cambia si editas los catálogos globales.',
        },
        {
          nombre: 'Estado (Borrador/En Revisión/Cerrado)',
          desc: 'Control de ciclo de vida editable en línea en la tabla.',
        },
      ],
    },
    {
      titulo: 'Ítems',
      items: [
        {
          nombre: 'Agregar Ítem',
          desc: 'Filas con descripción, unidad, cantidad y APU asignado. El Vr. Unitario sale del APU (en rojo si falta).',
        },
        {
          nombre: 'Marcar como capítulo',
          desc: 'Convierte la fila en agrupador de capítulo para organizar el presupuesto.',
        },
      ],
    },
    {
      titulo: 'Resumen AIU',
      items: [
        {
          nombre: 'Administración / Imprevistos / Utilidad / IVA sobre utilidad',
          desc: 'Porcentajes propios de ESTE presupuesto (sobre la base configurada): calcula el valor total a partir del costo directo.',
        },
      ],
    },
    {
      titulo: 'Entregables e importación',
      items: [
        {
          nombre: 'Excel detallado / Listado de precios / PDF ficha',
          desc: 'Tres exportaciones del presupuesto listas para el cliente.',
        },
        {
          nombre: 'Importar Formulario',
          desc: 'Sube el Excel del cliente, mapea columnas (ítem, descripción, unidad, cantidad) y crea los ítems en lote; el mapeo se guarda como favorito.',
        },
      ],
    },
  ],
};
