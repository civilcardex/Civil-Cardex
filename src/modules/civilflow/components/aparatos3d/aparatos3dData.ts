/**
 * Datos del catálogo "Detalle Aparatos" — transcripción LITERAL del HTML original
 * (DETALLE_APARATOS_v2, petición explícita del usuario: los aparatos tal cual, sin cambios).
 * Los modelos GLB viven en public/models/aparatos/*.glb (byte-exactos del adjunto).
 */

export interface Aparato3D {
  id: number;
  name: string;
  modelKey: string;
  color: string;
}

export const COMPONENTS: Aparato3D[] = [
  { id: 1, name: 'Inodoro', modelKey: 'inodoro', color: '#7d8590' },
  { id: 2, name: 'Lavamanos', modelKey: 'lavamanos', color: '#7d8590' },
  { id: 3, name: 'Ducha', modelKey: 'ducha', color: '#7d8590' },
  { id: 4, name: 'Lavaplatos', modelKey: 'lavaplatos', color: '#7d8590' },
  { id: 5, name: 'Lavadero', modelKey: 'lavadero', color: '#7d8590' },
  { id: 6, name: 'Calentador de agua', modelKey: 'calentador', color: '#7d8590' },
  { id: 7, name: 'Tina', modelKey: 'tina', color: '#7d8590' },
  { id: 8, name: 'Orinal', modelKey: 'orinal', color: '#7d8590' },
  { id: 9, name: 'Canal de aguas lluvias', modelKey: 'canal', color: '#f0a830' },
  { id: 10, name: 'Salida ventilación en cubierta', modelKey: 'ventilacion', color: '#f0a830' },
  { id: 11, name: 'Tragantes / rejillas', modelKey: 'tragantes', color: '#f0a830' },
  { id: 12, name: 'Lavadora', modelKey: 'lavadora', color: '#7d8590' },
];

