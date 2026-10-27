import type { GuiaGrupo } from './helpGuideTypes.tsx';

// Instrucciones PROPIAS del recorte para isometría (ped. usuario): una sección COLAPSABLE
// más del panel de Ayuda, igual que las demás. Se ve en dos contextos con el mismo texto:
//   · Carga de planos (grupo dentro de su guía, junto a requisitos y calibración);
//   · el editor de recorte (contexto cf:recorte): allí el «⟲ REPETIR TOUR» del pie lanza
//     el tour del recorte (tourDe mapea cf:recorte → cf:recorte).

/** Guía del recorte para isometría: qué es, cómo se dibuja en el editor y qué afecta.
 *  Ej: el rectángulo se define UNA vez y la isometría recorta todas las láminas con él. */
export const GUIA_RECORTE: GuiaGrupo = {
  titulo: 'Recorte para isometría',
  items: [
    {
      nombre: 'Panel Recorte (isometría)',
      desc: 'Vive bajo la barra izquierda de Carga de planos, con un plano seleccionado: miniatura del PDF con el rectángulo naranja de la zona. Botones Recortar (abre el editor) y Quitar.',
    },
    {
      nombre: 'Editor: gestos',
      desc: 'Clic izquierdo dibuja el rectángulo o mueve una esquina; clic central desplaza el plano; la rueda hace zoom.',
    },
    {
      nombre: 'Editor: acciones',
      desc: '«Guardar recorte» aplica la zona; «Volver» sale sin aplicar; «Borrar rectángulo» limpia para empezar de nuevo.',
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
};
