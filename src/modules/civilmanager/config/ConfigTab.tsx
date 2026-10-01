import { useState } from 'react';
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
  { id: 'factor_prestacional', label: 'Factor Prestacional' },
  { id: 'perfil_pais', label: 'Perfil de País' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'categorias_insumo', label: 'Categorías Insumo' },
  { id: 'categorias_apu', label: 'Categorías APU' },
  { id: 'tipos_equipo', label: 'Tipos de Equipo' },
  { id: 'origenes', label: 'Orígenes' },
  { id: 'unidades_transporte', label: 'Unid. Transporte' },
];

export function ConfigTab() {
  const [sub, setSub] = useState<ConfigSub>('parametros');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`cm-btn ${sub === s.id ? 'cm-btn-primary' : ''}`}
            onClick={() => setSub(s.id)}
            aria-current={sub === s.id ? 'true' : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
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
  );
}
