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
    // AF/AC: válvulas, válvulas de pie, reducciones, ampliaciones, otros, codos de
    // subida/bajada, y tee sube/baja/con tapón (pure glyph markers — no separate ramal
    // needed, unlike montante's auto-tee). Plain teeDirecto and teeBilateral stay excluded:
    // a plain tee is always geometrically auto-detected (renderJunctions.ts) and teeBilateral
    // belongs to another net. Plain 'tapon' and 'llaveTerminal' stay excluded too: capping a
    // tee's free leg or terminating it goes through 'teeTapon'/'teeLlaveTerminal' now, not a
    // bare glyph with no tee mark. teeReduccion/teeLado/teeLlaveTerminal stay excluded from
    // THIS dropdown specifically — llave terminal is only valid at a true ramal extreme
    // (ExtremeAccessoryEditor) or via the "Segmento libre de la tee" stub button, never as a
    // body-glyph choice here.
    return ACCESORIOS_HIDRO.filter(
      (a) =>
        (a.cat !== 'Codos' && a.cat !== 'Tees' && a.id !== 'tapon' && a.id !== 'llaveTerminal') ||
        a.id === 'codo90rmSube' ||
        a.id === 'codo90rmBaja' ||
        a.id === 'teeSube' ||
        a.id === 'teeBaja' ||
        a.id === 'teeTapon',
    ).map((a) => ({ value: a.id, label: a.nombre }));
  }
  return [];
}
