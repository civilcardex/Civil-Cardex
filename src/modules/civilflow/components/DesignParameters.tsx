/** Página de parámetros de diseño por red (Base de Datos del área de trabajo): presiones de
 *  servicio, presiones de prueba y catálogos que alimentan las tablas de cada red.
 *  Ej: subir la presión mínima de rci (Red Contra Incendio) endurece el chequeo de todos sus tramos. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useProject } from '../context/ProjectContext.tsx';
import { useApparatus, type ApsItem } from '../context/ApparatusContext.tsx';
import { NORM_COL, REDES_MAT, CAT_APS, APARATOS_DEF } from '../constants';
import { materialInicialRed } from '../constants/defaults.ts';
import { GasCatalogCard } from './designParameters/GasCatalogCard.tsx';
import { fmt } from '../utils/formatUtils.ts';
import { LazyDecimalInput } from './shared/LazyDecimalInput.tsx';
import EditButton from './shared/EditButton.tsx';
import { getActiveProyectoId } from '../services/storageService.ts';
import { saveMaterialDeRed } from '../services/projectDataService.ts';

interface NumericInputProps {
  value: number;
  onCommit: (v: number) => void;
  decimals?: number;
  width?: number;
  disabled?: boolean;
  color?: string;
  inputStyle?: Record<string, unknown>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
}

function NumericInput({
  value,
  onCommit,
  decimals = 2,
  width = 52,
  disabled,
  color,
  inputStyle,
  onFocus,
  ariaLabel,
}: NumericInputProps) {
  if (disabled) {
    return (
      <span className="dp-disabled" style={{ width }}>
        {fmt(value || 0, decimals)}
      </span>
    );
  }

  return (
    <LazyDecimalInput
      value={fmt(value, decimals)}
      onCommit={(raw) => {
        const n = parseFloat(raw);
        onCommit(Number.isFinite(n) ? n : 0);
      }}
      ariaLabel={ariaLabel || (decimals === 0 ? 'Valor entero' : 'Valor numérico')}
      className="ni"
      style={{
        width,
        padding: '2px 4px',
        fontSize: 12,
        textAlign: 'center',
        color: color || 'var(--txt)',
        ...((inputStyle as React.CSSProperties) || {}),
      }}
      onFocus={onFocus}
      selectOnFocus
      commitOnEnter
    />
  );
}

export default function BaseDatos({ redes }: { redes: Set<string> }) {
  const { proy, setP, pisos, profs, setProfs } = useProject();
  const { aps, setAps } = useApparatus();
  const [profTexts, setProfTexts] = useState<Record<string, string>>({});
  const [materialDraft, setMaterialDraft] = useState<Record<string, string>>({});

  const activeRedes = REDES_MAT.filter(
    (r) => redes.has(r.id) || (r.id === 'san' && redes.has('vent')),
  );
  const merged = activeRedes.map((r) => ({
    ...r,
    // Ventilación comparte material/profundidad con sanitaria (decisión usuario): una fila
    // «Sanitaria/Ventilación» — el set de material abajo escribe ambas claves.
    lbl: r.id === 'san' ? 'Sanitaria/Ventilación' : r.lbl,
    matSel:
      materialDraft[r.id] ??
      materialInicialRed(r.id, String(proy[`mat_${r.id}` as keyof typeof proy] ?? '')),
    prof: profs.find((p) => p.id === r.id)?.prof ?? r.prof,
  }));

  const cotas = merged.map((r) => {
    const raw = profTexts[r.id]?.trim().replace(',', '.') ?? String(r.prof);
    return { ...r, valor: /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ? Number(raw) : NaN };
  });
  const duplicadas = new Map<number, string[]>();
  for (const c of cotas) {
    if (!Number.isFinite(c.valor)) continue;
    const cota = Number(c.valor.toFixed(2));
    duplicadas.set(cota, [...(duplicadas.get(cota) ?? []), c.lbl]);
  }
  const conflictos = [...duplicadas].filter(([, nombres]) => nombres.length > 1);
  const cotasInvalidas = cotas.some((c) => !Number.isFinite(c.valor));
  const confirmarCotas = () => {
    if (!isEditingMateriales) {
      setIsEditingMateriales(true);
      return;
    }
    if (cotasInvalidas || conflictos.length) return;
    const proyectoId = getActiveProyectoId();
    for (const [red, material] of Object.entries(materialDraft)) {
      setP(`mat_${red}`, material);
      if (proyectoId && pisos.length === 0) void saveMaterialDeRed(proyectoId, red, material);
    }
    if (Object.keys(profTexts).length) {
      setProfs((prev) => {
        const next = new Map(prev.map((p) => [p.id, p]));
        for (const c of cotas) {
          if (profTexts[c.id] === undefined) continue;
          next.set(c.id, {
            red: c.lbl,
            col: (NORM_COL as Record<string, string>)[c.id] || 'var(--txt2)',
            norma: '',
            nota: '',
            ...next.get(c.id),
            id: c.id,
            prof: Number(c.valor.toFixed(2)),
          });
        }
        return [...next.values()];
      });
    }
    setProfTexts({});
    setMaterialDraft({});
    setIsEditingMateriales(false);
  };

  const apsMap = Object.fromEntries(CAT_APS.map((a) => [a.id, a]));
  const udDefMap = new Map(APARATOS_DEF.map((d) => [d.id, d.ud]));
  const ACC_IDS = new Set(['codo90rm', 'yeeSimple', 'yeeDoble']);
  const apsMerged = CAT_APS.map((c) => {
    const cur = aps.find((a) => a.id === c.id);
    const isAcc = ACC_IDS.has(c.id);
    const defUd = udDefMap.get(c.id) ?? 0;
    return {
      ...c,
      // cur existe → su valor real (aunque sea 0); si no, el base. `||` aquí escondería un
      // 0 editado y mostraría el valor de catálogo, pareciendo que "no se guardó".
      ucaf: isAcc ? 0 : cur ? cur.ucaf : c.af,
      ucac: isAcc ? 0 : cur ? cur.ucac : c.ac,
      // Sin cur, mostrar el UD del catálogo base (def.ud) — el cálculo usa ese valor, así que
      // el display debe coincidir; mostrar 0 aquí decía "el inodoro no tiene UD" cuando el
      // cálculo sí las contaba.
      ud: cur ? cur.ud : defUd,
      _blkAf: isAcc || (c.af || 0) === 0,
      _blkAc: isAcc || (c.ac || 0) === 0,
      _blkUd: cur ? cur._blkUd : defUd === 0,
    };
  });

  const setApsVal = (id: string, key: string, v: number) => {
    setAps((prev) => {
      const ix = prev.findIndex((a) => a.id === id);
      if (ix < 0) {
        const def = apsMap[id];
        const defUd = udDefMap.get(id) ?? 0;
        return [
          ...prev,
          {
            id,
            s: def.s,
            n: def.n,
            g: 'h',
            ucaf: def.af,
            ucac: def.ac,
            // El item nuevo hereda el UD del catálogo base — antes se creaba con ud:0 y el
            // snapshot (borra-e-inserta) persistía el catálogo entero con UDs borradas (bug
            // "RS3 no propaga UCs": inodoro valía 0). El valor editado de `key` aplica después.
            ud: defUd,
            pmin: 0,
            pmax: 0,
            qg: 0,
            ctrl: def.ctrl,
            // _blkUd es obligatorio para el insert (blk_ud NOT NULL en aparatos_usuario):
            // sin él, saveAparatosUsuario falla con constraint violation y la BD queda vacía.
            _blkUd: defUd === 0,
            [key]: v,
          } as unknown as ApsItem,
        ];
      }
      return prev.map((a) => (a.id === id ? { ...a, [key]: v } : a));
    });
  };

  const [isEditingMateriales, setIsEditingMateriales] = useState(false);
  const [isEditingAparatos, setIsEditingAparatos] = useState(false);

  return (
    <div className="dp-col-10 fu bd-section" data-tour="cf-tab-datos">
      <div className="dp-grid-3">
        <section className="card dp-col-cut" data-tour="datos-materiales">
          <div className="dp-head-pad card-h">
            <h3 className="dp-fs13-flex card-t">
              <img
                src="/iconos_civilflow/parametros_de_diseno/materiales_por_red.webp"
                alt="Materiales por red"
                width={20}
                height={20}
                className="dp-icon-20"
                loading="lazy"
              />
              Materiales por red
            </h3>
            <div className="dp-row-auto">
              <span className="dp-fs12 card-s">{activeRedes.length} redes activas</span>
              <EditButton edit={isEditingMateriales} setEdit={confirmarCotas} />
            </div>
          </div>
          {(conflictos.length > 0 || cotasInvalidas) && (
            <p id="cf-depth-error" role="alert" className="cf-form-error cf-depth-error">
              {cotasInvalidas ? 'Ingresa una cota válida en cada red. ' : ''}
              {conflictos
                .map(([cota, nombres]) => `${nombres.join(' y ')} coinciden en ${fmt(cota, 2)} m.`)
                .join(' ')}
            </p>
          )}
          <div className="dp-scroll-xy">
            <table className="dp-fs12 tbl">
              <caption className="sr-only">Materiales y profundidad de instalación por red</caption>
              <thead>
                <tr>
                  <th title="Consecutivo de la red." scope="col" className="dp-sel-28">
                    #
                  </th>
                  <th
                    title="Red a la que aplica la configuración."
                    scope="col"
                    className="dp-pad-8"
                  >
                    Red
                  </th>
                  <th
                    title="Material de tubería por defecto de la red."
                    scope="col"
                    className="dp-w-90"
                  >
                    Tubería
                  </th>
                  <th
                    title="Profundidad de instalación respecto al nivel de piso terminado (m)."
                    scope="col"
                    className="c dp-w-130"
                  >
                    Profundidad de instalación
                    <br />
                    con respecto a NPT (m)
                  </th>
                </tr>
              </thead>
              <tbody>
                {cotas.map((r, ix) => {
                  const isLast = ix === merged.length - 1;
                  return (
                    <tr
                      key={r.id}
                      className={
                        ix % 2 === 0
                          ? 'dp-row-alt' + (isLast ? ' dp-row-last' : '')
                          : 'dp-row-alt2' + (isLast ? ' dp-row-last' : '')
                      }
                    >
                      <td className="dp-cm-center">{ix + 1}</td>
                      <td className="dp-pad-3x">
                        <span className="dp-fs12-medium">{r.lbl}</span>
                      </td>
                      <td className="dp-pad-3x">
                        {r.fixed ? (
                          <span className="dp-mat-fixed">
                            {r.id !== 'san'
                              ? r.mat
                              : redes.has('vent')
                                ? redes.has('san')
                                  ? 'PVC-S / PVC-V'
                                  : 'PVC-V'
                                : r.mat}
                          </span>
                        ) : (
                          <select
                            aria-label={`Material de ${r.lbl}`}
                            disabled={!isEditingMateriales}
                            className="dp-ghost dp-fade"
                            value={r.matSel}
                            onChange={(e) => {
                              const material = e.target.value;
                              setMaterialDraft((prev) => ({ ...prev, [r.id]: material }));
                            }}
                          >
                            <option value="" disabled>
                              Selecciona un material
                            </option>
                            {r.opts?.map((o) => (
                              <option key={o} value={o} className="dp-light">
                                {o}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="dp-sel-center">
                        <input
                          type="text"
                          disabled={!isEditingMateriales}
                          inputMode="decimal"
                          className="ni dp-w65 dp-fade"
                          aria-label={`Profundidad de ${r.lbl}`}
                          aria-invalid={
                            !Number.isFinite(r.valor) ||
                            (duplicadas.get(Number(r.valor.toFixed(2)))?.length ?? 0) > 1
                          }
                          aria-describedby={
                            !Number.isFinite(r.valor) ||
                            (duplicadas.get(Number(r.valor.toFixed(2)))?.length ?? 0) > 1
                              ? 'cf-depth-error'
                              : undefined
                          }
                          data-editing={isEditingMateriales ? 'true' : 'false'}
                          value={
                            profTexts[r.id] !== undefined ? profTexts[r.id] : r.prof.toFixed(2)
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            setProfTexts((prev) => ({ ...prev, [r.id]: raw }));
                          }}
                          onFocus={(e) => {
                            e.target.select();
                          }}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Link to="/catalogomaestro" className="dp-cta">
            <img
              src="/iconos_civilflow/parametros_de_diseno/catalogo_maestro.webp"
              alt=""
              width={18}
              height={18}
              className="dp-icon-18"
              loading="lazy"
            />
            Catálogo maestro
          </Link>
        </section>

        <section className="card dp-col-cut0" data-tour="datos-aparatos">
          <div className="dp-head-pad card-h">
            <h3 className="dp-fs13-flex card-t">
              <img
                src="/iconos_civilflow/parametros_de_diseno/catalogo_aparatos_sanitarios.webp"
                alt="Catálogo de aparatos sanitarios"
                width={20}
                height={20}
                className="dp-icon-20"
                loading="lazy"
              />
              Catálogo de aparatos sanitarios
            </h3>
            <div className="dp-row-auto">
              <EditButton edit={isEditingAparatos} setEdit={setIsEditingAparatos} />
            </div>
          </div>
          <div className="dp-scroll-xy">
            <table className="dp-fs12 tbl">
              <thead>
                <tr>
                  <th title="Aparato sanitario del proyecto." scope="col" className="dp-pad-8">
                    Aparato
                  </th>
                  <th
                    title="Sigla con la que se identifica el aparato."
                    scope="col"
                    className="dp-w-60"
                  >
                    Sigla
                  </th>
                  <th
                    title="Tipo de control del aparato (llave, fluxómetro)."
                    scope="col"
                    className="dp-w-80"
                  >
                    Tipo de Control
                  </th>
                  <th
                    title="Unidades de consumo en agua fría."
                    scope="col"
                    className="c dp-input-blue"
                  >
                    UC AF
                  </th>
                  <th
                    title="Unidades de consumo en agua caliente."
                    scope="col"
                    className="c dp-input-red"
                  >
                    UC AC
                  </th>
                  <th
                    title="Unidades de descarga en la red sanitaria."
                    scope="col"
                    className="c dp-input-amber"
                  >
                    UD RS
                  </th>
                </tr>
              </thead>
              <tbody>
                {apsMerged.map((a, ix) => {
                  const isLavavajillas = a.id === 'lavav';
                  return (
                    <tr
                      key={a.id}
                      className={
                        ix % 2 === 0
                          ? 'dp-row-alt' + (isLavavajillas ? ' dp-row-last' : '')
                          : 'dp-row-alt2' + (isLavavajillas ? ' dp-row-last' : '')
                      }
                    >
                      <td className="dp-pad-3x-500">{a.n}</td>
                      <td className="dp-pad-6">
                        <span className="dp-mono-pad0">{a.s.toUpperCase()}</span>
                      </td>
                      <td className="dp-fs12-dim">{a.ctrl}</td>
                      <td className="dp-sel-center">
                        <NumericInput
                          value={a.ucaf}
                          color="var(--acc2)"
                          decimals={1}
                          disabled={!isEditingAparatos || a._blkAf}
                          ariaLabel={`UC AF ${a.n}`}
                          onCommit={(v) => setApsVal(a.id, 'ucaf', v)}
                        />
                      </td>
                      <td className="dp-sel-center">
                        <NumericInput
                          value={a.ucac}
                          color="#F04545"
                          decimals={1}
                          disabled={!isEditingAparatos || a._blkAc}
                          ariaLabel={`UC AC ${a.n}`}
                          onCommit={(v) => setApsVal(a.id, 'ucac', v)}
                        />
                      </td>
                      <td className="dp-sel-center">
                        <NumericInput
                          value={a.ud ?? 0}
                          color="var(--san)"
                          decimals={0}
                          disabled={!isEditingAparatos || a._blkUd}
                          ariaLabel={`UD ${a.n}`}
                          onCommit={(v) => setApsVal(a.id, 'ud', v)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <GasCatalogCard />
      </div>
    </div>
  );
}
