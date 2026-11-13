import { useCivilManager } from '../context.tsx';
import { fmtMoneda } from '../calc.ts';
import { ApuSeccionMO } from './ApuSectionLabor.tsx';
import { ApuSeccionEquipo } from './ApuSectionEquipment.tsx';
import { ApuSeccionInsumos } from './ApuSectionSupplies.tsx';
import { ApuSeccionTransporte } from './ApuSectionTransport.tsx';
import type { Apu } from '../types.ts';

interface Props {
  apu: Apu;
  onUpdate: (patch: Partial<Apu>) => void;
}

/** Formulario de UN APU (Análisis de Precios Unitarios): cabecera (código, nombre, unidad, es_basico) + sus 4 secciones de recursos. Ej: marcar es_basico lo vuelve reutilizable como insumo 'Preparado en obra'. */
export function ApuEditor({ apu, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();
  const calc = apuCalcMap.get(apu.id);

  return (
    <div>
      <div className="cm-xl-wrap cm-apu-head">
        <span className="cm-apu-code">{apu.codigo}</span>
        <input
          className="cm-ni cm-ni-w260"
          value={apu.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
          aria-label="Nombre del APU"
        />
        <select
          className="cm-sel"
          value={apu.categoria}
          onChange={(e) => onUpdate({ categoria: e.target.value })}
          aria-label="Categoría"
        >
          {state.categorias_apu.map((c) => (
            <option key={c.codigo} value={c.categoria}>
              {c.categoria}
            </option>
          ))}
        </select>
        <select
          className="cm-sel"
          value={apu.unidad}
          onChange={(e) => onUpdate({ unidad: e.target.value })}
          aria-label="Unidad"
        >
          {state.config_listas.unidades.map((u) => (
            <option key={u.abreviatura} value={u.abreviatura}>
              {u.abreviatura}
            </option>
          ))}
        </select>
        <label className="cm-apu-check">
          <input
            type="checkbox"
            checked={apu.es_basico}
            onChange={(e) => onUpdate({ es_basico: e.target.checked })}
          />
          APU básico (preparado en obra)
        </label>
        <span className="cm-flex-1" />
        <span className="cm-apu-total-line">
          Costo unitario: <span className="cm-acc">{fmtMoneda(calc?.totalDirecto ?? 0)}</span>
        </span>
      </div>

      <ApuSeccionMO apu={apu} onChange={(recursos_mo) => onUpdate({ recursos_mo })} />
      <ApuSeccionEquipo apu={apu} onChange={(recursos_eq) => onUpdate({ recursos_eq })} />
      <ApuSeccionInsumos apu={apu} onChange={(recursos_ins) => onUpdate({ recursos_ins })} />
      <ApuSeccionTransporte
        apu={apu}
        onChange={(recursos_transporte) => onUpdate({ recursos_transporte })}
      />

      {calc && (
        <div className="cm-xl-wrap cm-apu-summary">
          <div className="cm-apu-grid">
            <div>
              Mano de obra: <b>{fmtMoneda(calc.subMO)}</b>
            </div>
            <div>
              Herramienta menor: <b>{fmtMoneda(calc.herr)}</b>
            </div>
            <div>
              Prestaciones: <b>{fmtMoneda(calc.vrPrest)}</b>
            </div>
            <div>
              Equipo: <b>{fmtMoneda(calc.subEq)}</b>
            </div>
            <div>
              Insumos: <b>{fmtMoneda(calc.subIns)}</b>
            </div>
            <div>
              Transporte: <b>{fmtMoneda(calc.subTrans)}</b>
            </div>
            <div className="cm-apu-total-cell">
              Total directo: <span className="cm-acc">{fmtMoneda(calc.totalDirecto)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
