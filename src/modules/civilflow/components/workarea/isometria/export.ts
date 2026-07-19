import type { RefObject } from "react";

interface ExportParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  size: { w: number; h: number };
  activeNets: Set<string>;
  nets: Array<{ id: string; name: string }>;
  proyNombre: string | undefined;
  rotX: number;
  rotZ: number;
  scaleZ: number;
  zoom: number;
  totals: { ramales: number; bajantes: number; len: string };
}

export async function exportPdf({ canvasRef, size, activeNets, nets, proyNombre, rotX, rotZ, scaleZ, zoom, totals }: ExportParams) {
  const canvas = canvasRef.current;
  if (!canvas || size.w < 10) return;
  const { jsPDF } = await import('jspdf');
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.text('Civil Flow', 15, 15);
  doc.setFontSize(11);
  const netNames = [...activeNets].map(id => nets.find(n => n.id === id)?.name).filter(Boolean).join(', ');
  doc.text(`Proyecto: ${proyNombre || '—'}`, 15, 23);
  doc.text(`Redes: ${netNames || '—'}`, 15, 31);

  doc.setDrawColor(180, 180, 180);
  doc.line(14, 35, pageW - 14, 35);

  const margin = 14;
  const usableW = pageW - margin * 2;
  const aspect = canvas.width / canvas.height;
  let imgW = usableW;
  let imgH = usableW / aspect;
  const maxImgH = pageH - 40 - margin;
  if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspect; }
  const imgX = margin + (usableW - imgW) / 2;
  const imgY = 40 + (maxImgH - imgH) / 2;
  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);

  doc.setFontSize(9);
  doc.text(`Vista: rotX=${rotX}° rotZ=${rotZ}° scaleZ=${scaleZ.toFixed(1)} zoom=${Math.round(zoom * 100)}%`, margin, pageH - 8);
  const dateStr = new Date().toLocaleDateString('es-CO');
  doc.text(`Tramos: ${totals.ramales} · Bajantes: ${totals.bajantes} · Long: ${totals.len}m`, pageW / 2, pageH - 8, { align: 'center' });
  doc.text(dateStr, pageW - margin, pageH - 8, { align: 'right' });

  doc.save(`civilflow_isometria_${(proyNombre || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
}

export function exportPng({ canvasRef, size, proyNombre }: Pick<ExportParams, 'canvasRef' | 'size' | 'proyNombre'>) {
  const canvas = canvasRef.current;
  if (!canvas || size.w < 10) return;
  const link = document.createElement('a');
  link.download = `civilflow_isometria_${(proyNombre || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}