export const COMP_DESC: Record<number, { body: string; norm: string }> = {
  1: {
    body: 'Inodoro (sanitario): aparato sanitario de porcelana vitrificada destinado a la evacuación de excretas. Se conecta a la red de aguas negras mediante sifón integrado. La conexión al piso se realiza con collarín y sello de cera sobre la salida de 4". Distancia de instalación: eje de descarga a 0.30 m de la pared posterior.',
    norm: 'NTC 920-1 / NTC 1500 §3 / RAS 2000 Tít.B §B.3',
  },
  2: {
    body: 'Lavamanos: aparato sanitario de loza para el lavado de manos y cara. Se instala empotrado, semi-empotrado o de sobreponer según el diseño arquitectónico. La trampa sifónica (P-trap o botella) debe estar accesible para mantenimiento. Conexión de suministro 1/2" con válvulas de ángulo. Desagüe de 2". La altura estándar del borde superior es 0.80–0.85 m sobre el nivel de piso terminado.',
    norm: 'NTC 1500 §3 / NTC 920-2 / RAS 2000 Tít.B §B.3',
  },
  3: {
    body: 'Ducha: aparato de aseo personal que suministra agua mediante rociador. La conexión de agua fría y caliente es de ½" con válvula mezcladora termostática o de presión balanceada recomendada. El desagüe de piso es de 2" con sifón de piso integrado. El área de ducha debe impermeabilizarse perimetralmente hasta 1.80 m de altura.',
    norm: 'NTC 1500 §3 / NTC 920 / RAS 2000 Tít.B §B.3',
  },
  4: {
    body: 'Lavaplatos: fregadero de cocina en acero inoxidable, porcelana o granito. Puede ser de una o dos pocetas. Conexión de suministro ½" con válvulas de ángulo bajo mesón. Desagüe de 2" con sifón tipo botella o P-trap. Incluye trampa contra grasa si la norma local lo exige para restaurantes o cocinas industriales. Instalación enrasada o sobre cubierta según el diseño.',
    norm: 'NTC 1500 §3 / RAS 2000 Tít.B §B.3 / NSR-10 Tít.J',
  },
  5: {
    body: 'Lavadero: aparato de concreto, granito o plástico reforzado para lavado de ropa y utensilios. Generalmente con una poceta profunda y tabla de lavar. Conexión de suministro ½". Desagüe de 2" sin sifón propio — requiere sifón de piso o trampa externa. Se instala a 0.85–0.90 m del NPT. En zonas de ropas se recomienda incluir toma de agua caliente.',
    norm: 'NTC 1500 §3 / RAS 2000 Tít.B §B.3',
  },
  6: {
    body: 'Calentador de Agua: aparato que eleva la temperatura del agua fría para uso sanitario. Puede ser eléctrico, a gas (paso o acumulación) o solar. La instalación incluye: válvula de corte aguas arriba, válvula de seguridad térmico-presión, expansor (en sistemas cerrados) y bajante de gases al exterior (para gas). La tubería de agua caliente debe aislarse térmicamente. La distancia al punto de consumo determina el tiempo de espera.',
    norm: 'NTC 3631 / NTC 1500 §10 / Res. 90708 CREG / Fabricante',
  },
  7: {
    body: 'Tina (Bañera): aparato de baño para inmersión corporal en acrílico, fibra de vidrio o hierro fundido esmaltado. Desagüe de 2" con tapón y rebosadero integrado. Conexiones de suministro ½" F/C con válvula mezcladora. Se recomienda válvula anti-escaldado (terrestática) para la llave de llenado. El piso de la tina debe tener antideslizante. Requiere acceso para inspección al sifón y conexiones.',
    norm: 'NTC 1500 §3 / NTC 920 / RAS 2000 Tít.B §B.3',
  },
  8: {
    body: 'Orinal (Mingitorio): aparato sanitario de porcelana para la evacuación de orina, de uso exclusivamente masculino. Puede ser individual o corrido. Descarga por sifón integrado de 2". Suministro de ½" para limpieza automática o manual. Se instala a una altura de 0.60 m desde el NPT hasta el borde inferior del aparato (adultos). En orinales sin agua se requiere cartucho trampa sellante según fabricante.',
    norm: 'NTC 1500 §3 / NTC 920 / RAS 2000 Tít.B §B.3',
  },
  9: {
    body: 'Canal de Aguas Lluvias: elemento recolector de escorrentía superficial en cubiertas, patios y zonas exteriores. Conduce el agua de lluvia por gravedad hacia bajantes o sumideros. Debe diseñarse con pendiente mínima del 0.5% y sección suficiente para el caudal de diseño según intensidad de lluvia local (curvas IDF IDEAM). Material: PVC, concreto prefabricado, zinc o lámina galvanizada.',
    norm: 'RAS 2000 Tít.D §D.4 / NSR-10 Tít.J / NTC 1500 §8',
  },
  10: {
    body: 'Salida de Ventilación en Cubierta: terminal superior de la columna de ventilación de las redes sanitarias. Permite la entrada de aire para compensar presiones negativas generadas por el flujo de aguas residuales, evitando el sifonamiento de sellos hídricos. Debe sobresalir mínimo 0.15 m sobre la cubierta terminada y ubicarse a distancia reglamentaria de ventanas y tomas de aire. Se recomienda instalar una malla en la punta tipo Angeo para evitar el ingreso de plagas o animales.',
    norm: 'NTC 1500 §4.5 / RAS 2000 Tít.D §D.3 / NSR-10 Tít.J',
  },
  11: {
    body: 'Tragantes / Rejillas (Sumideros): dispositivos receptores instalados a nivel de cubierta, terraza o piso para captar aguas lluvias o residuales y conducirlas al bajante o colector. Constan de cuerpo, rejilla removible y sello hídrico. La rejilla impide el paso de sólidos. El área de la rejilla debe diseñarse para drenar el caudal máximo sin represamiento. Instalación con impermeabilización perimetral en cubiertas.',
    norm: 'RAS 2000 Tít.D §D.4 / NTC 1500 §8 / NSR-10 Tít.J §J.3',
  },
  12: {
    body: 'Lavadora: electrodoméstico para el lavado automático de ropa. Conexión de suministro de agua fría (y caliente en algunos modelos) de ½" con válvula de ángulo. Desagüe flexible de 1½" que descarga al sifón de piso o colector sanitario que debe ser de 2" como mínimo. La instalación debe incluir toma eléctrica independiente con polo a tierra. Se recomienda bandeja de contención para evitar daños por fugas.',
    norm: 'NTC 1500 §3 / RAS 2000 Tít.B §B.3 / RETIE Art.35',
  },
};

export const NOTA_NORMATIVA =
  '⚠ Nota normativa: El presente detalle es una representación técnica de referencia elaborada con base en las normas RAS 2000 Tít.D / Resolución 0330 de 2017, NTC 1500:2023, NSR-10 Tít.J y NTC 3631, vigentes a la fecha de publicación. Los criterios de diseño, dimensionamiento hidráulico, selección y ubicación de aparatos deben ser verificados y ajustados por un ingeniero competente conforme a las ediciones vigentes de cada norma en el momento de la ejecución del proyecto, así como a los catálogos de los respectivos fabricantes. CIVILCARDEX no asume responsabilidad por aplicaciones que no hayan sido validadas por el profesional responsable de la obra.';

/** URL del GLB de un aparato (asset público byte-exacto del HTML original). */
export function glbUrl(modelKey: string): string {
  return `/models/aparatos/${modelKey}.glb`;
}
