export function clearLocalWorkspace(): void {
  const lsKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('civilflow_')) lsKeys.push(k);
  }
  for (const k of lsKeys) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
