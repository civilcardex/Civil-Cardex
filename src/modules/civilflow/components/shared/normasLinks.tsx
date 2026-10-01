// Tabla central de links normativos (orig. usuario: cada norma enlaza a SU fuente oficial,
// no a un dominio genérico). URLs verificados HTTP 200 el 2026-09-30:
//  - RAS/Res.0330/Res.0799 → página oficial del RAS en MinVivienda (las Res. lo modifican).
//  - NSR-10 → sitio oficial nsr10.com (Comisión Asesora Permanente / AIS).
//  - NTC → búsqueda exacta por norma en tienda.icontec.org (la ficha pública por número no
//    existe estable; la búsqueda retorna 200 con título «Resultados de la búsqueda de «NTC nnnn»»).
//  - NFPA → ficha propia del código en nfpa.org (patrón /product/nfpa-n-standard/p00nncode).
//  - RETIE/Decreto 0926/2010 → MinEnergía (su normograma histórico responde 000/caído).

/** URL oficial de cada norma (claves canónicas). */
export const NORMA_URLS: Record<string, string> = {
  'RAS 2000':
    'https://www.minvivienda.gov.co/viceministerio-de-agua-y-saneamiento-basico-reglamento-tecnico-sector-reglamento-tecnico-del-sector-de-agua-potable-y-saneamiento-basico-ras',
  'Resolución 0330 de 2017':
    'https://www.minvivienda.gov.co/viceministerio-de-agua-y-saneamiento-basico-reglamento-tecnico-sector-reglamento-tecnico-del-sector-de-agua-potable-y-saneamiento-basico-ras',
  'Resolución 0799 de 2021':
    'https://www.minvivienda.gov.co/viceministerio-de-agua-y-saneamiento-basico-reglamento-tecnico-sector-reglamento-tecnico-del-sector-de-agua-potable-y-saneamiento-basico-ras',
  'NSR-10': 'https://www.nsr10.com',
  'NTC 1500': 'https://tienda.icontec.org/?s=NTC%201500&post_type=product',
  'NTC 1669': 'https://tienda.icontec.org/?s=NTC%201669&post_type=product',
  'NTC 2050': 'https://tienda.icontec.org/?s=NTC%202050&post_type=product',
  'NTC 2301': 'https://tienda.icontec.org/?s=NTC%202301&post_type=product',
  'NTC 3631': 'https://tienda.icontec.org/?s=NTC%203631&post_type=product',
  'NTC 5562': 'https://tienda.icontec.org/?s=NTC%205562&post_type=product',
  'NTC 920': 'https://tienda.icontec.org/?s=NTC%20920&post_type=product',
  'NTC 382': 'https://tienda.icontec.org/?s=NTC%20382&post_type=product',
  'NTC 1087': 'https://tienda.icontec.org/?s=NTC%201087&post_type=product',
  'NTC 3728': 'https://tienda.icontec.org/?s=NTC%203728&post_type=product',
  'NTC 3096': 'https://tienda.icontec.org/?s=NTC%203096&post_type=product',
  'NFPA 13': 'https://www.nfpa.org/product/nfpa-13-standard/p0013code',
  'NFPA 14': 'https://www.nfpa.org/product/nfpa-14-standard/p0014code',
  'NFPA 20': 'https://www.nfpa.org/product/nfpa-20-standard/p0020code',
  'NFPA 22': 'https://www.nfpa.org/product/nfpa-22-standard/p0022code',
  'NFPA 25': 'https://www.nfpa.org/product/nfpa-25-standard/p0025code',
  'NFPA 54': 'https://www.nfpa.org/product/nfpa-54-standard/p0054code',
  'NFPA 72': 'https://www.nfpa.org/product/nfpa-72-standard/p0072code',
  RETIE: 'https://www.minenergia.gov.co',
  'Decreto 0926/2010': 'https://www.minenergia.gov.co',
};

/** Resuelve el URL de una norma tolerando sufijos de edición («NTC 1500:2023» → «NTC 1500»).
 *  Devuelve undefined si la norma no está en la tabla (el llamante muestra texto plano). */
export function normaUrl(nombre: string): string | undefined {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (NORMA_URLS[limpio]) return NORMA_URLS[limpio];
  const base = limpio.split(':')[0].trim();
  return NORMA_URLS[base];
}

/** Ancla de norma con la redirección estándar (nueva pestaña, sin referrer) y el color
 *  de link usado en todos los sidebars. Sin URL en la tabla renderiza texto plano. */
export function NormaLink({ nombre, children }: { nombre: string; children?: React.ReactNode }) {
  const href = normaUrl(nombre);
  if (!href) return <>{children ?? nombre}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>
      {children ?? nombre}
    </a>
  );
}
