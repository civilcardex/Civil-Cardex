const SAN_EVENT = 'civilflow_san_sync_changed';
const HIDRO_EVENT = 'civilflow_hidro_sync_changed';

export function emitSanSync() { window.dispatchEvent(new Event(SAN_EVENT)); }
export function emitHidroSync() { window.dispatchEvent(new Event(HIDRO_EVENT)); }

export function onSanSync(callback: () => void) {
  window.addEventListener(SAN_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SAN_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function onHidroSync(callback: () => void) {
  window.addEventListener(HIDRO_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(HIDRO_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
