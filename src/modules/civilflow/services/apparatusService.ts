import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import type { ApsItem, UdBaseItem } from '../context/ApparatusContext';
import { CF_TABLES } from '../constants/tableNames';

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
        .from(CF_TABLES.aparatosUsuario)
        .select('client_id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud')
        .eq('user_id', user.id)
        .order('id'),
      supabase.from(CF_TABLES.aparatosUdBase).select('id, nombre, ud'),
    ]);
    if (userRes.error) throw userRes.error;
    if (udBaseRes.error) throw udBaseRes.error;

    let rows: AparatoUsuarioRow[] = (userRes.data ?? []) as AparatoUsuarioRow[];
    if (rows.length === 0) {
      const { data: base, error: baseError } = await supabase
        .from(CF_TABLES.aparatosCatalogo)
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
    } else {
      // Snapshot parcial: el snapshot por-usuario es COMPLETO por diseño (saveAparatosUsuario
      // borra-e-inserta todo el catálogo). Si la BD tiene menos filas que el catálogo global,
      // es un snapshot corrupto de una versión vieja (bug en setApsVal creaba items con ud:0 y
      // el guardado borraba el resto). Rellenar los faltantes con el catálogo global para no
      // perder aparatos cuyo valor el usuario nunca tocó — el siguiente guardado del usuario
      // persiste el snapshot completo y la BD queda sana.
      const { data: base, error: baseError } = await supabase
        .from(CF_TABLES.aparatosCatalogo)
        .select('id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud');
      if (baseError) throw baseError;
      if (base && base.length > 0) {
        const ownIds = new Set(rows.map((r) => r.client_id));
        for (const r of base as CatalogoGlobalRow[]) {
          if (ownIds.has(r.id)) continue;
          rows.push({
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
          });
        }
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
 * Persiste el snapshot completo del catálogo del usuario (borra-e-inserta por usuario vía RPC
 * SECURITY DEFINER, misma semántica de snapshot que saveProyectoCoreData). Fire-and-forget
 * desde la UI; el catálogo base se copia a filas propias en cuanto el usuario lo modifica. Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
export async function saveAparatosUsuario(aps: ApsItem[]): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_aparatos_usuario', {
      p_aps: aps.map((a) => ({
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
    });
    if (error) devError('apparatusService save rpc:', error.message);
  } catch (e) {
    devError('apparatusService save exception:', e);
  }
}
