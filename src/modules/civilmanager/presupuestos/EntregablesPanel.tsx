import { useCivilManager } from '../context';
import { calcItemValue, calcResumenPresupuesto, esCapituloFinal, fmt } from '../calc';
import { showToast } from '../shared/Toast';
import { ActionIcon } from '../shared/icons';
import type { ApuCalculado, CivilManagerConfig, Presupuesto, PresupuestoItem } from '../types';

interface Props {
  pres: Presupuesto;
}

function buildItemRows(items: PresupuestoItem[], apuCalcMap: Map<string, ApuCalculado>, aiu: Presupuesto['aiu_override'], config: CivilManagerConfig): (string | number)[][] {
  return items.map(it => {
    if (esCapituloFinal(it)) return [it.num_item, it.descripcion, '', '', '', ''];
    const calc = calcItemValue(it, apuCalcMap.get(it.apu_id), aiu, config);
    return [it.num_item, it.descripcion, it.unidad, it.cantidad, calc.vrUnitario, calc.valorTotal];
  });
}

export function EntregablesPanel({ pres }: Props) {
  const { state, apuCalcMap } = useCivilManager();

  async function exportExcelPresupuesto() {
    const XLSX = await import('xlsx-js-style');
    const rows = buildItemRows(pres.items, apuCalcMap, pres.aiu_override, state.config);
    const resumen = calcResumenPresupuesto(pres.items, apuCalcMap, pres.aiu_override, state.config);
    const ws = XLSX.utils.aoa_to_sheet([
      [pres.nombre],
      [`Código: ${pres.codigo}`, `Entidad: ${pres.entidad}`],
      [],
      ['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Vr. Unitario', 'Vr. Total'],
      ...rows,
      [],
      ['', '', '', '', 'COSTO DIRECTO', resumen.costoDirecto],
      ['', '', '', '', 'ADMINISTRACIÓN', resumen.administracion],
      ['', '', '', '', 'IMPREVISTOS', resumen.imprevistos],
      ['', '', '', '', 'UTILIDAD', resumen.utilidad],
      ['', '', '', '', 'IVA UTILIDAD', resumen.ivaUtilidad],
      ['', '', '', '', 'VALOR TOTAL', resumen.valorTotal],
    ]);
    ws['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
    XLSX.writeFile(wb, `presupuesto_${pres.codigo}.xlsx`);
    showToast('Excel exportado correctamente', { type: 'ok' });
  }

  async function exportExcelPrecios() {
    const XLSX = await import('xlsx-js-style');
    const rows = state.apus.map(a => {
      const c = apuCalcMap.get(a.id);
      return [a.codigo, a.nombre, a.unidad, c?.totalDirecto ?? 0];
    });
    const ws = XLSX.utils.aoa_to_sheet([['Listado de Precios Unitarios'], [], ['Código', 'Descripción', 'Unidad', 'Vr. Unitario'], ...rows]);
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios');
    XLSX.writeFile(wb, `precios_${pres.codigo}.xlsx`);
    showToast('Excel exportado correctamente', { type: 'ok' });
  }

  async function exportPdfFicha() {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });
    const resumen = calcResumenPresupuesto(pres.items, apuCalcMap, pres.aiu_override, state.config);
    doc.setFontSize(13);
    doc.text(pres.nombre, 14, 16);
    doc.setFontSize(9);
    function line(label: string, val: string, y: number) {
      doc.text(`${label}: ${val}`, 14, y);
    }
    line('Código', pres.codigo, 24);
    line('Entidad', pres.entidad || '—', 30);
    line('Contrato', pres.contrato || '—', 36);

    const rows = buildItemRows(pres.items, apuCalcMap, pres.aiu_override, state.config);
    autoTable(doc, {
      startY: 42,
      head: [['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Vr. Unitario', 'Vr. Total']],
      body: rows.map(r => r.map(c => (typeof c === 'number' ? fmt(c) : c))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26, 36, 56] },
      foot: [['', '', '', '', 'VALOR TOTAL', fmt(resumen.valorTotal)]],
    });
    doc.save(`ficha_${pres.codigo}.pdf`);
    showToast('PDF exportado correctamente', { type: 'ok' });
  }

  return (
    <div className="cm-xl-wrap" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" className="cm-btn cm-btn-warn" onClick={exportExcelPresupuesto}>
        <ActionIcon name="download" label="" /> Excel — Presupuesto detallado
      </button>
      <button type="button" className="cm-btn cm-btn-warn" onClick={exportExcelPrecios}>
        <ActionIcon name="download" label="" /> Excel — Listado de precios (APU)
      </button>
      <button type="button" className="cm-btn cm-btn-warn" onClick={exportPdfFicha}>
        <ActionIcon name="picture_as_pdf" label="" /> PDF — Ficha técnica
      </button>
    </div>
  );
}
