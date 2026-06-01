import { useState } from "react";
import { useSanitario } from "../context/SanitarioContext";
import { MAT_COL } from "./constants";

const REDES_MAT = [
  { id: 'san', lbl: 'Sanitaria',        mat: 'PVC-S',                       prof: -0.70, fixed: true },
  { id: 'll',  lbl: 'Aguas Lluvias',    mat: 'PVC-S',                       prof: -0.50, fixed: true },
  { id: 'ven', lbl: 'Ventilación',      mat: 'PVC-V',                       prof:  0.00, fixed: true },
  { id: 'af',  lbl: 'Agua Fría',        mat: 'PVC-PR',                      prof:  0.00, fixed: true },
  { id: 'ac',  lbl: 'Agua Caliente',    mat: 'CPVC',                        prof: -0.10, fixed: true },
  { id: 'rci', lbl: 'Contra Incendio',  mat: 'A.C. SCH 40',      prof: -0.45,
    opts: ['A.C. SCH 10', 'A.C. SCH 40', 'PVC C900 RDE 14', 'PVC C900 RDE 18', 'Acero HG'] },
  { id: 'gas', lbl: 'Gas',              mat: 'PE al PE',                    prof: -0.15,
    opts: ['Acero HG', 'A.C.', 'Cobre Rígido', 'Cobre Flexible', 'PE al PE', 'PEAD'] },
];

const CAT_APS = [
  { id: 'san',  n: 'Sanitario con tanque',     s: 'San',  ctrl: 'Tanque',              af: 2.2, ac: 0  },
  { id: 'lvm',  n: 'Lavamanos',              s: 'Lvm',  ctrl: 'Llave',               af: 0.5, ac: 0.5},
  { id: 'duc',  n: 'Ducha',                  s: 'Duc',  ctrl: 'Válvula de mezclado', af: 1.0, ac: 1.0},
  { id: 'lvp',  n: 'Lavaplatos Cocina',      s: 'Lvp',  ctrl: 'Grifería',            af: 1.0, ac: 1.0},
  { id: 'tin',  n: 'Tina',                   s: 'Tin',  ctrl: 'Grifería',            af: 1.0, ac: 1.0},
  { id: 'lvra', n: 'Lavadora',               s: 'Lvra', ctrl: 'Automático',          af: 1.0, ac: 1.0},
  { id: 'lvro', n: 'Lavadero',               s: 'Lvro', ctrl: 'Grifería',            af: 1.0, ac: 1.0},
  { id: 'nev',  n: 'Nevera',                 s: 'Nev',  ctrl: 'Llave',               af: 0.5, ac: 0  },
  { id: 'lavav',n: 'Lavavajillas',           s: 'Lavav',ctrl: 'Llave',               af: 0,   ac: 1.5},
];

const CAT_GAS = [
  { id: 'pisc',   n: 'Calentador de piscina',     s: 'Cpisc',   q: 6.08 },
  { id: 'cal6',   n: 'Calentador P.D. Cap. 6 LPM',s: 'Cal 6LPM',q: 1.11 },
  { id: 'cal11',  n: 'Calentador P.D. Cap. 11 LPM',s:'Cal 11LPM',q: 1.88 },
  { id: 'cal21',  n: 'Calentador P.D. Cap. 21 LPM',s:'Cal 21LPM',q: 4.35 },
  { id: 'jac',    n: 'Jacuzzi',                   s: 'Jac',     q: 3.38 },
  { id: 'est2',   n: 'Estufa de 2 quemadores',    s: 'Est 2Q',  q: 0.68 },
  { id: 'est4',   n: 'Estufa de 4 quemadores',    s: 'Est 4Q',  q: 1.35 },
  { id: 'bt',     n: 'Baño turco',                s: 'BT',      q: 1.35 },
  { id: 'bs',     n: 'Baño sauna',                s: 'BS',      q: 1.08 },
  { id: 'hor_p',  n: 'Horno Pequeño',             s: 'HP',      q: 0.54 },
  { id: 'hor_m',  n: 'Horno mediano',             s: 'HM',      q: 0.81 },
  { id: 'hor_g',  n: 'Horno grande',              s: 'HG',      q: 1.15 },
  { id: 'srp',    n: 'Secadora de Ropa Pequeña',  s: 'SRP',     q: 0.54 },
  { id: 'srg',    n: 'Secadora de Ropa Grande',   s: 'SRG',     q: 0.81 },
  { id: 'calp',   n: 'Caldera Pequeña',           s: 'Calp',    q: 1.76 },
];

