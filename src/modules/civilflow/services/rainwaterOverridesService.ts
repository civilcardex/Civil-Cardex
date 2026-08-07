import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import type { BajanteLL, CanalLL } from '../context/RainwaterContext';

export interface RainwaterOverrides {
  bajantes: BajanteLL[];
  canales: CanalLL[];
}

interface BajanteOverrideRow {
  client_id: string;
  bajante: string;
  area_parcial: number | null;
  area_acumulada: number | null;
  intensidad: number | null;
  coeficiente_c: number | null;
  R: string | null;
  manning: number | null;
  diam_propuesto: number | null;
}
interface CanalOverrideRow {
  client_id: string;
  sector: string;
  area_parcial: number | null;
  area_acumulada: number | null;
  intensidad: number | null;
  coeficiente_c: number | null;
  manning: number | null;
  pendiente: number | null;
  b: number | null;
  h: number | null;
}

/**
 * Carga los overrides manuales de drenaje pluvial de un proyecto. Devuelve listas vacías
 * cuando aún no hay filas. Los ids efímeros (BLL-n/CLL-n) se regeneran porque dependen del
 * largo de la lista; la clave estable es bajante/sector.
 */
export async function loadRainwaterOverrides(proyectoId: number): Promise<RainwaterOverrides> {
  try {
    const [bajantesRes, canalesRes] = await Promise.all([
      supabase
        .from('rainwater_bajantes_overrides')
        .select(
          'client_id, bajante, area_parcial, area_acumulada, intensidad, coeficiente_c, R, manning, diam_propuesto',
        )
        .eq('proyecto_id', proyectoId)
        .order('id'),
      supabase
        .from('rainwater_canales_overrides')
        .select(
          'client_id, sector, area_parcial, area_acumulada, intensidad, coeficiente_c, manning, pendiente, b, h',
        )
        .eq('proyecto_id', proyectoId)
        .order('id'),
    ]);
    if (bajantesRes.error) throw bajantesRes.error;
    if (canalesRes.error) throw canalesRes.error;

    const bajantes: BajanteLL[] = ((bajantesRes.data ?? []) as BajanteOverrideRow[]).map(
      (r, i) => ({
        id: `BLL-${i + 1}`,
        bajante: r.bajante,
        areaParcial: r.area_parcial ?? 0,
        areaAcumulada: r.area_acumulada ?? 0,
        intensidad: r.intensidad ?? 100,
        coeficienteC: r.coeficiente_c ?? 0.0278,
        R: r.R ?? '',
        manning: r.manning ?? 0,
        diamPropuesto: r.diam_propuesto ?? 0,
      }),
    );
    const canales: CanalLL[] = ((canalesRes.data ?? []) as CanalOverrideRow[]).map((r, i) => ({
      id: `CLL-${i + 1}`,
      sector: r.sector,
      areaParcial: r.area_parcial ?? 0,
      areaAcumulada: r.area_acumulada ?? 0,
      intensidad: r.intensidad ?? 100,
      coeficienteC: r.coeficiente_c ?? 0.0278,
      manning: r.manning ?? 0.011,
      pendiente: r.pendiente ?? 0,
      b: r.b ?? 0,
      h: r.h ?? 0,
    }));
    return { bajantes, canales };
  } catch (e) {
    devError('rainwaterOverridesService load:', e);
    return { bajantes: [], canales: [] };
  }
}

/**
 * Persiste el snapshot de overrides manuales (borra-e-inserta por tabla, misma semántica
 * "sobrescribir todo" que saveProyectoCoreData). Solo se guardan filas con clave estable:
 * bajantes con `bajante` definido y canales con `sector` definido — las filas en blanco
 * recién creadas son efímeras y no sobreviven a la recarga.
 */
export async function saveRainwaterOverrides(
  proyectoId: number,
  bajantes: BajanteLL[],
  canales: CanalLL[],
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const bajanteRows = bajantes
      .filter((b) => b.bajante.trim().length > 0)
      .map((b) => ({
        proyecto_id: proyectoId,
        user_id: user.id,
        client_id: b.bajante.trim(),
        bajante: b.bajante.trim(),
        area_parcial: b.areaParcial,
        area_acumulada: b.areaAcumulada,
        intensidad: b.intensidad,
        coeficiente_c: b.coeficienteC,
        R: b.R,
        manning: b.manning,
        diam_propuesto: b.diamPropuesto,
      }));
    const canalRows = canales
      .filter((c) => c.sector.trim().length > 0)
      .map((c) => ({
        proyecto_id: proyectoId,
        user_id: user.id,
        client_id: c.sector.trim(),
        sector: c.sector.trim(),
        area_parcial: c.areaParcial,
        area_acumulada: c.areaAcumulada,
        intensidad: c.intensidad,
        coeficiente_c: c.coeficienteC,
        manning: c.manning,
        pendiente: c.pendiente,
        b: c.b,
        h: c.h,
      }));

    const [delBajError, delCanalError] = await Promise.all([
      supabase.from('rainwater_bajantes_overrides').delete().eq('proyecto_id', proyectoId),
      supabase.from('rainwater_canales_overrides').delete().eq('proyecto_id', proyectoId),
    ]);
    if (delBajError.error) throw delBajError.error;
    if (delCanalError.error) throw delCanalError.error;

    if (bajanteRows.length > 0) {
      const { error } = await supabase.from('rainwater_bajantes_overrides').insert(bajanteRows);
      if (error) throw error;
    }
    if (canalRows.length > 0) {
      const { error } = await supabase.from('rainwater_canales_overrides').insert(canalRows);
      if (error) throw error;
    }
  } catch (e) {
    devError('rainwaterOverridesService save:', e);
  }
}
