import { cargoJornal, fmt, parseNum } from '../calc';
import { showToast } from '../shared/Toast';
import type { Apu, ApuCalculado, CargoCalculado, Equipo, Insumo } from '../types';

interface ExportCtx {
  cargosCalc: CargoCalculado[];
  equipos: Equipo[];
  insumos: Insumo[];
  usarFP: boolean;
  esHora: boolean;
  apuCalcMap: Map<string, ApuCalculado>;
  abMap: Map<string, ApuCalculado>;
}

function buildRows(apu: Apu, ctx: ExportCtx): (string | number)[][] {
  const cargoMap = new Map(ctx.cargosCalc.map(c => [c.id, c]));
  const eqMap = new Map(ctx.equipos.map(e => [e.id, e]));
  const insMap = new Map(ctx.insumos.map(x => [x.id, x]));
  const rows: (string | number)[][] = [];
  rows.push(['A. MANO DE OBRA', '', '', '', '']);
  rows.push(['Cargo', 'Cant. Personas', 'Rendimiento', 'Jornal', 'Subtotal']);
  for (const r of apu.recursos_mo) {
    const cargo = cargoMap.get(r.cargo_id);
    const jornal = cargoJornal(cargo, ctx.usarFP, ctx.esHora);
    rows.push([cargo?.descripcion ?? '', r.cant_personas, r.rendimiento, jornal, jornal * r.cant_personas * r.rendimiento]);
  }
  rows.push(['B. EQUIPO', '', '', '', '']);
  rows.push(['Equipo', 'Rendimiento', '', 'Costo/Hora', 'Subtotal']);
  for (const r of apu.recursos_eq) {
    const eq = eqMap.get(r.equipo_id);
    rows.push([eq?.nombre ?? '', r.rendimiento, '', eq?.costo_hora ?? 0, (eq?.costo_hora ?? 0) * r.rendimiento]);
  }
  rows.push(['C. INSUMOS', '', '', '', '']);
  rows.push(['Insumo', 'Consumo', 'Desperdicio %', 'Costo Unit.', 'Subtotal']);
  for (const r of apu.recursos_ins) {
    const ins = insMap.get(r.insumo_id);
    const costoU = ins?.origen === 'Preparado en obra' ? ctx.abMap.get(ins.apu_basico_id)?.costo_unitario ?? 0 : ins?.costo_unitario ?? 0;
    const desp = (parseNum(r.desperdicios_pct) || 5) / 100;
    rows.push([ins?.nombre ?? '', r.consumo, r.desperdicios_pct, costoU, costoU * r.consumo * (1 + desp)]);
  }
  rows.push(['D. TRANSPORTE', '', '', '', '']);
  rows.push(['Unidad', 'Tarifa', 'Distancia km', '', 'Subtotal']);
  for (const r of apu.recursos_transporte) {
    const total = r.unidad === 'Global' ? r.tarifa : r.tarifa * r.distancia_km;
    rows.push([r.unidad, r.tarifa, r.distancia_km, '', total]);
  }
  const calc = ctx.apuCalcMap.get(apu.id);
  rows.push(['', '', '', '', '']);
  rows.push(['COSTO UNITARIO TOTAL', '', '', '', calc?.totalDirecto ?? 0]);
  return rows;
}

export async function exportApuExcel(apu: Apu, ctx: ExportCtx): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const rows = buildRows(apu, ctx);
  const ws = XLSX.utils.aoa_to_sheet([[`APU ${apu.codigo} — ${apu.nombre}`], [`Unidad: ${apu.unidad}`], [], ...rows]);
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'APU');
  XLSX.writeFile(wb, `apu_${apu.codigo}.xlsx`);
  showToast('Excel exportado correctamente', { type: 'ok' });
}

export async function exportApuPdf(apu: Apu, ctx: ExportCtx): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', format: 'letter' });
  doc.setFontSize(12);
  doc.text(`APU ${apu.codigo} — ${apu.nombre}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`Unidad: ${apu.unidad}`, 14, 22);
  const rows = buildRows(apu, ctx);
  autoTable(doc, {
    startY: 28,
    head: [['Recurso', 'Cant./Rend.', 'Desp./Dist.', 'Costo Unit.', 'Subtotal']],
    body: rows.map(r => r.map(c => (typeof c === 'number' ? fmt(c) : c))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 36, 56] },
  });
  doc.save(`apu_${apu.codigo}.pdf`);
  showToast('PDF exportado correctamente', { type: 'ok' });
}
