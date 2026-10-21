// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderEnJsdom } from '../../../../test/render.tsx';
import ChequeoCanalesLluvias from '../RainChannelsCheck.tsx';
import { RainwaterProvider } from '../../context/RainwaterContext.tsx';
import { PlansProvider } from '../../context/PlansContext.tsx';

/**
 * Caracterizaci\u00f3n del chequeo de canales de lluvias: congela lo que se ve hoy antes de
 * partir el archivo (sub-componente + c\u00e1lculo por fila a m\u00f3dulos).
 */
describe('RainChannelsCheck · chequeo de canales de lluvias', () => {
  it('monta (con o sin canales) sin romperse', async () => {
    const { container, unmount } = await renderEnJsdom(
      <PlansProvider>
        <RainwaterProvider>
          <ChequeoCanalesLluvias />
        </RainwaterProvider>
      </PlansProvider>,
    );
    const texto = container.textContent || '';
    expect(texto).toContain('Chequeo capacidad canal recolectora');
    await unmount();
  });
});
