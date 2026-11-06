/**
 * Guía contextual — dominio VISOR: 'cf:visor' (calibración, trazado, menús del visor de planos).
 * Contenido puro, lo consume helpGuideFlow.
 * Ej: la tarjeta de calibración explica cómo fijar la escala del plano.
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';

export const GUIA_VIEWER: GUIA_TYPE = {
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
};
