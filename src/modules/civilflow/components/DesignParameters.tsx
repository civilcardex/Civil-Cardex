import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { useApparatus, type ApsItem } from '../context/ApparatusContext';
import { NORM_COL, REDES_MAT, CAT_APS, CAT_GAS, APARATOS_DEF } from '../constants';
import { NumericInput } from './NumericInput';
import EditButton from './shared/EditButton';
const DesignParameters_S1: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const DesignParameters_S2: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'rgba(0,220,229,0.08)',
  border: 'none',
  borderTop: '1px solid rgba(0,220,229,0.25)',
  color: '#00dce5',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'all .15s',
};
const DesignParameters_S3: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--txt2)',
  border: 'none',
  padding: '2px 4px',
  background: 'transparent',
};

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
    matSel: (mats[r.id] && mats[r.id][0]?.val) || r.mat,
    prof: profs.find((p) => p.id === r.id)?.prof ?? r.prof,
  }));

  const getOpts = (r: RedMat) =>
    r.opts || (mats[r.id] && mats[r.id].length > 0 ? mats[r.id].map((o) => o.val) : [r.mat]);

  const setMatSel = (redId: string, newVal: string) => {
    setMats((prev) => {
      const list = prev[redId] || [];
      if (list.length === 0)
        return { ...prev, [redId]: [{ id: redId + '_' + Date.now(), val: newVal }] };
      return { ...prev, [redId]: [{ ...list[0], val: newVal }, ...list.slice(1)] };
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
    <div
      className="fu bd-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.05fr 1fr',
          gap: 10,
          flex: 1,
          minHeight: 0,
          alignItems: 'start',
        }}
      >
        <section
          className="card"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div
            className="card-h"
            style={{ padding: '6px 10px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
          >
            <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
              <img
                src="/iconos_civilflow/parametros_de_diseno/materiales_por_red.webp"
                alt="Materiales por red"
                width={20}
                height={20}
                style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 2 }}
                loading="lazy"
              />
              Materiales por red
            </h3>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-s" style={{ fontSize: 12 }}>
                {activeRedes.length} redes activas
              </span>
              <EditButton edit={isEditingMateriales} setEdit={setIsEditingMateriales} />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <caption style={DesignParameters_S1}>
                Materiales y profundidad de instalación por red
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 28, textAlign: 'center', padding: '4px 6px' }}>
                    #
                  </th>
                  <th scope="col" style={{ padding: '4px 8px' }}>
                    Red
                  </th>
                  <th scope="col" style={{ padding: '4px 8px', minWidth: 90 }}>
                    Tubería
                  </th>
                  <th scope="col" className="c" style={{ width: 130, padding: '4px 6px' }}>
                    Profundidad de instalación
                    <br />
                    con respecto a NPT (m)
                  </th>
                </tr>
              </thead>
              <tbody>
                {merged.map((r, ix) => {
                  const col = (NORM_COL as Record<string, string>)[r.id] || 'var(--txt2)';
                  const isLast = ix === merged.length - 1;
                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)',
                        borderBottom: isLast ? '2px solid var(--line)' : undefined,
                      }}
                    >
                      <td
                        style={{
                          textAlign: 'center',
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          color: 'var(--txt3)',
                          padding: '3px 6px',
                        }}
                      >
                        {ix + 1}
                      </td>
                      <td style={{ padding: '3px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: col,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500, fontSize: 12 }}>{r.lbl}</span>
                        </div>
                      </td>
                      <td style={{ padding: '3px 8px' }}>
                        {r.fixed ? (
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--txt)',
                            }}
                          >
                            {r.mat}
                          </span>
                        ) : (
                          <select
                            aria-label="Seleccionar material"
                            disabled={!isEditingMateriales}
                            style={{
                              ...DesignParameters_S3,
                              cursor: isEditingMateriales ? 'pointer' : 'default',
                              opacity: isEditingMateriales ? 1 : 0.7,
                            }}
                            value={r.matSel}
                            onChange={(e) => setMatSel(r.id, e.target.value)}
                          >
                            {getOpts(r).map((o: string, i: number) => (
                              <option
                                key={i}
                                value={o}
                                style={{
                                  fontFamily: 'var(--body)',
                                  fontWeight: 400,
                                  color: '#000',
                                  background: '#fff',
                                }}
                              >
                                {o}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <input
                          type="text"
                          disabled={!isEditingMateriales}
                          inputMode="decimal"
                          className="ni"
                          aria-label="Profundidad"
                          style={{
                            width: 65,
                            padding: '2px 4px',
                            fontSize: 12,
                            textAlign: 'center',
                            color: 'var(--txt)',
                            opacity: isEditingMateriales ? 1 : 0.7,
                          }}
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
            style={DesignParameters_S2}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,220,229,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,220,229,0.08)';
            }}
            title="Ver catálogo completo de materiales, diámetros y coeficientes"
          >
            <img
              src="/iconos_civilflow/parametros_de_diseno/catalogo_maestro.webp"
              alt="Catálogo maestro"
              width={18}
              height={18}
              style={{ width: 18, height: 18, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Catálogo maestro
          </button>
        </section>

        <section
          className="card"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <div
            className="card-h"
            style={{ padding: '6px 10px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
          >
            <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
              <img
                src="/iconos_civilflow/parametros_de_diseno/catalogo_aparatos_sanitarios.webp"
                alt="Catálogo de aparatos sanitarios"
                width={20}
                height={20}
                style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 2 }}
                loading="lazy"
              />
              Catálogo de aparatos sanitarios
            </h3>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-s" style={{ fontSize: 12 }}>
                Unidades de consumo/Unidades de descarga editables
              </span>
              <EditButton edit={isEditingAparatos} setEdit={setIsEditingAparatos} />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ padding: '4px 8px' }}>
                    Aparato
                  </th>
                  <th scope="col" style={{ width: 60, padding: '4px 6px' }}>
                    Sigla
                  </th>
                  <th scope="col" style={{ width: 80, padding: '4px 6px' }}>
                    Tipo de Control
                  </th>
                  <th
                    scope="col"
                    className="c"
                    style={{
                      width: 55,
                      padding: '4px 4px',
                      background: 'rgba(27,110,243,.07)',
                      color: 'var(--acc2)',
                    }}
                  >
                    UC AF
                  </th>
                  <th
                    scope="col"
                    className="c"
                    style={{
                      width: 55,
                      padding: '4px 4px',
                      background: 'rgba(240,69,69,.07)',
                      color: '#F04545',
                    }}
                  >
                    UC AC
                  </th>
                  <th
                    scope="col"
                    className="c"
                    style={{
                      width: 55,
                      padding: '4px 4px',
                      background: 'rgba(245,166,35,.07)',
                      color: 'var(--san)',
                    }}
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
                      style={{
                        background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)',
                        borderBottom: isLavavajillas ? '2px solid var(--line)' : undefined,
                      }}
                    >
                      <td style={{ padding: '3px 8px', fontWeight: 500 }}>{a.n}</td>
                      <td style={{ padding: '3px 6px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--txt2)',
                            padding: '0',
                          }}
                        >
                          {a.s.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '3px 6px', fontSize: 12, color: 'var(--txt2)' }}>
                        {a.ctrl}
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <NumericInput
                          value={a.ucaf}
                          color="var(--acc2)"
                          decimals={1}
                          disabled={!isEditingAparatos || a._blkAf}
                          ariaLabel={`UC AF ${a.n}`}
                          onCommit={(v) => setApsVal(a.id, 'ucaf', v)}
                        />
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <NumericInput
                          value={a.ucac}
                          color="#F04545"
                          decimals={1}
                          disabled={!isEditingAparatos || a._blkAc}
                          ariaLabel={`UC AC ${a.n}`}
                          onCommit={(v) => setApsVal(a.id, 'ucac', v)}
                        />
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
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

        <section
          className="card"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <div className="card-h" style={{ padding: '6px 10px', flexShrink: 0 }}>
            <h3 className="card-t" style={{ fontSize: 13 }}>
              <img
                src="/iconos_civilflow/parametros_de_diseno/catalogo_gasodomesticos.webp"
                alt="Catálogo de gasodomésticos"
                width={20}
                height={20}
                style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 2 }}
                loading="lazy"
              />
              Catálogo de gasodomésticos
            </h3>
            <span className="card-s" style={{ fontSize: 12 }}>
              NTC 3728 · m³/hr
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ padding: '4px 8px' }}>
                    Aparato
                  </th>
                  <th scope="col" style={{ width: 88, padding: '4px 6px' }}>
                    Sigla
                  </th>
                  <th scope="col" style={{ width: 60, padding: '4px 6px' }}>
                    Tipo de Control
                  </th>
                  <th scope="col" className="c" style={{ width: 90, padding: '4px 6px' }}>
                    Consumo m³/hr
                  </th>
                </tr>
              </thead>
              <tbody>
                {CAT_GAS.map((g, ix) => (
                  <tr key={g.id} style={{ background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 500 }}>{g.n}</td>
                    <td style={{ padding: '3px 6px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--txt2)',
                          padding: '0',
                        }}
                      >
                        {g.s.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '3px 6px', fontSize: 12, color: 'var(--txt2)' }}>
                      Llave
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        padding: '3px 6px',
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--txt)',
                      }}
                    >
                      {g.q.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
