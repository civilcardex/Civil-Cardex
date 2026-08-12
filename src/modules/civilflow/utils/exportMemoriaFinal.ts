export interface MemoriaHeaderGroup {
  label: string;
  span: number;
}

export interface MemoriaTable {
  title: string;
  headers: string[];
  // Fila de cabecera superior opcional que agrupa varios `headers` hoja bajo una etiqueta
  // compartida (p. ej. "Pérdidas por fricción" abarcando las sub-columnas "%" y "m"). Los
  // strings planos de este array representan una columna hoja sin agrupar (renderizada como una
  // celda sola que cruza ambas filas de cabecera); las entradas objeto abarcan `span` columnas
  // hoja consecutivas. Los spans deben sumar headers.length.
  headerGroups?: (string | MemoriaHeaderGroup)[];
  rows: (string | number)[][];
  // En qué hoja de red va esta tabla en la exportación Excel (ver REDES_ORDEN abajo) — lo fija
  // el caller al armar el array de tablas, no las funciones compute*Table individuales.
  red?: string;
  // Renderiza esta tabla lado a lado con la SIGUIENTE del array en la misma fila (usado para el
  // par angosto acometida parámetros/verificación en las exportaciones PDF y DOCX; el par
  // comparte una sección de página en DOCX y una fila en PDF). Ignorado por la exportación Excel.
  side?: boolean;
  // Diámetros (en pulgadas, como string) presentes en el dibujo para la red de esta tabla —
  // usado por la UI para derivar filas pseudo de bushing (un par mayor→menor por combinación de
  // diámetros). Solo lo llenan las redes de presión (af/ac/gas).
  diamsPresent?: string[];
  // Conteo REAL de bushing por par de diámetros (clave `${mayor}_${menor}`, pulgadas) — cuántas
  // conexiones menor→mayor hay de verdad en el dibujo (Bug 2). Solo af/ac/gas.
  bushingCounts?: Record<string, number>;
}

