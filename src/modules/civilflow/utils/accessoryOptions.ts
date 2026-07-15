import { ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS } from '../constants';

export function getAccessoryOptions(netId: string) {
  if (netId === 'san') {
    return SAN_ACCESORIOS.filter(a => a.id === 'codo90rmSube' || a.id === 'codo90rmBaja' || a.id === 'codoReventilado' || a.id === 'sifon').map(a => ({ value: a.id, label: a.nombre }));
  }
  if (['ll', 'vent'].includes(netId)) {
    return SAN_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: válvulas, válvulas de pie, reducciones, ampliaciones, otros, y codos de subida/bajada (sin tees ni el resto de codos)
    return ACCESORIOS_HIDRO.filter(a => (a.cat !== 'Codos' && a.cat !== 'Tees') || a.id === 'codo90rmSube' || a.id === 'codo90rmBaja').map(a => ({ value: a.id, label: a.nombre }));
  }
  return [];
}
