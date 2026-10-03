import { useState } from 'react';
import { EditableSection } from '../shared/EditLock';
import { UnidadesPanel } from './UnitsPanel';
import { CategoriasInsumoPanel } from './CategoriesInsumoPanel';
import { CategoriasApuPanel } from './CategoriesApuPanel';
import { TiposEquipoPanel } from './TypesEquipmentPanel';
import { OrigenesPanel } from './OriginsPanel';
import { UnidadesTransportePanel } from './UnitsTransportPanel';
import { ParametrosApuPanel } from './ParametersApuPanel';
import { PerfilPaisPanel } from './ProfileCountryPanel';
import { FactorPrestacionalPanel } from './FactorBenefitPanel';

type ConfigSub =
  | 'parametros'
  | 'factor_prestacional'
  | 'perfil_pais'
  | 'unidades'
  | 'categorias_insumo'
  | 'categorias_apu'
  | 'tipos_equipo'
  | 'origenes'
  | 'unidades_transporte';

const SUBS: { id: ConfigSub; label: string }[] = [
  { id: 'parametros', label: 'Parámetros APU' },
  { id: 'factor_prestacional', label: 'Factor prestacional' },
  { id: 'perfil_pais', label: 'Perfil de país' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'categorias_insumo', label: 'Categorías insumo' },
  { id: 'categorias_apu', label: 'Categorías APU' },
  { id: 'tipos_equipo', label: 'Tipos de equipo' },
  { id: 'origenes', label: 'Orígenes' },
  { id: 'unidades_transporte', label: 'Unidades de transporte' },
];

// Sidebar vertical de sub-pestañas a la izquierda + panel a su derecha (orig. usuario):
// EDITAR/LISTO arriba a la derecha de la tabla; solo el panel se opaca en lectura.
export function ConfigTab() {
  const [sub, setSub] = useState<ConfigSub>('parametros');

  return (
    <EditableSection dim={false}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <nav
          aria-label="Configuración"
          style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {SUBS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cm-btn ${sub === s.id ? 'cm-btn-primary' : ''}`}
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                padding: '9px 12px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
              onClick={() => setSub(s.id)}
              aria-current={sub === s.id ? 'true' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>
          {sub === 'parametros' && <ParametrosApuPanel />}
          {sub === 'factor_prestacional' && <FactorPrestacionalPanel />}
          {sub === 'perfil_pais' && <PerfilPaisPanel />}
          {sub === 'unidades' && <UnidadesPanel />}
          {sub === 'categorias_insumo' && <CategoriasInsumoPanel />}
          {sub === 'categorias_apu' && <CategoriasApuPanel />}
          {sub === 'tipos_equipo' && <TiposEquipoPanel />}
          {sub === 'origenes' && <OrigenesPanel />}
          {sub === 'unidades_transporte' && <UnidadesTransportePanel />}
        </div>
      </div>
    </EditableSection>
  );
}
