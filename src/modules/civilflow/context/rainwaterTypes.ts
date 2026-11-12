// Tipos del cálculo pluvial (ll = Lluvias), extraídos verbatim de RainwaterContext al
// partir el archivo: el contexto los re-exporta y sus consumidores no cambian de import.

/** Áreas crudas ("areas") del doc de trazos de un plano: Σ areaM2 = área total del piso. */
export interface AreaRaw {
  areaM2?: number;
}
/** Bajante pluvial de la tabla de lluvias: áreas (parcial + otras), intensidad de lluvia, coeficiente C de escorrentía (cuánta lluvia llega al tubo) y diámetro propuesto. */
export interface BajanteLL {
  id: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras: metros cuadrados de techo extra que el usuario suma a mano (pedido del cliente); editable desde la tabla, por defecto 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — de ella sale el caudal real (Q, o sea cuántos litros por segundo escurren). */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  /** Material de cubierta (nombre completo en MATERIALES_CUBIERTA_LL): de él sale C, el
   *  coeficiente de escorrentía (cuánta lluvia llega al tubo y cuánta se absorbe en el
   *  techo), según el catálogo. Sin material se usa el coeficienteC manual. */
  materialCubierta?: string;
  R: string;
  manning: number;
  diamPropuesto: number;
}
/** Canal pluvial de la tabla de lluvias: geometría (b, h, pendiente), material con su n de Manning (rugosidad) y borde libre. Ej: canal de concreto n=0.013 con b=30 cm. */
export interface CanalLL {
  id: string;
  sector: string;
  areaParcial: number;
  /** Área Otras: metros cuadrados de techo extra que el usuario suma a mano (pedido del cliente); editable desde la tabla, por defecto 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — de ella sale el caudal real (Q, o sea cuántos litros por segundo escurren). */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  manning: number;
  pendiente: number;
  b: number;
  h: number;
  /** Largo horizontal del canal (cm), solo glifos dibujados (fromCanal). */
  longitud?: number;
  /** Nivel (el piso) del canal — solo glifos dibujados (fromCanal); alimenta la columna Nivel. */
  piso?: number;
  /** Material de cubierta (de él sale C, el coeficiente de escorrentía) y de canal (sale
   *  n, el coeficiente de Manning, qué tan rugoso es el canal) — hoja "2. Canales". */
  materialCubierta?: string;
  materialCanal?: string;
  /** Área de muro vertical que descarga sobre el canal (m²) — A efectiva = A + 0.5·muro. */
  muroVertical?: number;
  /** Borde libre editable por fila (cm) — port hoja 2 (antes fijo 10 cm). */
  bordeLibreCm?: number;
  /** Id del canal dibujado (glifo) — solo fromCanal: para escribir b/h/longitud/pendiente
   *  de vuelta al dibujo (writeCanalDimsToDrawing). */
  drawId?: string;
  /** Id del plano del glifo — solo fromCanal (el write necesita el piso exacto). */
  drawPlanId?: string | number;
  /** Es true cuando b/h/longitud/pendiente provienen de un canal dibujado (glifo) en la
   *  red 'll' — la tabla los muestra editables y escribe de vuelta al dibujo
   *  (writeCanalDimsToDrawing), que sigue siendo la fuente de verdad. */
  fromCanal?: boolean;
}
/** Valor que provee RainwaterContext a sus consumidores (tablas Chequeo, visor, panel derecho): filas de bajantes y canales + sus CRUD y asociaciones. */
export interface RainwaterContextValue {
  bajantesLl: BajanteLL[];
  addBajanteLL: () => void;
  delBajanteLL: (id: string) => void;
  updBajanteLL: (id: string, field: string, val: string | number) => void;
  canalesLl: CanalLL[];
  addCanalLL: () => void;
  delCanalLL: (id: string) => void;
  updCanalLL: (id: string, field: string, val: string | number) => void;
  updCanalSector: (sector: string, field: string, val: string | number) => void;
  /** Cambio único de material de canal: lo llaman tablas, panel derecho y menú contextual
   *  y todos escriben por el mismo camino. `ref` = drawId del glifo o id de la fila. */
  setMaterialCanal: (ref: string, field: 'materialCubierta' | 'materialCanal', mat: string) => void;
  /** Bajantes asociados a cada canal (pedido del cliente): id de canal → chips "BAN1-P1". */
  canalBajantes: Record<string, string[]>;
  canalAlimIds: Record<string, string[]>;
  conRecolectora: boolean;
  setConRecolectora: (v: boolean) => void;
}
