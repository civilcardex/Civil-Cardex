/** Página de parámetros de diseño por red (Base de Datos del área de trabajo): presiones de
 *  servicio, presiones de prueba y catálogos que alimentan las tablas de cada red.
 *  Ej: subir la presión mínima de rci (Red Contra Incendio) endurece el chequeo de todos sus tramos. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext.tsx';
import { useApparatus, type ApsItem } from '../context/ApparatusContext.tsx';
import { NORM_COL, REDES_MAT, CAT_APS, APARATOS_DEF } from '../constants';
import { GasCatalogCard } from './designParameters/GasCatalogCard.tsx';
import { fmt } from '../utils/formatUtils.ts';
import { LazyDecimalInput } from './shared/LazyDecimalInput.tsx';
import EditButton from './shared/EditButton.tsx';

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

interface RedMat {
  id: string;
  lbl: string;
  mat: string;
  prof: number;
  fixed?: boolean;
  opts?: string[];
}

export default function BaseDatos({ redes }: { redes: Set<string> }) {
  const navigate = useNavigate();
  const { mats, setMats, profs, setProfs } = useProject();
  const { aps, setAps } = useApparatus();
  const [profTexts, setProfTexts] = useState<Record<string, string>>({});

  const activeRedes = REDES_MAT.filter((r) => redes?.has(r.id));

  const matMap = Object.fromEntries(activeRedes.map((r: RedMat) => [r.id, r]));
  const merged = activeRedes.map((r) => ({
    ...r,
    // Ventilación comparte material/profundidad con sanitaria (decisión usuario): una fila
    // «Sanitaria/Ventilación» — el set de material abajo escribe ambas claves.
    lbl: r.id === 'san' ? 'Sanitaria/Ventilación' : r.lbl,
    matSel: (mats[r.id] && mats[r.id][0]?.val) || r.mat,
    prof: profs.find((p) => p.id === r.id)?.prof ?? r.prof,
  }));

  const getOpts = (r: RedMat) =>
    r.opts || (mats[r.id] && mats[r.id].length > 0 ? mats[r.id].map((o) => o.val) : [r.mat]);

  const setMatSel = (redId: string, newVal: string) => {
    setMats((prev) => {
      const apply = (m: typeof prev, rid: string) => {
        const list = m[rid] || [];
        return list.length === 0
          ? { ...m, [rid]: [{ id: rid + '_' + Date.now(), val: newVal }] }
          : { ...m, [rid]: [{ ...list[0], val: newVal }, ...list.slice(1)] };
      };
      // Sanitaria/Ventilación comparten material: san escribe también vent.
      const next = apply(prev, redId);
      return redId === 'san' ? apply(next, 'vent') : next;
    });
  };

  const setProf = (redId: string, v: number) => {
    setProfs((prev) => {
      const ix = prev.findIndex((p) => p.id === redId);
      if (ix < 0)
        return [
          ...prev,
          {
            id: redId,
            red: matMap[redId]?.lbl || redId,
            col: (NORM_COL as Record<string, string>)[redId] || 'var(--txt2)',
            prof: v,
            norma: '',
            nota: '',
          },
        ];
      return prev.map((p) => (p.id === redId ? { ...p, prof: v } : p));
    });
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
              <EditButton edit={isEditingMateriales} setEdit={setIsEditingMateriales} />
            </div>
          </div>
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
                {merged.map((r, ix) => {
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
                          <span className="dp-mono-600">{r.mat}</span>
                        ) : (
                          <select
                            aria-label="Seleccionar material"
                            disabled={!isEditingMateriales}
                            className="dp-ghost dp-fade"
                            value={r.matSel}
                            onChange={(e) => setMatSel(r.id, e.target.value)}
                          >
                            {getOpts(r).map((o: string, i: number) => (
                              <option key={i} value={o} className="dp-light">
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
                          aria-label="Profundidad"
                          data-editing={isEditingMateriales ? 'true' : 'false'}
                          value={
                            profTexts[r.id] !== undefined
                              ? profTexts[r.id]
                              : r.prof !== undefined && r.prof !== null
                                ? String(r.prof)
                                : '0'
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.');
                            const cleaned = raw.replace(/[^0-9.-]/g, '').replace(/(?!^)-/g, '');
                            setProfTexts((prev) => ({ ...prev, [r.id]: cleaned }));
                          }}
                          onFocus={(e) => {
                            setProfTexts((prev) => {
                              if (prev[r.id] !== undefined) return prev;
                              const cur =
                                r.prof !== undefined && r.prof !== null ? String(r.prof) : '0';
                              return { ...prev, [r.id]: cur };
                            });
                            e.target.select();
                          }}
                          onBlur={() => {
                            const v = profTexts[r.id];
                            if (v === undefined) return;
                            if (v === '' || v === '-') {
                              setProf(r.id, 0);
                            } else {
                              const n = parseFloat(v);
                              setProf(r.id, Number.isFinite(n) ? n : 0);
                            }
                            setProfTexts((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });
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
          <button
            type="button"
            onClick={() => navigate('/catalogomaestro')}
            className="dp-cta"
            title="Ver catálogo completo de materiales, diámetros y coeficientes"
          >
            <img
              src="/iconos_civilflow/parametros_de_diseno/catalogo_maestro.webp"
              alt="Catálogo maestro"
              width={18}
              height={18}
              className="dp-icon-18"
              loading="lazy"
            />{' '}
            Catálogo maestro
          </button>
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
              <span className="dp-fs12 card-s">
                Unidades de consumo/Unidades de descarga editables
              </span>
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
