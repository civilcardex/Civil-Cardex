// REGRESIÓN del "piso fantasma _bak" (orig. usuario 2026-10-22): el sanador de herencia
// guardaba su respaldo como `trazos_<pid>_bak` — el MISMO namespace que `idsDePlanos()`
// barre — y el documento completo entraba a la propagación como si fuera un piso: piezas
// duplicadas y aparatos de los enlazados al DOBLE. Hoy `idsDePlanos` excluye `_bak`, pero
// cualquier llave de respaldo futura con otro sufijo debe seguir excluida: este test pinnea
// el CONTRATO (respaldos bajo trazos_* jamás se propagan), no la llave.
import { describe, it, expect, beforeEach } from 'vitest';
import { propagarAparatosPresion } from '../propagation';
import {
  resetStorage,
  seedTrazos,
  seedAparatos,
  aparatos,
} from '../../../../test/storageHarness.ts';

beforeEach(() => {
  resetStorage();
});

describe('piso fantasma: documentos de respaldo bajo trazos_* no se propagan', () => {
  it('un `trazos_1_bak` con ramales NO dobla los conteos del piso real', () => {
    // Piso REAL (1): un ramal con un aparato.
    seedTrazos('1', {
      ramales: [
        {
          id: 'RS1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [50, 0],
          ],
          aparatoInicio: 'lvm',
        },
      ],
      bajantes: [],
    });
    // Respaldo del MISMO piso (era del sanador): copia del doc bajo sufijo _bak, con OTRO
    // aparato que NO existe en el piso real — si entrara a la propagación, contaminaría.
    seedTrazos('1_bak', {
      ramales: [
        {
          id: 'RS1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [50, 0],
          ],
          aparatoInicio: 'lvm',
        },
        {
          id: 'RS_FANTASMA',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [150, 0],
          ],
          aparatoInicio: 'tin',
        },
      ],
      bajantes: [],
    });
    seedAparatos({
      af_RS1_1: { lvm: 1 },
      af_RS_FANTASMA_1_bak: { tin: 1 },
    });

    propagarAparatosPresion('af');

    // El piso real queda exactamente con SU aparato; la pieza fantasma jamás genera clave.
    expect(aparatos()['af_RS1_1']).toEqual({ lvm: 1 });
    expect(aparatos()['af_RS1_1_bak']).toBeUndefined();
    expect(aparatos()['af_RS_FANTASMA_1']).toBeUndefined();
  });
});
