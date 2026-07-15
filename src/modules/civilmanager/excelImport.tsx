import { useRef, useState } from 'react';
import { parseNum } from './calc';
import { showToast } from './shared/Toast';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_MAP: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 9, oct: 10, nov: 11, dic: 12 };

/** Formatea una fecha en múltiples formatos posibles (ISO, dd/mm/yyyy, serial Excel) a "dd-mes-yy". */
export function fmtDate(v: unknown): string {
  if (!v && v !== 0) return '—';
  const s = String(v).trim();
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(s + 'T00:00:00');
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) {
    const p = s.split('/');
    d = new Date(2000 + Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  } else if (/^\d{1,2}-[a-z]{3}-\d{2,4}$/i.test(s)) {
    d = new Date(s);
  } else if (!isNaN(Number(v)) && Number(v) > 1000000000000) {
    d = new Date(Number(v));
  } else if (!isNaN(Number(s)) && Number(s) > 40000 && Number(s) < 60000) {
    d = new Date((Number(s) - 25569) * 86400000);
  } else {
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = MONTHS[d.getMonth()];
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}-${mm}-${yy}`;
}

/** true si una fecha de cotización tiene más de 180 días de antigüedad. */
export function isCotOld(fechaCot: string | undefined): boolean {
  if (!fechaCot) return false;
  try {
    const s = String(fechaCot).trim();
    let d: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(Number(s.substr(0, 4)), Number(s.substr(5, 2)) - 1, Number(s.substr(8, 2)));
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const p = s.split('/');
      d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) {
      const p = s.split('/');
      d = new Date(2000 + Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    } else {
      const m = s.match(/^(\d{1,2})-([a-z]{3})-(\d{2,4})$/i);
      if (m) {
        let yr = Number(m[3]);
        if (yr < 100) yr += 2000;
        const mi = MONTHS_MAP[m[2].toLowerCase()];
        if (mi !== undefined) d = new Date(yr, mi, Number(m[1]));
      }
    }
    if (d === null || isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) > 180;
  } catch {
    return false;
  }
}

/** Parsea una cantidad numérica desambiguando formato colombiano (1.500,00) vs internacional (1,500.00). */
export function parseCantidad(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s || s === '-') return 0;
  const tienePunto = s.indexOf('.') >= 0;
  const tieneComa = s.indexOf(',') >= 0;
  if (tienePunto && tieneComa) {
    const ulPunto = s.lastIndexOf('.');
    const ulComa = s.lastIndexOf(',');
    if (ulComa > ulPunto) return parseNum(s.replace(/\./g, '').replace(',', '.'));
    return parseNum(s.replace(/,/g, ''));
  }
  if (tieneComa && !tienePunto) {
    const partes = s.split(',');
    if (partes[partes.length - 1].length <= 2) return parseNum(s.replace(',', '.'));
    return parseNum(s.replace(/,/g, ''));
  }
  return parseNum(s);
}

export interface ExcelPreview {
  type: 'export' | 'import';
  headers: string[];
  rows: (string | number)[][];
}

export interface UseExcelImportExportOptions<T extends { codigo?: string }> {
  items: T[];
  onImport: (items: T[]) => void;
  prefix: string;
  title: string;
  sheetName: string;
  filename: string;
  headers: string[];
  colWidths?: { wch: number }[];
  mapRow: (item: T) => (string | number)[];
  parseRow: (row: (string | number)[]) => (string | number)[];
  buildItem: (row: (string | number)[], existingIdx: number, existing: T[], nextCode: () => string) => T;
  matchKey?: keyof T;
}

/** Import/export genérico contra Excel (xlsx-js-style), reutilizado por todos los catálogos. */
export function useExcelImportExport<T extends { codigo?: string }>(opts: UseExcelImportExportOptions<T>) {
  const { items, onImport, prefix, title, sheetName, filename, headers, colWidths, mapRow, parseRow, buildItem, matchKey = 'codigo' as keyof T } = opts;
  const [previewModal, setPreviewModal] = useState<ExcelPreview | null>(null);
  const [importData, setImportData] = useState<(string | number)[][] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportExcel = () => {
    const rows = items.map(mapRow);
    setPreviewModal({ type: 'export', headers, rows });
  };

  const doExport = async () => {
    if (!previewModal || previewModal.type !== 'export') return;
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.utils.aoa_to_sheet([[title], previewModal.headers, ...previewModal.rows]);
    if (colWidths) ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    setPreviewModal(null);
    showToast('Excel exportado correctamente', { type: 'ok' });
  };

  const doImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      showToast('Solo se permiten archivos .xlsx o .xls', { type: 'err' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const XLSX = await import('xlsx-js-style');
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', blankrows: false });
        if (json.length < 2) {
          showToast('Archivo vacío o sin datos (requiere encabezado + 1 fila mínimo)', { type: 'err' });
          setPreviewModal(null);
          e.target.value = '';
          return;
        }
        let headerRow = -1;
        const threshold = Math.ceil(headers.length * 0.6);
        for (let i = 0; i < Math.min(json.length, 5); i++) {
          const row = json[i];
          let matches = 0;
          for (let h = 0; h < headers.length; h++) {
            if (String(row[h] ?? '').trim().toLowerCase() === headers[h].toLowerCase()) matches++;
          }
          if (matches >= threshold) { headerRow = i; break; }
        }
        if (headerRow < 0) {
          showToast('No se encontraron encabezados en el archivo', { type: 'err' });
          setPreviewModal(null);
          e.target.value = '';
          return;
        }
        const rows = json.slice(headerRow + 1).map(parseRow);
        const validRows = rows.filter(r => r?.[0] && String(r[0]).trim());
        if (validRows.length === 0) {
          showToast('No se encontraron filas con datos válidos', { type: 'err' });
          setPreviewModal(null);
          e.target.value = '';
          return;
        }
        if (validRows.length < rows.length) {
          showToast(`${rows.length - validRows.length} filas vacías omitidas`, { type: 'ok', dur: 2500 });
        }
        setImportData(validRows);
        setPreviewModal({ type: 'import', headers, rows: validRows });
      } catch (err) {
        showToast('Error leyendo archivo Excel: ' + (err instanceof Error ? err.message : String(err)), { type: 'err' });
        setPreviewModal(null);
      }
      e.target.value = '';
    };
    reader.onerror = () => { showToast('Error leyendo el archivo', { type: 'err' }); e.target.value = ''; };
    reader.readAsArrayBuffer(file);
  };

  const doImport = () => {
    if (!importData || !previewModal || previewModal.type !== 'import') return;
    const re = new RegExp(prefix + '-(\\d+)');
    let nextNum = items.reduce((m, item) => {
      const match = (item.codigo || '').match(re);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    const existing = [...items];
    let created = 0;
    let updated = 0;
    for (const r of importData) {
      const keyVal = String(r[0] ?? '').trim();
      if (!keyVal) continue;
      const idx = existing.findIndex(it => String(it[matchKey] ?? '').toLowerCase() === keyVal.toLowerCase());
      const built = buildItem(r, idx, existing, () => prefix + '-' + String(++nextNum).padStart(3, '0'));
      if (idx >= 0) { existing[idx] = { ...existing[idx], ...built }; updated++; }
      else { existing.push(built); created++; }
    }
    onImport(existing);
    setImportData(null);
    setPreviewModal(null);
    showToast(`${importData.length} registros importados (${created} nuevos, ${updated} actualizados)`, { type: 'ok', dur: 3500 });
  };

  const doImportCancel = () => { setImportData(null); setPreviewModal(null); };
  const triggerImport = () => fileRef.current?.click();
  const fileInputEl = <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={doImportSelect} aria-hidden="true" />;

  return { previewModal, fileInputEl, triggerImport, exportExcel, doExport, doImport, doImportCancel };
}
