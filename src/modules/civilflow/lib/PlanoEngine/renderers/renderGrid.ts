import type { IPlanoEngineCore } from '../PlanoState';

// Separación real entre líneas de rejilla — 0.5 m, lo bastante fina para servir de verdad
// como ayuda de dibujo a escalas arquitectónicas típicas (1:50, 1:75, 1:100...). Antes era
// 1000 (1 m): cuadros demasiado grandes.
const GRID_SPACING_MM = 500;

export function renderGrid(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  // mm2cvs() espera mm de PAPEL, no mm del mundo real — realMmToCanvasPx() hace la conversión
  // real→papel (dividiendo por la escala de dibujo) antes de llamarla, igual que todo otro
  // símbolo de tamaño real del motor (glifos de accesorio, radios de bajante, etc). Llamar
  // mm2cvs(1000) directo aquí trataba 1000 como mm de papel — un METRO en espacio de papel —
  // separando las líneas de rejilla ~50x demasiado a escalas comunes, así que en la práctica
  // ninguna caía en pantalla.
  const stepPx = engine.realMmToCanvasPx(GRID_SPACING_MM);
  if (!Number.isFinite(stepPx) || stepPx < 4) return; // demasiado alejado — las líneas serían solo ruido visual

  // engine.cw.clientWidth/clientHeight (layout DOM en vivo) en vez de canv.width/dpr — las
  // dimensiones del atributo del canvas pueden quedarse un paso atrás del viewport real justo
  // después de que un PDF de fondo carga/redimensiona el área de dibujo, lo que reducía en
  // silencio los límites del loop de la rejilla a casi cero mientras todo otro renderer
  // (basado en offX/zoom, sin dependencia de canv.width) seguía funcionando bien.
  const dpr = engine.dpr || 1;
  const wCss = engine.cw?.clientWidth || engine.canv.width / dpr;
  const hCss = engine.cw?.clientHeight || engine.canv.height / dpr;

  // Anclar la primera línea a una posición de canvas alineada con la rejilla para que esta se
  // mantenga fija al origen del plano (no "nada" al hacer pan) en vez de empezar siempre en el
  // borde del viewport.
  const startX = engine.offX % stepPx;
  const startY = engine.offY % stepPx;

  ctx.save();
  // Antes 0.14 — demasiado tenue para distinguirse contra el PDF de fondo/dibujo cargado,
  // fácil de perder por completo a la opacidad normal de trabajo. Subida para que la rejilla
  // sirva de verdad como ayuda de dibujo, más una línea más gruesa cada 5 pasos (5 m) como
  // referencia gruesa.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,150,165,0.35)';
  ctx.beginPath();
  let i = 0;
  for (let x = startX; x < wCss; x += stepPx, i++) {
    if (i % 5 === 0) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hCss);
  }
  i = 0;
  for (let y = startY; y < hCss; y += stepPx, i++) {
    if (i % 5 === 0) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(wCss, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(120,150,165,0.55)';
  ctx.beginPath();
  i = 0;
  for (let x = startX; x < wCss; x += stepPx, i++) {
    if (i % 5 !== 0) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hCss);
  }
  i = 0;
  for (let y = startY; y < hCss; y += stepPx, i++) {
    if (i % 5 !== 0) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(wCss, y);
  }
  ctx.stroke();
  ctx.restore();
}