// Quita columnas que son todo-cero en todas las filas — usado para tablas de conteo de
// accesorios donde la mayoría de tipos de accesorio no aplican a un proyecto dado e imprimir
// una columna toda-cero es solo ruido. `labelCols`/`trailingCols` protegen las columnas de
// etiqueta iniciales y las columnas de totales calculados finales de quitarse aunque sean todo
// cero. Salta tablas con headerGroups (la matemática de spans habría que ajustarla también, y
// ninguna tabla de accesorios actual las usa).
export function dropAllZeroColumns(
  table: MemoriaTable,
  labelCols = 1,
  trailingCols = 0,
): MemoriaTable {
  if (table.headerGroups) return table;
  const lastProtected = table.headers.length - trailingCols;
  const keepIdx: number[] = [];
  for (let i = 0; i < table.headers.length; i++) {
    if (i < labelCols || i >= lastProtected || table.rows.some((r) => Number(r[i]) !== 0)) {
      keepIdx.push(i);
    }
  }
  if (keepIdx.length === table.headers.length) return table;
  return {
    ...table,
    headers: keepIdx.map((i) => table.headers[i]),
    rows: table.rows.map((r) => keepIdx.map((i) => r[i])),
  };
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

const REDES_ORDEN: { key: string; label: string }[] = [
  { key: 'san', label: 'Sanitaria' },
  { key: 'll', label: 'Aguas Lluvias' },
  { key: 'af', label: 'Agua Fría' },
  { key: 'aco', label: 'Acometida' },
  { key: 'ac', label: 'Agua Caliente' },
  { key: 'gas', label: 'Gas' },
  { key: 'bom', label: 'Bomba aguas residuales' },
  { key: 'ep', label: 'Equipo presión' },
];

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
// texto de cabecera) más un layout de tabla fijo — Y hacer coincidir w:tcW en cada celda — hace
// que Word respete esos anchos en vez de apretarlos.
// Las cabeceras ahora fuerzan una palabra por línea (ver headerCell abajo), así que la columna
// solo necesita caber la PALABRA MÁS LARGA, no el string de cabecera completo — esto mantiene
// las columnas compactas y legibles en vez de dimensionadas para un string que de todos modos ya
// no se renderiza en una sola línea.
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

// El tope duro de Word para dimensiones de página es 22in (31680 twip). Más allá lo recorta en
// silencio, lo que cortaría las tablas más anchas — pero con los anchos de columna moderados de
// arriba incluso la tabla SAN de ~26 columnas suma muy por debajo de esto, así que una tabla =
// una página de ancho personalizado se sostiene.
const DOCX_PAGE_MAX_TWIP = 31680;
const DOCX_PAGE_HEIGHT_TWIP = 12240; // 8.5in — el lado corto, estilo apaisado
const DOCX_SIDE_MARGIN_TWIP = 360;
// Una tabla angosta (2-4 columnas, p. ej. las tablas de selección de calentador) de otro modo
// tendría una página personalizada reducida a su propio ancho diminuto — la vista de navegación
// multi-página de Word entonces acomoda esa página chiquita lado a lado con las páginas de ancho
// completo que la rodean, leyéndose como un revoltijo. Piso de cada página de tabla en el ancho
// estándar de US Letter apaisado mantiene todas las páginas de tabla de un tamaño uniforme y
// normal; solo las tablas genuinamente anchas crecen más allá.
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
  // `columnWidths` en la Table solo llena `w:tblGrid` (una pista) — Word solo lo honra de verdad
  // cuando cada celda también lleva su propio `w:tcW` coincidente. Sin eso, Word cae a
  // autofit-por-contenido a pesar de `layout: FIXED`, que era lo que seguía apretando/envolviendo
  // cabeceras.
  // Fuente explícita + tamaño menor que el texto del cuerpo: la fuente de estilo de tabla default
  // de Word (la que sea que resuelva sin esto) medía más ancha por carácter de lo que asumía la
  // estimación de ancho de columna, así que las cabeceras seguían envolviéndose aun a anchos
  // generosos. Las métricas de Arial son conocidas y lo bastante angostas, y bajar a 6pt da
  // espacio real encima de eso en vez de volver a estimar aún más agresivamente.
  const HEADER_FONT_SIZE = 12;
  // Una palabra por línea en vez de dejar que Word envuelva donde le quede (que rompe a mitad de
  // palabra en columnas angostas) — un salto de línea explícito antes de cada palabra salvo la
  // primera garantiza que cada línea contenga una palabra completa.
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

  // Cada tabla se vuelve su PROPIA sección con una página dimensionada para caber exactamente el
  // ancho total de esa tabla — esto es lo que mantiene cada tabla en una sola hoja sin importar
  // el conteo de columnas, en vez de recortar una tabla ancha contra una página carta fija (la
  // regresión de múltiples páginas por tabla).
  const buildTableParts = (table: MemoriaTable) => {
    let columnWidths = computeColumnWidthsDxa(table.headers);
    const availableWidth = DOCX_PAGE_MAX_TWIP - DOCX_SIDE_MARGIN_TWIP * 2;
    const rawSum = columnWidths.reduce((a, b) => a + b, 0);
    // Nunca dejar que el ancho declarado de una tabla exceda lo que realmente cabe en su propia
    // página — si no, Word recorta lo que cuelga pasando el borde de página y la tabla se lee con
    // columnas faltantes. Escalar cada columna proporcionalmente (los anchos relativos — y por
    // tanto la prioridad de legibilidad entre cabeceras cortas/largas — se conservan) para que la
    // tabla completa siempre caiga en una sola hoja.
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
    return { columnWidths, tableWidth, headerRows, bodyRows };
  };
  const makeSection = (
    tableWidth: number,
    children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[],
  ) => ({
    properties: {
      page: {
        // createPageSize de docx INTERCAMBIA ancho/alto cuando la orientación es LANDSCAPE
        // (espera entrada en forma de retrato y la rota) — así que la dimensión ancha final debe
        // pasarse como `height` aquí para que caiga como `w:w` en el XML real. Pasar el pageWidth
        // ya-ancho como `width` (como antes) hacía que la página renderizada real tuviera solo
        // 8.5in de ancho, recortando cada tabla más ancha que eso sin importar cuán
        // cuidadosamente se calcularan los columnWidths.
        size: {
          width: DOCX_PAGE_HEIGHT_TWIP,
          height: Math.min(
            DOCX_PAGE_MAX_TWIP,
            Math.max(DOCX_MIN_PAGE_WIDTH_TWIP, tableWidth + DOCX_SIDE_MARGIN_TWIP * 2),
          ),
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
    children,
  });

  const tableSections = [];
  const allTables = data.tables || [];
  for (let i = 0; i < allTables.length; i++) {
    const table = allTables[i];
    const nextTable = table.side ? allTables[i + 1] : undefined;
    if (nextTable) {
      // Par lado a lado (acometida parámetros + verificación): una sección, una tabla
      // contenedora 1×2 cuyas celdas llevan cada una una tabla anidada — ambas columnas
      // comparten la misma página.
      const left = buildTableParts(table);
      const right = buildTableParts(nextTable);
      const outerWidth = left.tableWidth + right.tableWidth;
      const nestedTable = (parts: ReturnType<typeof buildTableParts>) =>
        new Table({
          width: { size: parts.tableWidth, type: WidthType.DXA },
          columnWidths: parts.columnWidths,
          layout: TableLayoutType.FIXED,
          rows: [...parts.headerRows, ...parts.bodyRows],
        });
      tableSections.push(
        makeSection(outerWidth, [
          new Table({
            width: { size: outerWidth, type: WidthType.DXA },
            columnWidths: [left.tableWidth, right.tableWidth],
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 0, bottom: 0, left: 0, right: 20 },
                    width: { size: left.tableWidth, type: WidthType.DXA },
                    children: [
                      new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }),
                      nestedTable(left),
                    ],
                  }),
                  new TableCell({
                    margins: { top: 0, bottom: 0, left: 20, right: 0 },
                    width: { size: right.tableWidth, type: WidthType.DXA },
                    children: [
                      new Paragraph({ text: nextTable.title, heading: HeadingLevel.HEADING_2 }),
                      nestedTable(right),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]),
      );
      i += 1;
      continue;
    }
    const parts = buildTableParts(table);
    tableSections.push(
      makeSection(parts.tableWidth, [
        new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: parts.tableWidth, type: WidthType.DXA },
          columnWidths: parts.columnWidths,
          layout: TableLayoutType.FIXED,
          rows: [...parts.headerRows, ...parts.bodyRows],
        }),
      ]),
    );
  }

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

// Convierte los headerGroups de una tabla (el mismo modelo de columnas agrupadas que comparten
// las exportaciones Excel/Word) al formato de dos filas de cabecera de jspdf-autotable: una
// celda de grupo abarcada usa colSpan sobre sus columnas hoja; una cabecera plana (sin agrupar)
// usa rowSpan para cubrir ambas filas de cabecera — y, según la convención propia de autotable
// para rowSpan, NO debe llevar una segunda celda en la fila hacia la que abarca.
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

  let prevKey: string | null = null;
  let cursorY = 55;
  for (let i = 0; i < (data.tables || []).length; i++) {
    const table = (data.tables || [])[i];
    const key = table.red || '';
    if (key !== prevKey) {
      // Cada red empieza en su propia página nueva — la hoja de resumen queda sola en la página 1.
      doc.addPage('a4', 'landscape');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(PDF_NAVY[0], PDF_NAVY[1], PDF_NAVY[2]);
      const redLabel = REDES_ORDEN.find((r) => r.key === key)?.label || key;
      doc.text(redLabel, 30, 40);
      cursorY = 55;
      prevKey = key;
    }

    const nextTable = table.side ? (data.tables || [])[i + 1] : undefined;
    if (nextTable) {
      // Par lado a lado (acometida parámetros + verificación): ambas tablas en la misma fila,
      // cada una en su propia mitad de la página.
      const pageH = doc.internal.pageSize.getHeight();
      if (cursorY > pageH - 100) {
        doc.addPage('a4', 'landscape');
        cursorY = 40;
      }
      const mid = pageW / 2;
      const leftMargin = { left: 30, right: pageW - mid + 7.5 };
      const rightMargin = { left: mid + 7.5, right: 30 };
      const pairStyle = {
        fontSize: 7.5,
        cellPadding: 3,
        overflow: 'linebreak' as const,
        minCellWidth: 22,
      };
      const pairHeadStyle = {
        fillColor: PDF_NAVY,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        valign: 'middle' as const,
        lineWidth: 0.1,
      };
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(table.title, 30, cursorY);
      doc.text(nextTable.title, mid + 7.5, cursorY);
      cursorY += 8;
      autoTable(doc, {
        startY: cursorY,
        margin: leftMargin,
        head: buildAutoTableHead(table),
        body: table.rows,
        styles: pairStyle,
        headStyles: pairHeadStyle,
        bodyStyles: { valign: 'middle', halign: 'center' },
        theme: 'grid',
      });
      const leftFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY;
      autoTable(doc, {
        startY: cursorY,
        margin: rightMargin,
        head: buildAutoTableHead(nextTable),
        body: nextTable.rows,
        styles: pairStyle,
        headStyles: pairHeadStyle,
        bodyStyles: { valign: 'middle', halign: 'center' },
        theme: 'grid',
      });
      const rightFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY;
      cursorY = Math.max(leftFinalY ?? cursorY, rightFinalY ?? cursorY) + 22;
      i += 1;
      continue;
    }

    const pageH = doc.internal.pageSize.getHeight();
    // Dejar espacio para una línea de título + al menos una cabecera + una fila de cuerpo, si no
    // empezar esta tabla fresca en una página nueva en vez de apretarla/huerfanizarla contra el
    // borde inferior.
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
      // minCellWidth garantiza que cada columna (incluidas las angostas como "%"/"m" bajo un
      // encabezado de grupo abarcado mucho más largo como "Pérdidas por fricción") tenga espacio
      // suficiente para al menos una palabra completa por línea — sin él, autotable dimensiona
      // las columnas puramente según el contenido de las celdas del cuerpo, y apretaba el
      // encabezado de grupo largo a un par de puntos, envolviéndolo a mitad de palabra.
      styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', minCellWidth: 22 },
      headStyles: {
        fillColor: PDF_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1,
      },
      // Todas las columnas se renderizan centradas (solicitado para el PDF de memorias).
      bodyStyles: { valign: 'middle', halign: 'center' },
      theme: 'grid',
      didDrawPage: () => {
        cursorY = 40;
      },
    });

    // autoTable avanza doc.lastAutoTable internamente; leer la posición final real para el
    // inicio de la siguiente tabla, con respaldo si ocurrió un salto de página a mitad de tabla
    // (didDrawPage reinició).
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY) + 22;
  }

  const pageCount = (
    doc.internal as unknown as { getNumberOfPages: () => number }
  ).getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`CivilFlow ${new Date().getFullYear()}`, pageW / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.proyNombre || 'Proyecto', 30, pageH - 15);
    doc.text(`${i} / ${pageCount}`, pageW - 30, pageH - 15, { align: 'right' });
  }

  doc.save(`${fileBase(data.proyNombre)}.pdf`);
}
