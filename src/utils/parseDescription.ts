export function parseDescription(desc: string) {
  return (desc || '').split('+').map((s: string) => s.trim()).filter(Boolean);
}
