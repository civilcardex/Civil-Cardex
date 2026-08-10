import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import type { ApsItem, UdBaseItem } from '../context/ApparatusContext';

export interface AparatosUsuarioData {
  udBase: UdBaseItem[];
  aps: ApsItem[];
}

interface AparatoUsuarioRow {
  client_id: string;
  s: string | null;
  n: string | null;
  g: string | null;
  ucaf: number | null;
  ucac: number | null;
  ud: number | null;
  pmin: number | null;
  pmax: number | null;
  qg: number | null;
  ctrl: string | null;
  blk_ud: boolean;
}
interface UdBaseGlobalRow {
  id: string;
  nombre: string;
  ud: number;
}
/** aparatos_catalogo_global usa `id` como PK (no client_id, como las tablas proyecto-scoped). */
interface CatalogoGlobalRow {
  id: string;
  s: string | null;
  n: string | null;
  g: string | null;
  ucaf: number | null;
  ucac: number | null;
  ud: number | null;
  pmin: number | null;
  pmax: number | null;
  qg: number | null;
  ctrl: string | null;
  blk_ud: boolean;
}

/**
 * Carga el catálogo de aparatos del usuario: filas propias de aparatos_usuario si existen,
 * o el catálogo base (aparatos_catalogo_global) cuando el usuario aún no tiene filas.
 * udBase viene de aparatos_ud_base_global. Ante fallo devuelve null (el llamador mantiene
 * sus constantes/fallbacks locales).
 */
export async function loadAparatosUsuario(): Promise<AparatosUsuarioData | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [userRes, udBaseRes] = await Promise.all([
      supabase
        .from('aparatos_usuario')
        .select('client_id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud')
        .eq('user_id', user.id)
        .order('id'),
      supabase.from('aparatos_ud_base_global').select('id, nombre, ud'),
    ]);
    if (userRes.error) throw userRes.error;
    if (udBaseRes.error) throw udBaseRes.error;

    let rows: AparatoUsuarioRow[] = (userRes.data ?? []) as AparatoUsuarioRow[];
    if (rows.length === 0) {
      const { data: base, error: baseError } = await supabase
        .from('aparatos_catalogo_global')
        .select('id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud');
      if (baseError) throw baseError;
      if (base && base.length > 0) {
        rows = (base as CatalogoGlobalRow[]).map((r) => ({
          client_id: r.id,
          s: r.s,
          n: r.n,
          g: r.g,
          ucaf: r.ucaf,
          ucac: r.ucac,
          ud: r.ud,
          pmin: r.pmin,
          pmax: r.pmax,
          qg: r.qg,
          ctrl: r.ctrl,
          blk_ud: r.blk_ud,
        }));
      }
    }

    const aps: ApsItem[] = rows.map((r) => ({
      id: r.client_id,
      s: r.s ?? '',
      n: r.n ?? '',
      g: r.g ?? '',
      ucaf: r.ucaf ?? 0,
      ucac: r.ucac ?? 0,
      ud: r.ud ?? 0,
      pmin: r.pmin ?? 0,
      pmax: r.pmax ?? 0,
      qg: r.qg ?? 0,
      ctrl: r.ctrl ?? '',
      _blkUd: r.blk_ud ?? false,
    }));

    const udBase: UdBaseItem[] = ((udBaseRes.data ?? []) as UdBaseGlobalRow[]).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      ud: r.ud,
    }));

    return { udBase, aps };
  } catch (e) {
    devError('apparatusService load:', e);
    return null;
  }
}

/**
 * Persiste el snapshot completo del catálogo del usuario (borra-e-inserta por usuario, misma
 * semántica de snapshot que saveProyectoCoreData). Fire-and-forget desde la UI; el catálogo
 * base se copia a filas propias en cuanto el usuario lo modifica.
 */
export async function saveAparatosUsuario(aps: ApsItem[]): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: delError } = await supabase
      .from('aparatos_usuario')
      .delete()
      .eq('user_id', user.id);
    if (delError) throw delError;

    if (aps.length > 0) {
      const { error: insError } = await supabase.from('aparatos_usuario').insert(
        aps.map((a) => ({
          user_id: user.id,
          client_id: a.id,
          s: a.s,
          n: a.n,
          g: a.g,
          ucaf: a.ucaf,
          ucac: a.ucac,
          ud: a.ud,
          pmin: a.pmin,
          pmax: a.pmax,
          qg: a.qg,
          ctrl: a.ctrl,
          // Coerción defensiva: blk_ud es NOT NULL — un campo faltante (ítem creado por
          // setApsVal sin _blkUd) tumbaría el INSERT completo del snapshot y vaciaría la BD.
          blk_ud: !!a._blkUd,
        })),
      );
      if (insError) throw insError;
    }
  } catch (e) {
    devError('apparatusService save:', e);
  }
}
