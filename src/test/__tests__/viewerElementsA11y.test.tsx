// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { expectAxe } from '../axe.ts';
import { renderEnJsdom } from '../render.tsx';
import PdfViewerDrawnElements from '../../modules/civilflow/components/pdfViewer/PdfViewerDrawnElements.tsx';
import type PlanoEngine from '../../modules/civilflow/lib/PlanoEngine/PlanoEngine.ts';

it('el listado ofrece controles identificables y una sola selección', async () => {
  const selectById = vi.fn();
  const { container, unmount } = await renderEnJsdom(
    <PdfViewerDrawnElements
      drawnElements={[
        {
          id: 'r1',
          label: 'Ramal 1',
          tipo: 'ramal',
          type: 'ramal',
          totalL: 2,
          segs: 1,
          piso: 'P1',
        },
      ]}
      activeNet="af"
      selectedId="r1"
      engineRef={{ current: { selectById } as unknown as PlanoEngine }}
      onEdit={vi.fn()}
    />,
  );
  try {
    expect(container.querySelectorAll('button[aria-current="true"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Editar Ramal 1"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Borrar Ramal 1"]')).toBeNull();
    await expectAxe(container);
  } finally {
    await unmount();
  }
});
