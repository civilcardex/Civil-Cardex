import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import { CF_TABLES } from '../constants/tableNames';
import type { EPData } from '../components/ep/EPShared';

interface EpDatosRow {
  qac: string | null;
  qasc: string | null;
  hfac: string | null;
  hfacs: string | null;
  hfotros: string | null;
  pred: string | null;
  pmin: string | null;
  pmax: string | null;
  zbomba: string | null;
  ztop: string | null;
  zcis: string | null;
  hfcis: string | null;
  nt: string | null;
  nr: string | null;
  etab: string | null;
  etam: string | null;
  fs: string | null;
  ciclos: string | null;
  alfa: string | null;
  vsuc: string | null;
  vimp: string | null;
  dnsuc: string | null;
  dnimp: string | null;
  pcomercial: string | null;
  modo: 'red' | 'cisterna' | null;
  dot_l: string | null;
  n_usuarios: string | null;
  dias_aut: string | null;
  bci_l: string | null;
  patm: string | null;
  pv: string | null;
  npshr: string | null;
}

const FIELD_MAP: Record<keyof EPData, keyof EpDatosRow> = {
  qac: 'qac',
  qasc: 'qasc',
  hfac: 'hfac',
  hfacs: 'hfacs',
  hfotros: 'hfotros',
  pred: 'pred',
  pmin: 'pmin',
  pmax: 'pmax',
  zbomba: 'zbomba',
  ztop: 'ztop',
  zcis: 'zcis',
  hfcis: 'hfcis',
  nt: 'nt',
  nr: 'nr',
  etab: 'etab',
  etam: 'etam',
  fs: 'fs',
  ciclos: 'ciclos',
  alfa: 'alfa',
  vsuc: 'vsuc',
  vimp: 'vimp',
  dnsuc: 'dnsuc',
  dnimp: 'dnimp',
  pcomercial: 'pcomercial',
  modo: 'modo',
  dotL: 'dot_l',
  nUsuarios: 'n_usuarios',
  diasAut: 'dias_aut',
  bciL: 'bci_l',
  patm: 'patm',
  pv: 'pv',
  npshr: 'npshr',
};

/**
 * Carga los datos del equipo de presión (ep_datos_proyecto, 1:1 con el proyecto).
 * Devuelve null cuando la fila no existe aún — el llamador decide usar defaults.
 */
export async function loadEpDatos(proyectoId: string): Promise<EPData | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.epDatos)
      .select(Object.values(FIELD_MAP).join(', '))
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('epService load:', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as unknown as EpDatosRow;
    return {
      qac: row.qac ?? '',
      qasc: row.qasc ?? '',
      hfac: row.hfac ?? '',
      hfacs: row.hfacs ?? '',
      hfotros: row.hfotros ?? '',
      pred: row.pred ?? '',
      pmin: row.pmin ?? '',
      pmax: row.pmax ?? '',
      zbomba: row.zbomba ?? '',
      ztop: row.ztop ?? '',
      zcis: row.zcis ?? '',
      hfcis: row.hfcis ?? '',
      nt: row.nt ?? '',
      nr: row.nr ?? '',
      etab: row.etab ?? '',
      etam: row.etam ?? '',
      fs: row.fs ?? '',
      ciclos: row.ciclos ?? '',
      alfa: row.alfa ?? '',
      vsuc: row.vsuc ?? '',
      vimp: row.vimp ?? '',
      dnsuc: row.dnsuc ?? '',
      dnimp: row.dnimp ?? '',
      pcomercial: row.pcomercial ?? '',
      modo: row.modo === 'cisterna' ? 'cisterna' : 'red',
      dotL: row.dot_l ?? '',
      nUsuarios: row.n_usuarios ?? '',
      diasAut: row.dias_aut ?? '',
      bciL: row.bci_l ?? '',
      patm: row.patm ?? '',
      pv: row.pv ?? '',
      npshr: row.npshr ?? '',
    };
  } catch (e) {
    devError('epService load exception:', e);
    return null;
  }
}

/**
 * Upsert parcial de ep_datos_proyecto vía RPC SECURITY DEFINER (1:1 con el proyecto, no toca
 * otras tablas). Lo usa PressureEquipmentDesign (debounced) como fuente de verdad; localStorage
 * ('ep') queda como caché en vivo. Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
export async function saveEpDatos(proyectoId: string, ep: EPData): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_ep_datos', {
      p_proyecto_id: proyectoId,
      p_datos: Object.fromEntries(
        Object.entries(FIELD_MAP).map(([k, col]) => [col, ep[k as keyof EPData]]),
      ),
    });
    if (error) devError('epService save rpc:', error.message);
  } catch (e) {
    devError('epService save exception:', e);
  }
}
