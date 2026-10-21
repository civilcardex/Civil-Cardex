import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/desarrolloError.ts';
import type { ApsItem, UdBaseItem } from '../context/AparatoContexto.tsx';
import { CF_TABLES } from '../constants/tablaNombres.ts';
import { getActiveProyectoId } from './almacenamientoServicio.ts';

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
/** El catálogo global de aparatos se identifica con `id` (clave primaria, el número único de la fila); las tablas ligadas a un proyecto usan `client_id`. */
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

/** Dueño (user_id) del proyecto activo: en proyectos de empresa el catálogo de aparatos
 *  es del dueño, no del miembro que lo abre — así todos editan la misma lista. null si
 *  no hay proyecto activo, la fila no es visible por las reglas de seguridad por fila
 *  (RLS = Row Level Security, permisos de Postgres fila por fila) o falla la consulta —
 *  el llamador cae a session.user.id. */
async function ownerProyectoActivo(): Promise<string | null> {
  const pid = getActiveProyectoId();
  if (!pid) return null;
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.proyectos)
      .select('user_id')
      // Tras el rename cf_proyectos (id=uuid), la PK numérica es proyecto_num.
      .eq('id', pid)
      .maybeSingle();
    if (error) {
      devError('apparatusService owner lookup:', error.message);
      return null;
    }
    return (data as { user_id: string } | null)?.user_id ?? null;
  } catch (e) {
    devError('apparatusService owner lookup exception:', e);
    return null;
  }
}

/** Trae tu catálogo de aparatos (los tuyos si ya los guardaste, si no el base). Sin fila usa los valores de fábrica. Ej: UD (Unidades de Desague) base + tus aparatos. */
export async function loadAparatosUsuario(): Promise<AparatosUsuarioData | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    // Owner del proyecto activo ANTES de leer: filtra el catálogo por el dueño — sin
    // esto un miembro de empresa y el dueño mezclaban snapshots de user_ids distintos
    // (con filtro propio a secas el miembro no veía el catálogo del proyecto abierto).
    const ownerId = await ownerProyectoActivo();

    const [userRes, udBaseRes] = await Promise.all([
      supabase
        .from(CF_TABLES.aparatosUsuario)
        .select('client_id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud')
        // Del OWNER del proyecto activo (propios sin proyecto activo): evita mezclar
        // filas de dueño y miembro en un mismo snapshot de catálogo.
        .eq('user_id', ownerId ?? session.user.id)
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

/** Guarda tu catálogo entero de un golpe (borra e inserta). Lanza si el guardado falla: el
 *  snapshot es destructivo, así que un fallo silencioso dejaba el catálogo con la fila
 *  anterior sin que el usuario se enterara. Ej: editas un inodoro y queda en tus filas propias. */
export async function saveAparatosUsuario(aps: ApsItem[]): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

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
    if (error) throw new Error(error.message);
  } catch (e) {
    devError('apparatusService save exception:', e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
