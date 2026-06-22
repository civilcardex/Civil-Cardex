export function safeJsonParse<T = Record<string, any>>(raw: unknown, fallback: T = {} as T): T {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
  return (raw as T) ?? fallback;
}
