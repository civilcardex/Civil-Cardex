/**
 * Las 44 verificaciones normativas del motor RCI (Red Contra Incendio): cada una evalúa por
 * tipología y se informa la peor, con estado CUMPLE / NO CUMPLE / REVISAR / PENDIENTE, el valor
 * formateado, la norma (NFPA (National Fire Protection Association) u otra fuente), la guía de
 * corrección y el dato a donde ir ("go"). Ej: checks() del ejemplo devuelve 44 en "CUMPLE".
 *
 * Fachada: compone los verificadores por dominio (carpeta checks/) en el MISMO orden histórico.
 * El orden de la lista L es contrato (tests e informes comparan por posición/label); los
 * agregadores add/addT/addR viven en checks/helpers.ts y viajan en el ChecksCtx.
 */
import { rciTxt } from '../../constants/rciCountryStandards.ts';
import type {
  Criterios,
  Edificio,
  FilaRoute,
  RciResult,
  RciState,
  RouteResult,
  Verificacion,
} from './types';
import {
  crearAdd,
  crearAddR,
  crearAddT,
  type ChecksCtx,
  type DibujoPiso,
  type TpsItem,
} from './checks/helpers';
import { verificarDatosEntrada } from './checks/datosEntrada';
import { verificarAlmacenamiento } from './checks/almacenamiento';
import { verificarRociadores, verificarDuracion, verificarTecho } from './checks/rociadores';
import { verificarEdificio } from './checks/edificio';
import { verificarRedRamales } from './checks/redRamales';
import { verificarTuberias, verificarPresionNudos } from './checks/tuberias';
import { verificarSiamesa } from './checks/siamesa';
import { verificarMontantesSp } from './checks/montantesSp';
import { verificarBombas } from './checks/bombas';
import { verificarSismo } from './checks/sismo';
import { verificarNormativaPais } from './checks/normativaPais';
import { verificarMurosDibujo } from './checks/murosDibujo';

/** Evalúa las verificaciones sobre el resultado R. `dibujo` (opcional, del piso activo del
 *  visor) habilita la verificación de distancia de ramales a muros. No lanza: todo problema de
 *  datos se refleja en el estado o en la guía de la verificación correspondiente. */
export function checks(st: RciState, R: RciResult, dibujo?: DibujoPiso): Verificacion[] {
  const ro = R.roc,
    c = st.clas,
    L: Verificacion[] = [];
  /* Cita de la norma de diseño con el marco legal del país del proyecto (meta.pais →
   * perfilRciDe; lista única de Identificación). Ej: CO → 'NFPA 13-2025 (NSR-10 J)'. */
  const cita = rciTxt(st.meta.pais);

  const add = crearAdd(L);
  const E0: Edificio | null = R.edif;
  const tps: TpsItem[] = E0
    ? Object.values(E0.typ).map((t) => ({
        id: t.g.id,
        ro: t.roc || ro,
        riesgo: t.riesgo || c.riesgo,
        sis: (t as unknown as { g?: { sistema?: string } }).g?.sistema || c.sistema,
        rd: t.rd || null,
        Nop: t.rd ? t.rd.Nop : 0,
        Qroc: t.rd && t.rd.rt && t.rd.rt.solved ? t.rd.rt.Q! : 0,
        routes: t.rd
          ? [...t.rd.rams.map((x) => x.res), ...t.rd.tramos.map((y) => y.res)].filter(
              (x): x is RouteResult => !!x,
            )
          : [],
        rows: [] as FilaRoute[],
      }))
    : [
        {
          id: '',
          ro,
          riesgo: c.riesgo,
          sis: c.sistema,
          rd: R.red,
          Nop: R.Nop,
          Qroc: R.Qroc,
          routes: R.effRamales.map((b) => R.branches[b.id]).filter((x): x is RouteResult => !!x),
          rows: [] as FilaRoute[],
        },
      ];
  const tpsRed: TpsItem[] = E0 ? tps.filter((t) => t.rd) : tps;
  const multi = tps.length > 1;
  const bldRoutes = [R.alim, R.gab].filter((x): x is RouteResult => !!x),
    bldRows = bldRoutes.flatMap((r) => r.rows || []);
  tps.forEach((t) => {
    t.rows = t.routes.flatMap((r) => r.rows || []);
  });
  const addT = crearAddT(tps, multi, add);
  /* Verificaciones sobre todas las tuberías: cada tipología y, aparte, montante + cuarto de bombas + gabinetes */
  const tB: TpsItem[] = tpsRed.concat(
    bldRows.length
      ? [
          {
            id: 'Montante',
            rows: bldRows,
            bld: true,
            ro: null as unknown as Criterios,
            riesgo: '',
            sis: c.sistema,
            rd: null,
            Nop: 0,
            Qroc: 0,
            routes: [],
          },
        ]
      : [],
  );
  const addR = crearAddR(tB, multi, add);

  const ctx: ChecksCtx = { st, R, cita, tps, tpsRed, bldRows, add, addT, addR, dibujo };
  verificarDatosEntrada(ctx); // tramos completos + datos fuera de rango
  verificarAlmacenamiento(ctx); // riesgo de almacenamiento + altura de arrume
  verificarRociadores(ctx); // separaciones S/L, área, DMR, operación y caudal
  verificarEdificio(ctx); // perfil del edificio (holgura, VRP, válvula reguladora)
  verificarRedRamales(ctx); // conexiones, tees, dibujados, lado largo, sistema seco
  verificarTuberias(ctx); // accesorios, coeficiente C y velocidad en todas las tuberías
  verificarDuracion(ctx); // duración de la descarga ≥ mínima
  verificarSiamesa(ctx); // las 7 de la siamesa
  verificarMontantesSp(ctx); // diámetro del montante ≥ 4"
  verificarBombas(ctx); // curva, churn, succión, NPSH y jockey
  verificarSismo(ctx); // arriostramiento antisísmico
  verificarTecho(ctx); // techo ≤ 9,14 m para criterios estándar
  verificarPresionNudos(ctx); // presión en cada nudo dentro de límites
  verificarNormativaPais(ctx); // código local registrado
  verificarMurosDibujo(ctx); // distancia de ramales a muros (dibujo del piso activo)
  return L;
}

export type { DibujoPiso } from './checks/helpers';
