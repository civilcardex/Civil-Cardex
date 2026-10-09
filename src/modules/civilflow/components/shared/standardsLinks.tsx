import type React from 'react';

// Tabla central de links normativos (orig. usuario: cada norma enlaza a SU fuente oficial,
// no a un dominio genérico). URLs verificados HTTP 200 el 2026-10-09:
//  - RAS/Res.0330/Res.0799 → página oficial del RAS en MinVivienda (las Res. lo modifican).
//  - NSR-10 → sitio oficial nsr10.com (Comisión Asesora Permanente / AIS).
//  - NTC → búsqueda exacta por norma en tienda.icontec.org (la ficha pública por número no
//    existe estable; la búsqueda retorna 200 con título «Resultados de la búsqueda de «NTC nnnn»»).
//  - NFPA → ficha propia del código en nfpa.org (patrón /product/nfpa-n-standard/p00nncode).
//  - RETIE/Decreto 0926/2010 → página oficial del reglamento en MinEnergía (el normograma
//    histórico responde caído; la homepage genérica se reemplazó 2026-10-09).
//  - Por país: RNE (gob.pe/Vivienda), NEC (mit.gob.ec — la gestión NEC migró de MIDUVI a MIT),
//    OGUC (BCN LeyChile idNorma=8201), SISS/INN (Chile), IBNORCA (Bolivia), ENRE (¡ojo!: el
//    dominio www.enre.gob.ar sirve un certificado TLS INVÁLIDO — se usa www.enre.gov.ar),
//    ENARGAS, SENCAMER (COVENIN Venezuela), INTN (Paraguay), INACAL (NTP Perú).
//  - Universales: UL, FM Approvals, ISO, IEC, ASTM, ASME. RENISDA/NTE INEN 1108 sin página
//    oficial verificada → quedan como texto plano.

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
  RETIE:
    'https://www.minenergia.gov.co/es/misional/energia-electrica-2/reglamentos-tecnicos/reglamento-t%C3%A9cnico-de-instalaciones-el%C3%A9ctricas-retie',
  'Decreto 0926/2010':
    'https://www.minenergia.gov.co/es/misional/energia-electrica-2/reglamentos-tecnicos/reglamento-t%C3%A9cnico-de-instalaciones-el%C3%A9ctricas-retie',
  // Perú (RNE — las normas IS/OS/A viven dentro del mismo reglamento; INACAL emite las NTP)
  RNE: 'https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne',
  'RNE IS.010':
    'https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne',
  'RNE OS.050':
    'https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne',
  'RNE A.130':
    'https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne',
  NTP: 'https://www.inacal.gob.pe',
  // Ecuador (NEC — gestión actual en MIT; NEC-SB-IG gas en el portal gob.ec de regulaciones)
  NEC: 'https://www.mit.gob.ec/norma-ecuatoriana-de-la-construccion',
  'NEC Cap.16': 'https://www.mit.gob.ec/norma-ecuatoriana-de-la-construccion',
  'NTE INEN 2295':
    'https://www.gob.ec/regulaciones/norma-ecuatoriana-construccion-nec-sb-ig-instalaciones-gases-combustibles-uso-residencial-comercial-industrial',
  // Chile (OGUC en LeyChile/BCN; SISS sanitario; INN emite las NCh)
  OGUC: 'https://www.bcn.cl/leychile/navegar?idNorma=8201',
  'OGUC 4.1.5': 'https://www.bcn.cl/leychile/navegar?idNorma=8201',
  'OGUC 4.4': 'https://www.bcn.cl/leychile/navegar?idNorma=8201',
  SISS: 'https://www.siss.gob.cl',
  NCh: 'https://www.inn.cl',
  // Bolivia / Argentina / Venezuela / Paraguay
  NB: 'https://www.ibnorca.org',
  ENRE: 'https://www.enre.gov.ar',
  'ENRE 1055/13': 'https://www.enre.gov.ar',
  ENARGAS: 'https://www.enargas.gob.ar',
  COVENIN: 'https://www.sencamer.gob.ve',
  INTN: 'https://www.intn.gov.py',
  // Universales (familias: cualquier número resuelve a la fuente oficial)
  NFPA: 'https://www.nfpa.org',
  UL: 'https://www.ul.com',
  FM: 'https://www.fmapprovals.com',
  ISO: 'https://www.iso.org',
  IEC: 'https://webstore.iec.ch',
  ASTM: 'https://www.astm.org',
  ASME: 'https://www.asme.org/codes-standards',
};

/** Resuelve el URL de una norma tolerando sufijos de edición («NTC 1500:2023» → «NTC 1500»)
 *  y familias («UL 199» → UL, «IEC 61800-5-1:2022» → IEC). Cualquier «NTC nnnn» cae a la
 *  búsqueda exacta de ICONTEC. Devuelve undefined si no hay fuente (texto plano). */
export function normaUrl(nombre: string): string | undefined {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (NORMA_URLS[limpio]) return NORMA_URLS[limpio];
  const base = limpio.split(':')[0].trim();
  if (NORMA_URLS[base]) return NORMA_URLS[base];
  const ntc = /^NTC (\d{3,4})$/.exec(base);
  if (ntc) return `https://tienda.icontec.org/?s=NTC%20${ntc[1]}&post_type=product`;
  return NORMA_URLS[base.split(' ')[0]];
}

/** Tokens reconocidos por NormaTxt (orden: literales largos primero, luego familias). */
const NORMA_TOKEN_SRC = [
  'Resolución 0330 de 2017',
  'Resolución 0799 de 2021',
  'Decreto 0926/2010',
  'RAS(?: 2000)?',
  'NSR-10',
  'RETIE',
  'NFPA ?\\d+[A-Z]*',
  'NTC ?\\d+',
  'NTE INEN ?\\d+',
  'NCh ?\\d+',
  'NTP ?\\d+',
  'NB ?\\d+',
  'ISO ?\\d+',
  'IEC ?\\d+(?:-\\d+)*',
  'ASTM ?[A-Z]\\d+',
  'UL ?\\d+[A-Z]*',
  'FM ?\\d+',
  'RNE ?(?:IS|OS|A|EM)\\.?\\d+',
  'OGUC(?: ?[\\d.]+)?',
  'NEC(?: ?Cap\\.? ?\\d+)?',
  'ENRE(?: 1055/13)?',
  'ENARGAS',
  'SISS',
  'RENISDA',
  'COVENIN',
  'INTN',
  'ASME(?: BPVC)?',
].join('|');

/** Texto con las normas citadas LINKIFICADAS a su fuente oficial (NormaLink). Se usa en la
 *  línea «Referencia normativa» de los visores 3D: los tokens reconocidos quedan como anclas
 *  y el resto del texto intacto. */
export function NormaTxt({ texto }: { texto: string }) {
  const partes = texto.split(new RegExp(`(${NORMA_TOKEN_SRC})`, 'g'));
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <NormaLink key={i} nombre={p}>
            {p}
          </NormaLink>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
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
