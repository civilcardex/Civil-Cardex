/**
 * SOLO DESARROLLO — preview de /empresa con datos falsos (borrar con el route).
 * Renderiza PanelSuscripcion con dos suscripciones mock y mockea la RPC
 * mis_miembros SOLO mientras el preview está montado (cleanup restaura el rpc real).
 */
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePageMeta } from '../hooks/usePageMeta';
import { PanelSuscripcion } from './CompanyPage';
import type { SuscripcionRow } from '../lib/subscriptions/subscriptionsService';

// Mock local de mis_miembros: el objeto de supabase es module-scoped en su propio
// módulo, así que parcheamos la lectura SOLO durante el montaje del preview
// (parche module-scope persistía tras desmontar y envenenaba /empresa real).
type RpcArgs = { p_suscripcion_id: number };
const MIEMBROS_FALSOS: Record<
  number,
  { user_id: string; email: string; puede_editar: boolean; asignado_en: string }[]
> = {
  1: [
    {
      user_id: 'u1',
      email: 'ana@constructora.com',
      puede_editar: true,
      asignado_en: new Date().toISOString(),
    },
    {
      user_id: 'u2',
      email: 'luis@constructora.com',
      puede_editar: false,
      asignado_en: new Date().toISOString(),
    },
    {
      user_id: 'u3',
      email: 'maria@constructora.com',
      puede_editar: true,
      asignado_en: new Date().toISOString(),
    },
  ],
  2: [
    {
      user_id: 'u4',
      email: 'jefe@obra.com',
      puede_editar: true,
      asignado_en: new Date().toISOString(),
    },
  ],
};

const SUS_FALSAS: SuscripcionRow[] = [
  {
    id: 1,
    modulo: 'flow',
    periodo: 'anual',
    estado: 'activa',
    fecha_fin: new Date(Date.now() + 86400000 * 300).toISOString(),
    puestos: 5,
    user_id: 'yo',
  },
  {
    id: 2,
    modulo: 'manage',
    periodo: 'semestral',
    estado: 'activa',
    fecha_fin: new Date(Date.now() + 86400000 * 120).toISOString(),
    puestos: 2,
    user_id: 'yo',
  },
];

export default function CompanyPreviewPage() {
  usePageMeta('Equipo (preview)', 'Preview de la página de empresa con datos de prueba.');
  // Parche con restauración: captura el rpc original al montar y lo devuelve al
  // desmontar — compatible con StrictMode (monta/desmonta/monta) porque cada
  // ciclo re-captura el valor ya restaurado.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supa = supabase as any;
    const rpcOriginal: unknown = supa.rpc;
    supa.rpc = (fn: string, args?: RpcArgs) => {
      if (fn === 'mis_miembros') {
        return Promise.resolve({
          data: MIEMBROS_FALSOS[args?.p_suscripcion_id ?? 0] ?? [],
          error: null,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (rpcOriginal as any).call(supabase, fn, args);
    };
    return () => {
      supa.rpc = rpcOriginal;
    };
  }, []);
  return (
    <div className="container mx-auto px-6 py-10" style={{ maxWidth: 860 }}>
      <div
        style={{
          border: '1px dashed #e8c84a',
          borderRadius: 8,
          padding: '6px 12px',
          marginBottom: 16,
          fontSize: 12,
          color: '#e8c84a',
        }}
      >
        PREVIEW con datos falsos — ruta temporal de desarrollo.
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Equipo</h1>
      <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', marginBottom: 24 }}>
        Asigna puestos de tus planes empresariales por correo (el miembro debe tener cuenta
        registrada) y define quién puede editar los proyectos de la empresa.
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        {SUS_FALSAS.map((sus) => (
          <PanelSuscripcion key={sus.id} sus={sus} soloLectura />
        ))}
      </div>
    </div>
  );
}
