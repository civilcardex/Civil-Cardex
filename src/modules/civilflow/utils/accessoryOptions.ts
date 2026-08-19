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
  if (netId === 'vent') {
    // La ventilación no admite sifón ni codo reventilado (ambos son de la rama sanitaria).
    return SAN_ACCESORIOS.filter((a) => a.id !== 'sifon' && a.id !== 'codoReventilado').map(
      (a) => ({ value: a.id, label: a.nombre }),
    );
  }
  if (netId === 'll') {
    return SAN_ACCESORIOS.map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: válvulas (incluida llave terminal — válida como accesorio de extremo, ver
    // ExtremeAccessoryEditor.tsx), válvulas de pie, reducciones, ampliaciones, otros, el codo
    // medio 90° en sus TRES orientaciones (codo90rm horizontal + codo90rmSube + codo90rmBaja —
    // el usuario pidió explícitamente que sube/baja vuelvan a ofrecerse: el codo de 90° de una
    // tubería de presión puede doblar hacia arriba o hacia abajo según el recorrido, y el
    // dropdown debe poder pedirlo), y tee sube/baja/con tapón/con llave terminal (marcadores de
    // glifo puros — no necesitan ramal aparte, a diferencia del auto-tee del montante). La
    // teeDirecto simple sigue excluida: una tee plana siempre se auto-detecta geométricamente
    // (renderJunctions.ts). El 'tapon' simple sigue excluido: tapar la pierna libre de una tee
    // pasa por 'teeTapon' ahora, no por una tapa pelada sin marca de tee. teeReduccion/teeLado
    // quedan excluidas de ESTE dropdown específicamente — siguen disponibles desde el contador
    // de accesorios del sidebar y el modal de detección de uniones, solo que no como elección
    // de glifo de cuerpo aquí.
    return ACCESORIOS_HIDRO.filter(
      (a) =>
        (a.cat !== 'Codos' && a.cat !== 'Tees' && a.id !== 'tapon') ||
        a.id === 'codo90rm' ||
        a.id === 'codo90rmSube' ||
        a.id === 'codo90rmBaja' ||
        a.id === 'teeSube' ||
        a.id === 'teeBaja' ||
        a.id === 'teeTapon' ||
        a.id === 'teeLlaveTerminal',
    ).map((a) =>
      a.id === 'codo90rm'
        ? { value: a.id, label: 'Codo 90° horizontal' }
        : a.id === 'codo90rmSube'
          ? { value: a.id, label: 'Codo 90° sube' }
          : a.id === 'codo90rmBaja'
            ? { value: a.id, label: 'Codo 90° baja' }
            : { value: a.id, label: a.nombre },
    );
  }
  return [];
}
