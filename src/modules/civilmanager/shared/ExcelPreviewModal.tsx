import { ActionIcon } from './icons';
import type { ExcelPreview } from '../excelImport';

interface ExcelHandle {
  previewModal: ExcelPreview | null;
  doImportCancel: () => void;
  doExport: () => void;
  doImport: () => void;
}

export function ExcelPreviewModal({ excel }: { excel: ExcelHandle }) {
  if (!excel.previewModal) return null;
  const pm = excel.previewModal;
  const isExport = pm.type === 'export';

  return (
    // Backdrop con cierre por click-fuera. Gap conocido: sin cierre por Escape ni focus trap —
    // agregar en un pase futuro (ver plan de accesibilidad, sección 1.4).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div className="cm-modal-overlay" role="presentation" onClick={excel.doImportCancel}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="cm-modal-box cm-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={isExport ? 'Previsualizar exportación' : 'Previsualizar importación'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cm-modal-head cm-modal-head-row">
          <span>{isExport ? 'Previsualizar Exportación' : 'Previsualizar Importación'}</span>
          <button
            type="button"
            className="cm-btn-icon"
            onClick={excel.doImportCancel}
            aria-label="Cerrar"
          >
            <ActionIcon name="close" label="Cerrar" color="var(--err)" />
          </button>
        </div>
        <div className="cm-modal-body cm-modal-scroll">
          <table className="cm-tbl">
            <thead>
              <tr>
                <th className="cm-col-rn">#</th>
                {pm.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pm.rows.length === 0 && (
                <tr>
                  <td colSpan={pm.headers.length + 1} className="cm-empty-row">
                    Sin datos
                  </td>
                </tr>
              )}
              {pm.rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="cm-col-rn">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cm-modal-actions">
          <button
            type="button"
            className={`cm-btn ${isExport ? 'cm-btn-warn' : 'cm-btn-ok'}`}
            onClick={isExport ? excel.doExport : excel.doImport}
          >
            {isExport ? 'Descargar Excel' : 'Aceptar e Importar'}
          </button>
          <button type="button" className="cm-btn" onClick={excel.doImportCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
