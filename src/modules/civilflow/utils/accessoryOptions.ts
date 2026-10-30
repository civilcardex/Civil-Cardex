import { ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS } from '../constants';

/**
 * Opciones del dropdown de accesorios según la red: cada red admite un subconjunto del catálogo
 * (san (Sanitaria) sin codos de ventilación; vent (Ventilacion) sin sifón; af/ac sin tees directas...).
 * @param netId código de red (af, ac, san, ll, gas, vent, rci...).
 * @returns lista `{value, label}` para el selector; vacía si la red no admite cuerpos.
 */
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
    // 'tapon' (Tapón de limpieza) fuera de los CUERPOS (orig. usuario pt. 7) — sigue existiendo
    // como accesorio de extremo/menú.
    return SAN_ACCESORIOS.filter(
      (a) => a.id !== 'sifon' && a.id !== 'codoReventilado' && a.id !== 'tapon',
    ).map((a) => ({ value: a.id, label: a.nombre }));
  }
  if (netId === 'll') {
    // 'tapon' (Tapón de limpieza) fuera de los CUERPOS (orig. usuario pt. 7).
    return SAN_ACCESORIOS.filter((a) => a.id !== 'tapon').map((a) => ({
      value: a.id,
      label: a.nombre,
    }));
  }
  if (netId === 'gas') {
    // PUNTO 7b: 'teeTapon' ("Tapón soldado") fuera de los cuerpos de gas también.
    return GAS_ACCESORIOS.filter((a) => a.id !== 'teeTapon').map((a) => ({
      value: a.id,
      label: a.nombre,
    }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC (cuerpos, ped. usuario 2026-10-29): SIN reducción/ampliación/otros (cat 'Otros'),
    // SIN llave terminal pelada (solo teeLlaveTerminal). Los codos sube/baja SÍ se ofrecen en
    // cuerpo (la polaridad la resuelve el pase geométrico) — igual que teeSube/teeBaja.
    // teeDirecto excluida: la detecta el pase geométrico. teeTapon/teeReduccion/teeLado
    // excluidas de este dropdown.
    return ACCESORIOS_HIDRO.filter(
      (a) =>
        (a.cat !== 'Otros' && a.cat !== 'Codos' && a.cat !== 'Tees' && a.id !== 'tapon') ||
        a.id === 'codo90rm' ||
        a.id === 'codo90rmSube' ||
        a.id === 'codo90rmBaja' ||
        a.id === 'teeSube' ||
        a.id === 'teeBaja' ||
        a.id === 'teeLlaveTerminal',
    )
      .filter((a) => a.id !== 'llaveTerminal')
      .map((a) =>
        a.id === 'codo90rm'
          ? { value: a.id, label: 'Codo medio 90°' }
          : a.id === 'codo90rmSube'
            ? { value: a.id, label: 'Codo 90° sube' }
            : a.id === 'codo90rmBaja'
              ? { value: a.id, label: 'Codo 90° baja' }
              : { value: a.id, label: a.nombre },
      );
  }
  return [];
}
