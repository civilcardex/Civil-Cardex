/**
 * SOLO DESARROLLO — preview de /empresa con datos falsos (borrar con el route).
 * Renderiza PanelSuscripcion con dos suscripciones mock y los miembros viajan por el
 * prop `mock` (sin tocar Supabase: ni mis_miembros ni RPCs de escritura).
 */
import { usePageMeta } from '../hooks/usePageMeta';
import { PanelSuscripcion } from './CompanyPage';
import type { SuscripcionRow } from '../lib/subscriptions/subscriptionsService';

const MIEMBROS_FLOW = [
  { user_id: 'u1', email: 'ana@constructora.com', puede_editar: true, asignado_en: '' },
  { user_id: 'u2', email: 'luis@constructora.com', puede_editar: false, asignado_en: '' },
  { user_id: 'u3', email: 'maria@constructora.com', puede_editar: true, asignado_en: '' },
];

const MIEMBROS_MANAGE = [
  { user_id: 'u4', email: 'jefe@obra.com', puede_editar: true, asignado_en: '' },
];

const SUS_FALSAS: (SuscripcionRow & { mock: { miembros: typeof MIEMBROS_FLOW } })[] = [
  {
    id: 1,
    modulo: 'flow',
    periodo: 'anual',
    estado: 'activa',
    fecha_fin: new Date(Date.now() + 86400000 * 300).toISOString(),
    puestos: 5,
    user_id: 'yo',
    mock: { miembros: MIEMBROS_FLOW },
  },
  {
    id: 2,
    modulo: 'manage',
    periodo: 'semestral',
    estado: 'activa',
    fecha_fin: new Date(Date.now() + 86400000 * 120).toISOString(),
    puestos: 2,
    user_id: 'yo',
    mock: { miembros: MIEMBROS_MANAGE },
  },
];

export default function CompanyPreviewPage() {
  usePageMeta('Equipo (preview)', 'Preview de la página de empresa con datos de prueba.');
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
        {SUS_FALSAS.map(({ mock, ...sus }) => (
          <PanelSuscripcion key={sus.id} sus={sus} soloLectura mock={mock} />
        ))}
      </div>
    </div>
  );
}
