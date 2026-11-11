import { ActionIcon } from './icons.tsx';
import type { ExcelPreview } from '../excelImport.tsx';
import { ModalOverlay } from '../../../components/shared/ModalShell.tsx';

interface ExcelHandle {
  previewModal: ExcelPreview | null;
  doImportCancel: () => void;
  doExport: () => void;
  doImport: () => void;
}

/** Modal de vista previa del import/export Excel: muestra headers + filas a procesar y confirma (Descargar / Aceptar e Importar) o cancela. Cierre por click-fuera. */
export function ExcelPreviewModal({ excel }: { excel: ExcelHandle }) {
  if (!excel.previewModal) return null;
  const pm = excel.previewModal;
  const isExport = pm.type === 'export';

  return (
    // Migrado a ModalOverlay (dialog nativo): el cierre por click-fuera y Escape con foco
    // atrapado ya no se programan a mano (el gap de accesibilidad del overlay viejo muere aquí).
    <ModalOverlay
      onClose={excel.doImportCancel}
      ariaLabel={isExport ? 'Previsualizar exportación' : 'Previsualizar importación'}
    >
      <div className="cm-modal-box cm-modal-wide">
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
                <th scope="col" className="cm-col-rn">
                  #
                </th>
                {pm.headers.map((h, i) => (
                  <th scope="col" key={i}>
                    {h}
                  </th>
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
    </ModalOverlay>
  );
}
