export function safeParse<T>(raw: string | null, fb: T): T {
  try { return JSON.parse(raw ?? '') as T; } catch { return fb; }
}
