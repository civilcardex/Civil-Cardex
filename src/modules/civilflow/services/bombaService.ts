import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import { CF_TABLES } from '../constants/tableNames';

export interface BombaData {
  salSim: string;
  udTot: string;
  hz: string;
  lImp: string;
  dImp: string;
  cHW: string;
  pDesc: string;
  etaB: string;
  fSrv: string;
  tCic: string;
  hMin: string;
  hMax: string;
  bCam: string;
  lCam: string;
  npsh: string;
}

interface BombaDatosRow {
  sal_sim: string | null;
  ud_tot: string | null;
  hz: string | null;
  l_imp: string | null;
  d_imp: string | null;
  c_hw: string | null;
  p_desc: string | null;
  eta_b: string | null;
  f_srv: string | null;
  t_cic: string | null;
  h_min: string | null;
  h_max: string | null;
  b_cam: string | null;
  l_cam: string | null;
  npsh: string | null;
}

/**
 * Carga los datos de la bomba sumergible (bomba_datos_proyecto, 1:1 con el proyecto).
 * Devuelve null cuando la fila no existe aún — el llamador decide usar defaults.
 */
export async function loadBombaDatos(proyectoId: number): Promise<BombaData | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.bombaDatos)
      .select(
        'sal_sim, ud_tot, hz, l_imp, d_imp, c_hw, p_desc, eta_b, f_srv, t_cic, h_min, h_max, b_cam, l_cam, npsh',
      )
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('bombaService load:', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as BombaDatosRow;
    return {
      salSim: row.sal_sim ?? '',
      udTot: row.ud_tot ?? '',
      hz: row.hz ?? '',
      lImp: row.l_imp ?? '',
      dImp: row.d_imp ?? '',
      cHW: row.c_hw ?? '',
      pDesc: row.p_desc ?? '',
      etaB: row.eta_b ?? '',
      fSrv: row.f_srv ?? '',
      tCic: row.t_cic ?? '',
      hMin: row.h_min ?? '',
      hMax: row.h_max ?? '',
      bCam: row.b_cam ?? '',
      lCam: row.l_cam ?? '',
      npsh: row.npsh ?? '',
    };
  } catch (e) {
    devError('bombaService load exception:', e);
    return null;
  }
}

/**
 * Upsert parcial de bomba_datos_proyecto vía RPC SECURITY DEFINER (1:1 con el proyecto, no
 * toca otras tablas). Lo usa BombaARDesign (debounced) como fuente de verdad; el snapshot de
 * 'civilflow_memoria_bomba_data' queda como caché en vivo para la memoria final. Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
export async function saveBombaDatos(proyectoId: number, b: BombaData): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_bomba_datos', {
      p_proyecto_id: proyectoId,
      p_datos: {
        sal_sim: b.salSim,
        ud_tot: b.udTot,
        hz: b.hz,
        l_imp: b.lImp,
        d_imp: b.dImp,
        c_hw: b.cHW,
        p_desc: b.pDesc,
        eta_b: b.etaB,
        f_srv: b.fSrv,
        t_cic: b.tCic,
        h_min: b.hMin,
        h_max: b.hMax,
        b_cam: b.bCam,
        l_cam: b.lCam,
        npsh: b.npsh,
      },
    });
    if (error) devError('bombaService save rpc:', error.message);
  } catch (e) {
    devError('bombaService save exception:', e);
  }
}
