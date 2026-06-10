const SAN_EVENT = 'civilflow_san_sync_changed';
const HYDRO_EVENT = 'civilflow_hidro_sync_changed';

export function emitSanSync() { window.dispatchEvent(new Event(SAN_EVENT)); }
export function emitHydroSync() { window.dispatchEvent(new Event(HYDRO_EVENT)); }

export function onDrawingSync(event: string, callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener('storage', callback);
  };
}

export function onSanSync(callback: () => void) {
  return onDrawingSync(SAN_EVENT, callback);
}

export function onHydroSync(callback: () => void) {
  return onDrawingSync(HYDRO_EVENT, callback);
}
