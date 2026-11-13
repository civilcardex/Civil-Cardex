// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderYVer } from '../../../../../test/render.tsx';
import { CorteSvg } from '../RCISvgCorte.tsx';
import { PlanSvg } from '../RCISvgPlan.tsx';
import { VrpSvg } from '../RCISvgVrp.tsx';
import { CotaH, CotaV } from '../RCISvgCotas.tsx';
import type { Criterios } from '../../../lib/rci/types';

/**
 * Caracterización de los esquemas SVG de RCI extraídos de RCISvgFloorplan (extracción
 * verbatim: estos tests fijan el contenido que NO debe cambiar al partir el monolito).
 * La geometría es literal del HTML de referencia — aquí solo se fijan textos/estructura.
 */

// La geometría solo lee estos campos: el resto del Criterios va con ceros (cast de test).
const roc = {
  K: 5.6,
  Pmin: 7,
  S: 4.3,
  L: 3.53,
  Dmuro: 1.7,
  hz: { s: 2.4 },
  Nramal: 3,
  Nramales: 3,
  Nultimo: 3,
  Llargo: 8.5,
} as unknown as Criterios;

describe('RCISvgCorte (CorteSvg)', () => {
  it('dibuja la bajada con la resta de cotas y etiqueta VCP/DF', async () => {
    const cont = await renderYVer(
      <CorteSvg roc={roc} mont={{ hD: 2.5, hS: 1.2 }} zRam={5.3} zNudoRaiz={null} />,
    );
    expect(cont.textContent).toContain('bajada 2,80 m');
    expect(cont.textContent).toContain('(5,30 − 2,50)');
    expect(cont.textContent).toContain('VCP');
    expect(cont.textContent).toContain('NPT del piso');
  });

  it('sin cota de ramales muestra los textos de "pendiente"', async () => {
    const cont = await renderYVer(<CorteSvg roc={roc} mont={{ hD: 2.5, hS: 1.2 }} />);
    expect(cont.textContent).toContain('altura deriv.');
    expect(cont.textContent).toContain('cota ramales − altura deriv.');
  });
});

describe('RCISvgPlan (PlanSvg)', () => {
  it('con área+numeración+nodos dibuja todas las capas', async () => {
    const cont = await renderYVer(
      <PlanSvg roc={roc} opts={{ area: true, number: true, nodes: true, dims: true }} />,
    );
    expect(cont.textContent).toContain('Lado largo 1,2·√A');
    // Cot de S sin valor (doctrina 2026-11-13: solo la letra, el número lo da el paso).
    expect(cont.textContent).toContain('S');
    expect(cont.textContent).toContain('Derivación del montante');
    // 9 rociadores numerados (3x3) + nudos A-D.
    expect(cont.querySelectorAll('svg circle').length).toBeGreaterThan(9);
  });

  it('sin opts solo dibuja la tubería base (muro, sin cotas)', async () => {
    const cont = await renderYVer(<PlanSvg roc={roc} />);
    expect(cont.textContent).toContain('Muro');
    expect(cont.textContent).not.toContain('S = ');
  });
});

describe('RCISvgVrp (VrpSvg)', () => {
  it('dibuja la instalación típica con nota al pie', async () => {
    const cont = await renderYVer(<VrpSvg />);
    expect(cont.textContent).toContain('VRP');
    expect(cont.textContent).toContain('Detector de flujo');
    expect(cont.textContent).toContain('Gabinete');
    expect(cont.textContent).toContain('Esquema típico de referencia');
  });
});

describe('RCISvgCotas (CotaH/CotaV)', () => {
  it('cada cota es un <g> con línea y 2 flechas', async () => {
    const cont = await renderYVer(
      <svg>
        <CotaH x1={0} x2={80} y={10} />
        <CotaV x={10} y1={0} y2={80} />
      </svg>,
    );
    expect(cont.querySelectorAll('line').length).toBe(2);
    expect(cont.querySelectorAll('path').length).toBe(4);
  });
});
