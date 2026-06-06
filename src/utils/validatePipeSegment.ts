export function validateTramo(t) {
  const v = t.v_real || 0;
  const y = t.yD || 0;
  const q = t.qQ0 || 0;
  return v >= 0.45 && v <= 4.0 && y <= 0.75 && q <= 1.0;
}
