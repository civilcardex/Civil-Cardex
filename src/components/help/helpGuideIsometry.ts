/**
 * Guía contextual — dominio ISOMETRÍA: claves 'cf:iso:1' a 'cf:iso:5' (un paso de la guía por
 * clave; HelpPanel las aplana con flatMap). Contenido puro, lo consume helpGuideFlow.
 * Ej: 'cf:iso:1' es el primer paso del recorrido guiado por la isometría.
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';

export const GUIA_ISOMETRY: GUIA_TYPE = {
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
};
