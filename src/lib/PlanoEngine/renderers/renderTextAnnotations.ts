import type { IPlanoEngineCore } from '../PlanoEngineTypes';

export function renderTexts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.textAnnots.forEach((t: any) => {
    const c = engine.toCvs(t.x + (t.lblOffX || 0), t.y + (t.lblOffY || 0));
    const sel = t.id === engine.selId;
    const fs = engine.mm2cvs(t.fontMm || 2.5);
    const angle = (t.textAngle || 0) * Math.PI / 180;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);
    ctx.font = `${fs}px Geist, monospace`;
    const tw = t.boxW > 0 ? t.boxW * engine.zoom : ctx.measureText(t.text).width;
    const pad = 5;
    const boxW = tw + pad * 2;
    const boxH = fs + pad * 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = sel ? '#4D8FF7' : '#3a494a';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-pad, -fs - pad, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    // Yellow selection arrow (same style as ramales/bajantes)
    if (sel) {
      const arrowR = 12;
      const ox = boxW + 16;
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, -fs / 2);
      ctx.lineTo(ox, -fs / 2 - arrowR * 0.5);
      ctx.lineTo(ox, -fs / 2 + arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(t.text, 0, -fs);
    ctx.restore();

    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    t._box = {
      x: c.x - (boxW * cos + boxH * sin) / 2,
      y: c.y - (boxH * cos + boxW * sin) / 2,
      w: boxW * cos + boxH * sin,
      h: boxH * cos + boxW * sin,
    };
  });
}
