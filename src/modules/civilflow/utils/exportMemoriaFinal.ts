export interface MemoriaHeaderGroup {
  label: string;
  span: number;
}

export interface MemoriaTable {
  title: string;
  headers: string[];
  // Optional top header row grouping several leaf `headers` under a shared label (e.g.
  // "Pérdidas por fricción" spanning the "%" and "m" sub-columns). Plain strings in this array
  // stand for an ungrouped leaf column (rendered as a single cell spanning both header rows);
  // object entries span `span` consecutive leaf columns. Spans must sum to headers.length.
  headerGroups?: (string | MemoriaHeaderGroup)[];
  rows: (string | number)[][];
  // Which network sheet this table belongs on in the Excel export (see REDES_ORDEN below) — set
  // by the caller when assembling the tables array, not by the individual compute*Table functions.
  red?: string;
}

export interface MemoriaData {
  proyNombre: string;
  rows: [string, string][];
  tables?: MemoriaTable[];
}

function fileBase(proyNombre: string): string {
  return `Memorias Finales ${proyNombre || 'Proyecto'}`.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

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
// wrapText:true is what keeps long body text (comments, spec sentences) inside its own cell —
// without it, Excel doesn't truncate, it lets the text visually overflow into whatever neighboring
// cells happen to be empty (common when several differently-shaped tables share one sheet's
// columns), which reads as columns being misaligned/missing even though the underlying data is fine.
const xlsxBodyStyle = (): XlsxCellStyle => ({
  font: { sz: 10 },
  alignment: { vertical: 'center', wrapText: true },
  border: XLSX_CELL_BORDER,
});

const REDES_ORDEN: { key: string; label: string }[] = [
  { key: 'san', label: 'Sanitaria' },
  { key: 'll', label: 'Aguas Lluvias' },
  { key: 'af', label: 'Agua Fría' },
  { key: 'ac', label: 'Agua Caliente' },
  { key: 'gas', label: 'Gas' },
  { key: 'bom', label: 'Bomba aguas residuales' },
  { key: 'ep', label: 'Equipo presión' },
];

// Stacks every table for one red top-to-bottom on a single sheet: a merged title row, then its
// header row(s) (respecting headerGroups the same way the DOCX/PDF renderers do — a spanning
// group label merged across its leaf columns, a plain header vertically merged across both header
// rows), then its body rows, then a blank spacer row before the next table.
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

// Cap raised from 22 to 34 — with wrapText now on, this is how much a column grows before long
// content starts wrapping into extra lines instead of stretching the sheet arbitrarily wide.
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

// Word divides a table's declared width evenly-ish across its columns unless told otherwise — with
// 20+ columns crammed into one landscape page, that forces column widths well below what a header
// like "Otros Ramales" needs, so Word wraps it letter-by-letter to fit. Giving each column an
// explicit width (estimated from its header text) plus a fixed table layout — AND matching w:tcW on
// every cell — makes Word respect those widths instead of squeezing them.
// Headers now force one word per line (see headerCell below), so the column only needs to fit
// the LONGEST WORD, not the whole header string — this keeps columns compact and readable
// instead of sized for a string that no longer renders on a single line anyway.
function computeColumnWidthsDxa(headers: string[]): number[] {
  const twipsPerChar = 105;
  const minWidth = 650;
  const padding = 180;
  return headers.map((h) => {
    const longestWord = h
      .split(' ')
      .filter(Boolean)
      .reduce((max, w) => Math.max(max, w.length), 0);
    return Math.max(minWidth, longestWord * twipsPerChar + padding);
  });
}

// Word's hard cap on page dimensions is 22in (31680 twip). Beyond that it silently clamps, which
// would clip the widest tables — but at the moderate column widths above even the ~26-column SAN
// table sums to well under this, so one table = one custom-width page holds.
const DOCX_PAGE_MAX_TWIP = 31680;
const DOCX_PAGE_HEIGHT_TWIP = 12240; // 8.5in — the short side, landscape-style
const DOCX_SIDE_MARGIN_TWIP = 360;
// A narrow table (2-4 columns, e.g. the heater-selection tables) would otherwise get a page
// custom-sized down to its own tiny width — Word's multi-page browsing view then packs that tiny
// page side-by-side with the full-width pages around it, reading as a jumbled mess. Flooring every
// table page at standard US Letter landscape width keeps all table pages a uniform, normal size;
// only genuinely wide tables grow past it.
const DOCX_MIN_PAGE_WIDTH_TWIP = 15840; // 11in

export async function generateMemoriaDocx(data: MemoriaData): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    AlignmentType,
    PageOrientation,
    VerticalMergeType,
    TableLayoutType,
  } = await import('docx');

  const summaryRows = data.rows.map(
    ([k, v]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            children: [new Paragraph(String(v))],
          }),
        ],
      }),
  );

  const cellMargins = { top: 40, bottom: 40, left: 60, right: 60 };
  // `columnWidths` on the Table only fills in `w:tblGrid` (a hint) — Word only actually honors it
  // when every cell also carries its own matching `w:tcW`. Without that, Word falls back to
  // autofit-by-content despite `layout: FIXED`, which is what was still squeezing/wrapping headers.
  // Explicit font + a smaller size than the body text: Word's default table-style font (whatever
  // it resolves to without this) measured wider per character than the column-width estimate
  // assumed, so headers kept wrapping even at generous widths. Arial's metrics are well-known and
  // narrow enough, and dropping to 6pt gives real headroom on top of that instead of estimating
  // even more aggressively again.
  const HEADER_FONT_SIZE = 12;
  // One word per line instead of letting Word wrap wherever it fits (which breaks mid-word on
  // narrow columns) — an explicit line break before every word but the first guarantees each
  // line holds a whole word.
  const headerWordRuns = (text: string) => {
    const words = text.split(' ').filter(Boolean);
    if (words.length === 0)
      return [
        new TextRun({ text, bold: true, color: 'FFFFFF', size: HEADER_FONT_SIZE, font: 'Arial' }),
      ];
    return words.map(
      (w, i) =>
        new TextRun({
          text: w,
          bold: true,
          color: 'FFFFFF',
          size: HEADER_FONT_SIZE,
          font: 'Arial',
          break: i > 0 ? 1 : 0,
        }),
    );
  };
  const headerCell = (text: string, widthDxa: number, extra: Record<string, unknown> = {}) =>
    new TableCell({
      shading: { fill: '283C5A' },
      margins: cellMargins,
      width: { size: widthDxa, type: WidthType.DXA },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: headerWordRuns(text) }),
      ],
      ...extra,
    });

  // Each table becomes its OWN section with a page sized to fit exactly that table's total width —
  // this is what keeps every table on a single sheet regardless of column count, instead of clipping
  // a wide table against a fixed letter page (the multi-page-per-table regression).
  const tableSections = (data.tables || []).map((table) => {
    let columnWidths = computeColumnWidthsDxa(table.headers);
    const availableWidth = DOCX_PAGE_MAX_TWIP - DOCX_SIDE_MARGIN_TWIP * 2;
    const rawSum = columnWidths.reduce((a, b) => a + b, 0);
    // Never let a table's declared width exceed what actually fits on its own page — otherwise
    // Word clips whatever hangs past the page edge and the table reads as missing columns. Scale
    // every column down proportionally (relative widths — and therefore readability priority
    // between short/long headers — are preserved) so the whole table always lands on one sheet.
    if (rawSum > availableWidth) {
      const scale = availableWidth / rawSum;
      columnWidths = columnWidths.map((w) => Math.max(400, Math.round(w * scale)));
    }
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    const headerRows: InstanceType<typeof TableRow>[] = [];
    if (table.headerGroups) {
      const row1: InstanceType<typeof TableCell>[] = [];
      const row2: InstanceType<typeof TableCell>[] = [];
      let leafIdx = 0;
      for (const g of table.headerGroups) {
        if (typeof g === 'string') {
          row1.push(
            headerCell(g, columnWidths[leafIdx], { verticalMerge: VerticalMergeType.RESTART }),
          );
          row2.push(
            headerCell('', columnWidths[leafIdx], { verticalMerge: VerticalMergeType.CONTINUE }),
          );
          leafIdx += 1;
        } else {
          const groupWidth = columnWidths
            .slice(leafIdx, leafIdx + g.span)
            .reduce((a, b) => a + b, 0);
          row1.push(headerCell(g.label, groupWidth, { columnSpan: g.span }));
          for (let i = 0; i < g.span; i++)
            row2.push(headerCell(table.headers[leafIdx + i], columnWidths[leafIdx + i]));
          leafIdx += g.span;
        }
      }
      headerRows.push(new TableRow({ tableHeader: true, children: row1 }));
      headerRows.push(new TableRow({ tableHeader: true, children: row2 }));
    } else {
      headerRows.push(
        new TableRow({
          tableHeader: true,
          children: table.headers.map((h, i) => headerCell(h, columnWidths[i])),
        }),
      );
    }
    const bodyRows = table.rows.map(
      (r) =>
        new TableRow({
          children: r.map(
            (cell, i) =>
              new TableCell({
                margins: cellMargins,
                width: { size: columnWidths[i], type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: String(cell), size: HEADER_FONT_SIZE, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    );
    const pageWidth = Math.min(
      DOCX_PAGE_MAX_TWIP,
      Math.max(DOCX_MIN_PAGE_WIDTH_TWIP, tableWidth + DOCX_SIDE_MARGIN_TWIP * 2),
    );
    return {
      properties: {
        page: {
          // docx's createPageSize SWAPS width/height when orientation is LANDSCAPE (it expects
          // portrait-shaped input and rotates it) — so the final wide dimension must be passed as
          // `height` here for it to land as `w:w` in the actual XML. Passing the already-wide
          // pageWidth as `width` (as before) made the real rendered page only 8.5in wide, clipping
          // every table wider than that regardless of how carefully columnWidths was computed.
          size: {
            width: DOCX_PAGE_HEIGHT_TWIP,
            height: pageWidth,
            orientation: PageOrientation.LANDSCAPE,
          },
          margin: {
            top: 400,
            right: DOCX_SIDE_MARGIN_TWIP,
            bottom: 400,
            left: DOCX_SIDE_MARGIN_TWIP,
          },
        },
      },
      children: [
        new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths,
          layout: TableLayoutType.FIXED,
          rows: [...headerRows, ...bodyRows],
        }),
      ],
    };
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Memorias Finales',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: data.proyNombre || 'Proyecto',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: summaryRows }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generado: ${new Date().toLocaleDateString('es-CO')}`,
                italics: true,
                size: 18,
                color: '888888',
              }),
            ],
          }),
        ],
      },
      ...tableSections,
    ],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileBase(data.proyNombre)}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Turns a table's headerGroups (the same grouped-column model the Excel/Word exports share) into
