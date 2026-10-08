// Generador Excel (xlsx) de la memoria de cálculo. Extraído verbatim de exportMemoryFinal.
import { type MemoriaTable, type MemoriaData, fileBase, REDES_ORDEN } from './memoriaExportShared';
interface XlsxCellStyle {
  font?: { bold?: boolean; sz?: number; color?: { rgb: string }; italic?: boolean };
  fill?: { fgColor: { rgb: string } };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean;
  };
  border?: Record<'top' | 'bottom' | 'left' | 'right', { style: string; color: { rgb: string } }>;
}

const XLSX_THIN_BORDER = { style: 'thin', color: { rgb: 'D9D9D9' } };
const XLSX_CELL_BORDER = {
  top: XLSX_THIN_BORDER,
  bottom: XLSX_THIN_BORDER,
  left: XLSX_THIN_BORDER,
  right: XLSX_THIN_BORDER,
};
const xlsxTitleStyle = (): XlsxCellStyle => ({
  font: { bold: true, sz: 13, color: { rgb: '283C5A' } },
  alignment: { horizontal: 'left', vertical: 'center' },
});
const xlsxHeaderStyle = (): XlsxCellStyle => ({
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '283C5A' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: XLSX_CELL_BORDER,
});
// wrapText:true es lo que mantiene el texto largo del cuerpo (comentarios, frases de
// especificación) dentro de su propia celda — sin él, Excel no trunca, deja que el texto se
// desborde visualmente a las celdas vecinas que estén vacías (común cuando varias tablas de
// formas distintas comparten las columnas de una hoja), lo que se lee como columnas
// desalineadas/faltantes aunque los datos subyacentes estén bien.
const xlsxBodyStyle = (): XlsxCellStyle => ({
  font: { sz: 10 },
  alignment: { vertical: 'center', wrapText: true },
  border: XLSX_CELL_BORDER,
});

// Apila todas las tablas de una red de arriba a abajo en una sola hoja: una fila de título
// combinada, luego su(s) fila(s) de cabecera (respetando headerGroups igual que los renderers
// DOCX/PDF — una etiqueta de grupo que abarca combinada sobre sus columnas hoja, una cabecera
// plana combinada verticalmente sobre ambas filas de cabecera), luego sus filas de cuerpo, y
// después una fila separadora en blanco antes de la siguiente tabla.
function buildRedSheet(
  tables: MemoriaTable[],
  encodeCell: (c: { r: number; c: number }) => string,
) {
  const aoa: (string | number)[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const styleCells: { ref: string; style: XlsxCellStyle }[] = [];
  let maxCols = 1;

  for (const table of tables) {
    const nCols = table.headers.length;
    maxCols = Math.max(maxCols, nCols);

    const titleRow = aoa.length;
    aoa.push([table.title, ...Array(Math.max(0, nCols - 1)).fill('')]);
    if (nCols > 1) merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: nCols - 1 } });
    styleCells.push({ ref: encodeCell({ r: titleRow, c: 0 }), style: xlsxTitleStyle() });

    if (table.headerGroups) {
      const row1Idx = aoa.length;
      const row2Idx = row1Idx + 1;
      const row1: (string | number)[] = new Array(nCols).fill('');
      const row2: (string | number)[] = new Array(nCols).fill('');
      let leafIdx = 0;
      for (const g of table.headerGroups) {
        if (typeof g === 'string') {
          row1[leafIdx] = g;
          merges.push({ s: { r: row1Idx, c: leafIdx }, e: { r: row2Idx, c: leafIdx } });
          leafIdx += 1;
        } else {
          row1[leafIdx] = g.label;
          if (g.span > 1)
            merges.push({
              s: { r: row1Idx, c: leafIdx },
              e: { r: row1Idx, c: leafIdx + g.span - 1 },
            });
          for (let i = 0; i < g.span; i++) row2[leafIdx + i] = table.headers[leafIdx + i];
          leafIdx += g.span;
        }
      }
      aoa.push(row1);
      aoa.push(row2);
      for (let c = 0; c < nCols; c++) {
        styleCells.push({ ref: encodeCell({ r: row1Idx, c }), style: xlsxHeaderStyle() });
        styleCells.push({ ref: encodeCell({ r: row2Idx, c }), style: xlsxHeaderStyle() });
      }
    } else {
      const headerRowIdx = aoa.length;
      aoa.push([...table.headers]);
      for (let c = 0; c < nCols; c++)
        styleCells.push({ ref: encodeCell({ r: headerRowIdx, c }), style: xlsxHeaderStyle() });
    }

    for (const row of table.rows) {
      const bodyRowIdx = aoa.length;
      aoa.push(row);
      for (let c = 0; c < row.length; c++)
        styleCells.push({ ref: encodeCell({ r: bodyRowIdx, c }), style: xlsxBodyStyle() });
    }

    aoa.push([]);
  }

  return { aoa, merges, styleCells, maxCols };
}

