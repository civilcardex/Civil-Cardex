import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import { CF_TABLES } from '../constants/tableNames';
import type { BajanteLL, CanalLL } from '../context/RainwaterContext';

export interface RainwaterOverrides {
  bajantes: BajanteLL[];
  canales: CanalLL[];
}

interface BajanteOverrideRow {
  id_cliente: string;
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
  id_cliente: string;
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
        .from(CF_TABLES.anulacionesBajantes)
        .select(
          'id_cliente, bajante, area_parcial, area_acumulada, intensidad, coeficiente_c, R, manning, diam_propuesto',
        )
        .eq('proyecto_id', proyectoId)
        .order('id'),
      supabase
        .from(CF_TABLES.anulacionesCanales)
        .select(
          'id_cliente, sector, area_parcial, area_acumulada, intensidad, coeficiente_c, manning, pendiente, b, h',
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
 * Persiste el snapshot de overrides manuales vía RPC SECURITY DEFINER (borra-e-inserta por
 * tabla, misma semántica "sobrescribir todo" que saveProyectoCoreData). Solo se guardan filas
 * con clave estable: bajantes con `bajante` definido y canales con `sector` definido — las
 * filas en blanco recién creadas son efímeras y no sobreviven a la recarga. Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
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
        id_cliente: b.bajante.trim(),
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
        id_cliente: c.sector.trim(),
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

    const { error } = await supabase.rpc('save_rainwater_overrides', {
      p_proyecto_id: proyectoId,
      p_bajantes: bajanteRows,
      p_canales: canalRows,
    });
    if (error) devError('rainwaterOverridesService save rpc:', error.message);
  } catch (e) {
    devError('rainwaterOverridesService save exception:', e);
  }
}
