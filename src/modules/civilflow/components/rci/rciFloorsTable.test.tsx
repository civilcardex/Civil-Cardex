// @vitest-environment jsdom
/** Regresión del «Piso tipo»: el input muestra el dato DIGITADO (pisoTipo), no la `planta`
 *  que el motor rellena sola. Si muestra `planta`, borrar no se ve y la siguiente letra nunca
 *  entra en el input controlado. */
import { expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../test/render.tsx';
import { TablaPisos } from './RCIFloorsTable.tsx';
import type { RciCtx } from './RCIUI.tsx';
import { clasificar } from '../../lib/rci/index.ts';
import { ejemploVerificacion } from '../../lib/rci/example.ts';
import { filasTipologias } from '../../utils/rci/RCIRowsModel.ts';

const escribir = (input: HTMLInputElement, valor: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

it('Piso tipo: nace vacío, se puede borrar, se reescribe y siempre en mayúscula', async () => {
  const st = ejemploVerificacion();
  const filas = filasTipologias(st, clasificar(st))
    .slice(0, 2)
    .map((f, i) => ({ ...f, planta: `P${i + 1}`, pisoTipo: i === 0 ? 'A' : '' }));
  const escrituras: Array<[number, string, string]> = [];
  /* Stub del ctx: la tabla solo lee clas.zonasAlmacenamiento y abriría el modal con editar. */
  const ctx = {
    estado: st,
    R: null,
    tips: null,
    edit: false,
    editar: () => {},
  } as unknown as RciCtx;
  const r = await renderEnJsdom(
    <TablaPisos
      ctx={ctx}
      filas={filas}
      nota="2 piso(s)"
      grupos={[]}
      globalEstado={st}
      setPiso={(i, k) => (v) => escrituras.push([i, String(k), v])}
    />,
  );
  // Uso y Piso tipo solo se editan con EDITAR activado.
  const usoAntes = r.container.querySelector('input.ds-px-84') as HTMLInputElement | null;
  expect(usoAntes?.readOnly).toBe(true);
  const editar = Array.from(r.container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'EDITAR',
  );
  expect(editar).toBeTruthy();
  editar!.click();
  await r.flush();

  const inputs = Array.from(r.container.querySelectorAll('input')).filter((el) =>
    el.getAttribute('aria-label')?.startsWith('Piso tipo'),
  ) as HTMLInputElement[];
  expect(inputs).toHaveLength(2);
  expect(inputs[0].readOnly).toBe(false);
  // Fila 1: digitado 'A' aunque la planta del motor sea 'P1'. Fila 2: vacía aunque planta='P2'.
  expect(inputs[0].value).toBe('A');
  expect(inputs[1].value).toBe('');
  expect(r.container.textContent).toContain('Piso tipo pendiente');
  expect(r.container.textContent).toContain('P2. Completa la columna');

  escribir(inputs[0], '');
  expect(escrituras.at(-1)).toEqual([0, 'pisoTipo', '']);
  escribir(inputs[0], 'b');
  expect(escrituras.at(-1)).toEqual([0, 'pisoTipo', 'B']);
  await r.unmount();
});