export default function BaseDatos({ redes }) {
  const { mats, setMats, aps, setAps, profs, setProfs } = useSanitario();

  const activeRedes = REDES_MAT.filter(r => redes?.has(r.id));

  const matMap = Object.fromEntries(activeRedes.map(r => [r.id, r]));
  const merged = activeRedes.map(r => ({
    ...r,
    matSel: (mats[r.id] && mats[r.id][0]?.val) || r.mat,
    prof: (profs.find(p => p.id === r.id)?.prof) ?? r.prof,
  }));

  const getOpts = (r) => r.opts || (mats[r.id] && mats[r.id].length > 0 ? mats[r.id].map(o => o.val) : [r.mat]);

  const setMatSel = (redId, newVal) => {
    setMats(prev => {
      const list = prev[redId] || [];
      if (list.length === 0) return { ...prev, [redId]: [{ id: redId + '_' + Date.now(), val: newVal }] };
      return { ...prev, [redId]: [{ ...list[0], val: newVal }, ...list.slice(1)] };
    });
  };

  const setProf = (redId, v) => {
    setProfs(prev => {
      const ix = prev.findIndex(p => p.id === redId);
      if (ix < 0) return [...prev, { id: redId, red: matMap[redId]?.lbl || redId, col: MAT_COL[redId] || 'var(--txt2)', prof: v, norma: '', nota: '' }];
      return prev.map(p => p.id === redId ? { ...p, prof: v } : p);
    });
  };

  const apsMap = Object.fromEntries(CAT_APS.map(a => [a.id, a]));
  const apsMerged = CAT_APS.map(c => {
    const cur = aps.find(a => a.id === c.id);
    return { ...c, ucaf: cur?.ucaf ?? c.af, ucac: cur?.ucac ?? c.ac };
  });

  const setApsVal = (id, key, v) => {
    setAps(prev => {
      const ix = prev.findIndex(a => a.id === id);
      if (ix < 0) {
        const def = apsMap[id];
        return [...prev, { id, s: def.s, n: def.n, g: 'h', ucaf: def.af, ucac: def.ac, ud: 0, pmin: 0, pmax: 0, qg: 0, [key]: v }];
      }
      return prev.map(a => a.id === id ? { ...a, [key]: v } : a);
    });
  };

  const totalAF = apsMerged.reduce((s, a) => s + (parseFloat(a.ucaf) || 0), 0);
  const totalAC = apsMerged.reduce((s, a) => s + (parseFloat(a.ucac) || 0), 0);
  const totalAFAC = totalAF + totalAC;
  const totalQ  = CAT_GAS.reduce((s, g) => s + g.q, 0).toFixed(2);

  return (
    <div className="fu bd-section" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>

        {/* ══════════ TABLA 1: MATERIALES POR RED ══════════ */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-h" style={{ padding: '6px 10px', flexShrink: 0 }}>
            <span className="card-t" style={{ fontSize: 13 }}>📦 Materiales por red</span>
            <span className="card-s" style={{ fontSize: 10 }}>{activeRedes.length} redes activas</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'center', padding: '4px 6px' }}>#</th>
                  <th style={{ padding: '4px 8px' }}>Red</th>
<th style={{ padding: '4px 8px', minWidth: 90 }}>Tubería</th>
          <th className="c" style={{ width: 60, padding: '4px 6px' }}>Prof. (m)</th>
          <th className="c" style={{ width: 130, padding: '4px 6px' }}>Nivel ref.</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((r, ix) => {
                  const col = MAT_COL[r.id] || 'var(--txt2)';
                  return (
                    <tr key={r.id} style={{ background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt3)', padding: '3px 6px' }}>{ix + 1}</td>
                      <td style={{ padding: '3px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, fontSize: 12 }}>{r.lbl}</span>
                        </div>
                      </td>
                      <td style={{ padding: '3px 8px' }}>
                        {r.fixed ? (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{r.mat}</span>
                        ) : (
                          <select
                            style={{
                              width: '100%', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                              color: 'var(--txt2)',
                              border: 'none',
                              padding: '2px 4px', cursor: 'pointer', background: 'transparent',
                            }}
                            value={r.matSel}
                            onChange={e => setMatSel(r.id, e.target.value)}>
                            {getOpts(r).map((o, i) => (
                              <option key={i} value={o} style={{ fontFamily: 'var(--body)', fontWeight: 400, color: '#000', background: '#fff' }}>{o}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                          <input type="number" step=".05" className="ni"
                          style={{ width: 50, padding: '2px 4px', fontSize: 11, textAlign: 'center', color: 'var(--txt)' }}
                          value={r.prof}
                          onChange={e => setProf(r.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td style={{ padding: '3px 6px' }}>
          <input className="ni"
            style={{ width: '100%', fontSize: 11, padding: '2px 5px', textAlign: 'center' }}
            placeholder=""
          />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════ TABLA 2: CATÁLOGO DE APARATOS SANITARIOS ══════════ */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-h" style={{ padding: '6px 10px', flexShrink: 0 }}>
            <span className="card-t" style={{ fontSize: 13 }}>🚿 Catálogo de Aparatos Sanitarios</span>
            <span className="card-s" style={{ fontSize: 10 }}>NTC 1500 · UC editables</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px' }}>Aparato</th>
                  <th style={{ width: 60, padding: '4px 6px' }}>Sigla</th>
                  <th style={{ width: 80, padding: '4px 6px' }}>Tipo de Control</th>
                  <th className="c" style={{ width: 55, padding: '4px 4px', background: 'rgba(27,110,243,.07)', color: 'var(--acc2)' }}>UC AF</th>
                  <th className="c" style={{ width: 55, padding: '4px 4px', background: 'rgba(240,69,69,.07)', color: '#F04545' }}>UC AC</th>
                </tr>
              </thead>
              <tbody>
                {apsMerged.map((a, ix) => (
                  <tr key={a.id} style={{ background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 500 }}>{a.n}</td>
                    <td style={{ padding: '3px 6px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--txt2)', padding: '0' }}>{a.s.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '3px 6px', fontSize: 11, color: 'var(--txt2)' }}>{a.ctrl}</td>
                    <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                      <input type="number" step=".01" className="ni"
                        style={{ width: 50, padding: '2px 4px', fontSize: 11, textAlign: 'center', color: 'var(--acc2)' }}
                        value={a.ucaf}
                        onChange={e => setApsVal(a.id, 'ucaf', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                      <input type="number" step=".01" className="ni"
                        style={{ width: 50, padding: '2px 4px', fontSize: 11, textAlign: 'center', color: '#F04545' }}
                        value={a.ucac}
                        onChange={e => setApsVal(a.id, 'ucac', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '7px 12px', background: 'var(--bg3)', borderTop: '1px solid var(--line)', fontSize: 12, flexShrink: 0 }}>
            <div className="tot">
              <div className="tl" style={{ fontSize: 10 }}>Σ AF</div>
              <div className="tv" style={{ fontSize: 14, color: 'var(--acc2)' }}>{totalAF.toFixed(1)}</div>
            </div>
            <div className="tot">
              <div className="tl" style={{ fontSize: 10 }}>Σ AC</div>
              <div className="tv" style={{ fontSize: 14, color: '#F04545' }}>{totalAC.toFixed(1)}</div>
            </div>
            <div className="tot">
              <div className="tl" style={{ fontSize: 10 }}>Σ AF+AC</div>
              <div className="tv" style={{ fontSize: 16, color: 'var(--txt)', fontWeight: 700 }}>{totalAFAC.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* ══════════ TABLA 3: CATÁLOGO DE GASODOMÉSTICOS ══════════ */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-h" style={{ padding: '6px 10px', flexShrink: 0 }}>
            <span className="card-t" style={{ fontSize: 13 }}>🔥 Catálogo de Gasodomésticos</span>
            <span className="card-s" style={{ fontSize: 10 }}>NTC 3728 · m³/hr</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px' }}>Aparato</th>
                  <th style={{ width: 88, padding: '4px 6px' }}>Sigla</th>
                  <th style={{ width: 60, padding: '4px 6px' }}>Tipo de Control</th>
                  <th className="c" style={{ width: 90, padding: '4px 6px' }}>Consumo m³/hr</th>
                </tr>
              </thead>
              <tbody>
                {CAT_GAS.map((g, ix) => (
                  <tr key={g.id} style={{ background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 500 }}>{g.n}</td>
                    <td style={{ padding: '3px 6px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--txt2)', padding: '0' }}>{g.s.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '3px 6px', fontSize: 11, color: 'var(--txt2)' }}>Llave</td>
                    <td style={{ textAlign: 'center', padding: '3px 6px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{g.q.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '7px 12px', background: 'var(--bg3)', borderTop: '1px solid var(--line)', fontSize: 12, flexShrink: 0 }}>
            <div className="tot">
              <div className="tl" style={{ fontSize: 10 }}>Σ Q gas</div>
              <div className="tv" style={{ fontSize: 14, color: 'var(--txt)' }}>{totalQ}</div>
              <div className="ts" style={{ fontSize: 10 }}>m³/hr</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
