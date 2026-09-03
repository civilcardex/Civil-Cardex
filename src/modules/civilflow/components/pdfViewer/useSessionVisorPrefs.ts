// Preferencias del visor (herramienta activa, tipo de tramo, snap, cuadrícula) persistidas en
// sessionStorage — sobreviven a navegaciones dentro de la sesión pero se reinician al recargar.
import { useState, useEffect } from 'react';
import {
  VISOR_TOOL_KEY,
  VISOR_TIPO_TRAMO_KEY,
  VISOR_SNAP_ON_KEY,
  VISOR_GRID_ON_KEY,
} from '../../constants/storage-keys';

/** Preferencias del visor (herramienta, tipo de tramo, snap y cuadrícula) persistidas en
 *  sessionStorage: sobreviven a la navegación de la sesión pero se reinician al recargar. */
export function useSessionVisorPrefs() {
  const [tool, setTool] = useState('sel');
  const [tipoTramo, setTipoTramo] = useState(() => {
    try {
      return sessionStorage.getItem(VISOR_TIPO_TRAMO_KEY) || 'ramal';
    } catch {
      return 'ramal';
    }
  });
  const [snapOn, setSnapOn] = useState(() => {
    try {
      const v = sessionStorage.getItem(VISOR_SNAP_ON_KEY);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });
  const [gridOn, setGridOn] = useState(() => {
    try {
      const v = sessionStorage.getItem(VISOR_GRID_ON_KEY);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_TOOL_KEY, tool);
    } catch {
      /* ignore */
    }
  }, [tool]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_TIPO_TRAMO_KEY, tipoTramo);
    } catch {
      /* ignore */
    }
  }, [tipoTramo]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_SNAP_ON_KEY, String(snapOn));
    } catch {
      /* ignore */
    }
  }, [snapOn]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_GRID_ON_KEY, String(gridOn));
    } catch {
      /* ignore */
    }
  }, [gridOn]);

  return { tool, setTool, tipoTramo, setTipoTramo, snapOn, setSnapOn, gridOn, setGridOn };
}
