import { useCallback } from 'react';
import { askConfirm } from './ConfirmDialog';
import { showToast } from './Toast';

/**
 * Borrado con validación de referencias, reutilizado por Colaboradores/Cuadrillas/Equipos/Proveedores.
 * En el prototipo esta lógica (contar referencias, bloquear con mensaje, o confirmar y borrar) estaba
 * duplicada 4-5 veces casi idéntica.
 */
export function useReferentialDelete(countUsage: (id: string) => number, label: string) {
  return useCallback(
    async (id: string, onConfirmedDelete: () => void, confirmMsg = '¿Eliminar este registro?'): Promise<boolean> => {
      const count = countUsage(id);
      if (count > 0) {
        showToast(`No se puede eliminar: usado en ${count} ${label}${count === 1 ? '' : 's'}`, { type: 'err' });
        return false;
      }
      if (!(await askConfirm(confirmMsg))) return false;
      onConfirmedDelete();
      return true;
    },
    [countUsage, label]
  );
}
