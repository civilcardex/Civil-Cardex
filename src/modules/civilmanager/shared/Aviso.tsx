import { useEffect, useRef, useState } from 'react';

type ToastType = 'ok' | 'err' | '';
type ToastFn = (msg: string, opts?: { type?: ToastType; dur?: number }) => void;

let _showToast: ToastFn | null = null;

export function showToast(msg: string, opts?: { type?: ToastType; dur?: number }) {
  if (_showToast) _showToast(msg, opts);
}

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [cls, setCls] = useState<ToastType>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _showToast = (m, opts) => {
      const dur = opts?.dur ?? 3000;
      setMsg(m);
      setCls(opts?.type ?? '');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMsg(null), dur);
    };
    return () => {
      _showToast = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!msg) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="cm-toast"
      style={{ borderColor: cls === 'err' ? 'var(--err)' : cls === 'ok' ? 'var(--ok)' : undefined }}
    >
      {msg}
    </div>
  );
}
