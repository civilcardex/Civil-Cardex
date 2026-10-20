// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderYVer } from '../../../../../test/render';
import { ViewerMobileChrome } from '../ViewerMobileChrome';
import { useViewerResponsive } from '../useViewerResponsive';

/**
 * Caracterización de los módulos extraídos del PdfViewer (la extracción fue verbatim:
 * estos tests fijan el comportamiento que NO debe cambiar al partir el monolito).
 */

describe('ViewerMobileChrome', () => {
  it('en móvil muestra el banner de modo consulta y el nombre del plano', async () => {
    const cont = await renderYVer(
      <ViewerMobileChrome
        isMobile
        isNarrow
        currentFile={new File(['x'], 'Piso 1.pdf', { type: 'application/pdf' })}
        onFit={() => {}}
        onZoomStep={() => {}}
      />,
    );
    expect(cont.textContent).toContain('Modo consulta');
    expect(cont.textContent).toContain('Piso 1.pdf');
  });

  it('en escritorio no renderiza nada', async () => {
    const cont = await renderYVer(
      <ViewerMobileChrome
        isMobile={false}
        isNarrow={false}
        currentFile={null}
        onFit={() => {}}
        onZoomStep={() => {}}
      />,
    );
    expect(cont.innerHTML).toBe('');
  });

  it('en tablet (angosto, no móvil) NO muestra el banner pero sí los botones de zoom', async () => {
    const cont = await renderYVer(
      <ViewerMobileChrome
        isMobile={false}
        isNarrow
        currentFile={null}
        onFit={() => {}}
        onZoomStep={() => {}}
      />,
    );
    expect(cont.textContent).not.toContain('Modo consulta');
    expect(cont.querySelectorAll('button').length).toBe(3);
  });
});

describe('useViewerResponsive', () => {
  it('devuelve los flags y los setters de las sidebars', async () => {
    let visto: ReturnType<typeof useViewerResponsive> | null = null;
    function Banco() {
      visto = useViewerResponsive();
      return null;
    }
    await renderYVer(<Banco />);
    expect(visto).not.toBeNull();
    expect(typeof visto!.isMobile).toBe('boolean');
    expect(typeof visto!.isNarrow).toBe('boolean');
    expect(typeof visto!.setLeftCollapsed).toBe('function');
    expect(typeof visto!.setRightCollapsed).toBe('function');
  });
});