// jspdf-autotable's two-header-row format: a spanning group cell uses colSpan across its leaf
// columns; a plain (ungrouped) header uses rowSpan to cover both header rows — and, per
// autotable's own convention for rowSpan, must NOT get a second cell in the row it spans into.
function buildAutoTableHead(table: MemoriaTable): Record<string, unknown>[][] {
  if (!table.headerGroups) return [table.headers.map((h) => ({ content: h }))];
  const row1: Record<string, unknown>[] = [];
  const row2: Record<string, unknown>[] = [];
  let leafIdx = 0;
  for (const g of table.headerGroups) {
    if (typeof g === 'string') {
      row1.push({ content: g, rowSpan: 2, styles: { valign: 'middle' } });
      leafIdx += 1;
    } else {
      row1.push({ content: g.label, colSpan: g.span });
      for (let i = 0; i < g.span; i++) row2.push({ content: table.headers[leafIdx + i] });
      leafIdx += g.span;
    }
  }
  return [row1, row2];
}

const PDF_NAVY: [number, number, number] = [40, 60, 90];

export async function generateMemoriaPdf(data: MemoriaData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(PDF_NAVY[0], PDF_NAVY[1], PDF_NAVY[2]);
  doc.text('Memorias Finales', pageW / 2, 50, { align: 'center' });
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(data.proyNombre || 'Proyecto', pageW / 2, 72, { align: 'center' });

  autoTable(doc, {
    startY: 95,
    head: [['Campo', 'Valor']],
    body: data.rows,
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: {
      fillColor: PDF_NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineWidth: 0.1,
    },
    theme: 'grid',
  });

  for (const { key, label } of REDES_ORDEN) {
    const tables = (data.tables || []).filter((t) => t.red === key);
    if (tables.length === 0) continue;

    doc.addPage('a4', 'landscape');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PDF_NAVY[0], PDF_NAVY[1], PDF_NAVY[2]);
    doc.text(label, 30, 40);
    let cursorY = 55;

    for (const table of tables) {
      const pageH = doc.internal.pageSize.getHeight();
      // Leave room for a title line + at least a header + one body row, otherwise start this
      // table fresh on a new page instead of squeezing/orphaning it against the bottom edge.
      if (cursorY > pageH - 100) {
        doc.addPage('a4', 'landscape');
        cursorY = 40;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(table.title, 30, cursorY);
      cursorY += 8;

      autoTable(doc, {
        startY: cursorY,
        margin: { left: 30, right: 30 },
        head: buildAutoTableHead(table),
        body: table.rows,
        // minCellWidth guarantees every column (including narrow ones like "%"/"m" under a much
        // longer spanning group header like "Pérdidas por fricción") has enough room for at least
        // one full word per line — without it, autotable sizes columns purely off body-cell
        // content, and squeezed the long group header into a couple of points, wrapping mid-word.
        styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', minCellWidth: 22 },
        headStyles: {
          fillColor: PDF_NAVY,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
        },
        bodyStyles: { valign: 'middle' },
        theme: 'grid',
        didDrawPage: () => {
          cursorY = 40;
        },
      });

      // autoTable advances doc.lastAutoTable internally; read the actual end position for the
      // next table's start, falling back if a page break occurred mid-table (didDrawPage reset).
      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY;
      cursorY = (finalY ?? cursorY) + 22;
    }
  }

  doc.save(`${fileBase(data.proyNombre)}.pdf`);
}
