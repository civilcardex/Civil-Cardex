// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../../test/render.tsx';
import { TablaTipologiasConfirmDel, TablaTipologiasHeader } from '../typologiesChrome';

/** El thead y el modal extraídos de TableTypologies montan sin crashear y conservan la
 *  estructura normativa (grupos NTC 3631 en fila 1, modal con rol alertdialog). */
describe('typologiesChrome', () => {
  it('el header pinta los 6 grupos de columnas y los botones ＋/−', async () => {
    const { container } = await renderEnJsdom(
      <table>
        <TablaTipologiasHeader
          filas={[]}
          edit={false}
          borrandoSub={false}
          onAdd={() => {}}
          onToggleBorrar={() => {}}
        />
      </table>,
    );
    const html = container.innerHTML;
    for (const grupo of [
      'Recinto',
      'Gasodomésticos',
      'Verificación',
      'Solución',
      'Cálculo',
      'Rejillas sugeridas',
    ])
      expect(html).toContain(grupo);
    expect(html).toContain('aria-label="Añadir un aparato al sector seleccionado"');
    // Sin edición: ambos botones deshabilitados.
    expect(html).toContain('disabled');
  });

  it('el modal de borrado anuncia el sector y expone cancelar/confirmar', async () => {
    const cancelarRef = { current: null } as React.RefObject<HTMLButtonElement | null>;
    const { container } = await renderEnJsdom(
      <TablaTipologiasConfirmDel
        sector="Cocina 2"
        cancelarRef={cancelarRef}
        onCancelar={() => {}}
        onConfirmar={() => {}}
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('Cocina 2');
    expect(html).toContain('Cancelar');
    expect(html).toContain('Eliminar');
  });
});
