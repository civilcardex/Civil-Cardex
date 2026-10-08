// Generador Word (docx apaisado) de la memoria de cálculo. Extraído verbatim de exportMemoryFinal.
import { type MemoriaTable, type MemoriaData, fileBase } from './memoriaExportShared';
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
