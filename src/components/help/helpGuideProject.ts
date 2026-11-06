/**
 * Guía contextual — dominio PROYECTO: 'cf:info' (identificación), 'cf:planos' (carga de planos)
 * y 'cf:datos' (aparatos/criterios del proyecto). Contenido puro, lo consume helpGuideFlow.
 * Ej: 'cf:info' documenta los campos de identificación (nombre, dirección, uso del edificio).
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';
import { GUIA_RECORTE } from './helpGuideCrop.tsx';

export const GUIA_PROJECT: GUIA_TYPE = {
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
    // Recorte para isometría: grupo COLAPSABLE propio (ped. usuario) — misma guía que ve el
    // editor de recorte en su contexto cf:recorte; su tour se repite desde AYUDA del editor.
    { titulo: GUIA_RECORTE.titulo, items: GUIA_RECORTE.items },
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
};
