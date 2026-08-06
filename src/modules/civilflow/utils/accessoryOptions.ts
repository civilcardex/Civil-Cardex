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
    // ExtremeAccessoryEditor.tsx), válvulas de pie, reducciones, ampliaciones, otros, codos de
    // subida/bajada, y tee sube/baja/con tapón/con llave terminal (pure glyph markers — no
    // separate ramal needed, unlike montante's auto-tee). Plain teeDirecto
    // stays excluded: a plain tee is always geometrically auto-detected (renderJunctions.ts).
    // Plain 'tapon' stays excluded: capping a tee's free leg
    // goes through 'teeTapon' now, not a bare cap with no tee mark. teeReduccion/teeLado stay
    // excluded from THIS dropdown specifically — still available from the sidebar accessory
    // counter and the junction-detection modal, just not as a body-glyph choice here.
    return ACCESORIOS_HIDRO.filter(
      (a) =>
        (a.cat !== 'Codos' && a.cat !== 'Tees' && a.id !== 'tapon') ||
        a.id === 'codo90rmSube' ||
        a.id === 'codo90rmBaja' ||
        a.id === 'teeSube' ||
        a.id === 'teeBaja' ||
        a.id === 'teeTapon' ||
        a.id === 'teeLlaveTerminal',
    ).map((a) => ({ value: a.id, label: a.nombre }));
  }
  return [];
}
