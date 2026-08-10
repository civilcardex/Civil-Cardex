import { ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS } from '../constants';

export function getAccessoryOptions(netId: string) {
  if (netId === 'san') {
    return SAN_ACCESORIOS.filter(
      (a) =>
        a.id === 'codo90rmSube' ||
        a.id === 'codo90rmBaja' ||
        a.id === 'codoReventilado' ||
        a.id === 'sifon',
    ).map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (['ll', 'vent'].includes(netId)) {
    return SAN_ACCESORIOS.map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: válvulas (incluida llave terminal — válida como accesorio de extremo, ver
    // ExtremeAccessoryEditor.tsx), válvulas de pie, reducciones, ampliaciones, otros, el codo
    // medio 90° (codo90rm — las variantes sube/baja ya no se ofrecen: en redes de presión el
    // codo de 90° no tiene esa distinción, un solo codo cubre ambos sentidos), y tee
    // sube/baja/con tapón/con llave terminal (marcadores de glifo puros — no necesitan ramal
    // aparte, a diferencia del auto-tee del montante). La teeDirecto simple sigue excluida: una
    // tee plana siempre se auto-detecta geométricamente (renderJunctions.ts). El 'tapon' simple
    // sigue excluido: tapar la pierna libre de una tee pasa por 'teeTapon' ahora, no por una
    // tapa pelada sin marca de tee. teeReduccion/teeLado quedan excluidas de ESTE dropdown
    // específicamente — siguen disponibles desde el contador de accesorios del sidebar y el
    // modal de detección de uniones, solo que no como elección de glifo de cuerpo aquí.
    return ACCESORIOS_HIDRO.filter(
      (a) =>
        (a.cat !== 'Codos' && a.cat !== 'Tees' && a.id !== 'tapon') ||
        a.id === 'codo90rm' ||
        a.id === 'teeSube' ||
        a.id === 'teeBaja' ||
        a.id === 'teeTapon' ||
        a.id === 'teeLlaveTerminal',
    ).map((a) =>
      a.id === 'codo90rm'
        ? { value: a.id, label: 'Codo medio 90°' }
        : { value: a.id, label: a.nombre },
    );
  }
  return [];
}