// Tope subido de 22 a 34 — con wrapText ahora activo, esto es cuánto crece una columna antes de
// que el contenido largo empiece a envolverse en líneas extra en vez de estirar la hoja
// arbitrariamente ancha.
const XLSX_COL_MAX_WIDTH = 34;

function computeXlsxColWidths(tables: MemoriaTable[], maxCols: number): number[] {
  const widths = new Array(maxCols).fill(9);
  for (const table of tables) {
    table.headers.forEach((h, i) => {
      widths[i] = Math.max(widths[i], Math.min(XLSX_COL_MAX_WIDTH, h.length + 2));
    });
    table.rows.forEach((row) =>
      row.forEach((cell, i) => {
        if (i < maxCols)
          widths[i] = Math.max(widths[i], Math.min(XLSX_COL_MAX_WIDTH, String(cell).length + 2));
      }),
    );
  }
  return widths;
}

export async function generateMemoriaExcel(data: MemoriaData): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();

  const resumenAoa: (string | number)[][] = [
    ['Memorias Finales', ''],
    [data.proyNombre || 'Proyecto', ''],
    ['', ''],
    ['Campo', 'Valor'],
    ...data.rows,
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa);
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 30 }];
  wsResumen['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  const subRef = XLSX.utils.encode_cell({ r: 1, c: 0 });
  if (wsResumen[titleRef])
    wsResumen[titleRef].s = { font: { bold: true, sz: 16, color: { rgb: '283C5A' } } };
  if (wsResumen[subRef]) wsResumen[subRef].s = { font: { sz: 12, color: { rgb: '555555' } } };
  for (let c = 0; c < 2; c++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c });
    if (wsResumen[ref]) wsResumen[ref].s = xlsxHeaderStyle();
  }
  for (let r = 4; r < resumenAoa.length; r++) {
    for (let c = 0; c < 2; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (wsResumen[ref]) wsResumen[ref].s = xlsxBodyStyle();
    }
  }
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  for (const { key, label } of REDES_ORDEN) {
    const tables = (data.tables || []).filter((t) => t.red === key);
    if (tables.length === 0) continue;
    const { aoa, merges, styleCells, maxCols } = buildRedSheet(tables, XLSX.utils.encode_cell);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = computeXlsxColWidths(tables, maxCols).map((w) => ({ wch: w }));
    for (const { ref, style } of styleCells) {
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = style;
    }
    XLSX.utils.book_append_sheet(wb, ws, label);
  }

  XLSX.writeFile(wb, `${fileBase(data.proyNombre)}.xlsx`);
}

// Word divide el ancho declarado de una tabla más o menos parejo entre sus columnas salvo que se
// le diga otra cosa — con 20+ columnas apretadas en una página apaisada, eso fuerza anchos de
// columna muy por debajo de lo que una cabecera como "Otros Ramales" necesita, así que Word la
// envuelve letra por letra para que quepa. Dar a cada columna un ancho explícito (estimado de su
