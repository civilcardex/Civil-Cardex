export function parseDescripcion(desc) {
  return (desc || '').split('+').map(s => s.trim()).filter(Boolean);
}
