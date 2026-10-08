// Generador PDF (jspdf + autotable) de la memoria de cálculo. Extraído verbatim de exportMemoryFinal.
import { type MemoriaTable, type MemoriaData, fileBase, REDES_ORDEN } from './memoriaExportShared';
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
