import { useState, useMemo, useEffect, useRef } from "react";
import { useEP, type EPData } from "../context/EPContext";
import { parseDecimalInput } from "../utils/parseDecimal";
import PageNav from "./PageNav";

const dec = (s: string) => parseDecimalInput(s) || 0;
const SI: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 3, background: "var(--bg4)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt)", width: "100%", boxSizing: "border-box", textAlign: "center", outline: "none", padding: "3px 5px" };

function LazyInp({ field, style }: { field: keyof EPData; style?: React.CSSProperties }) {
  const { ep, updEP } = useEP();
  const [val, setVal] = useState(() => String(ep[field] ?? ""));
  const isDirty = useRef(false);

  useEffect(() => {
    if (!isDirty.current) setVal(String(ep[field] ?? ""));
  }, [ep, field]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setVal(v);
  };

  const handleBlur = () => {
    isDirty.current = false;
    updEP(field, val);
  };

  return <input type="text" inputMode="decimal" value={val} onChange={handleChange} onBlur={handleBlur} style={style || SI} />;
}
const TH: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--txt3)", fontFamily: "var(--mono)", textAlign: "center", padding: "2px 6px", borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.4px", background: "var(--bg3)" };
const TD: React.CSSProperties = { fontSize: 13, fontFamily: "var(--mono)", padding: "1px 6px", borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)", color: "var(--txt2)", textAlign: "center", verticalAlign: "middle" };
const TDL: React.CSSProperties = { ...TD, textAlign: "left", fontFamily: "var(--body)", color: "var(--txt)", minWidth: 150, fontSize: 14, fontWeight: 600 };

const Fmt = (v: any, u = "") => {
  if (v === "" || v === null || v === undefined) return <span style={{ color: "var(--txt3)", fontSize: 11 }}>—</span>;
  const val = typeof v === "number" ? v.toFixed(2) : v;
  return <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{val}{u ? ` ${u}` : ""}</span>;
};

const Param = ({ name, sub }: { name: string; sub?: string }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--txt)" }}>{name}</div>
    {sub && <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>{sub}</div>}
  </div>
);

const Comment = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 9, color: "var(--txt4)", lineHeight: 1.2, wordBreak: "break-word" }}>{children}</span>
);

const PVC_SCH40 = [
  { dn: 20, dInt: 20.93 }, { dn: 25, dInt: 26.64 }, { dn: 32, dInt: 35.05 },
  { dn: 40, dInt: 40.89 }, { dn: 50, dInt: 52.50 }, { dn: 65, dInt: 62.71 },
  { dn: 80, dInt: 77.93 }, { dn: 100, dInt: 102.26 }, { dn: 150, dInt: 154.05 },
];
const NEMA_HP = [0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

function selectDN(Qlps: number, vmax: number) {
  const Qm3s = Qlps / 1000;
  for (const t of PVC_SCH40) {
    const A = (Math.PI * Math.pow(t.dInt / 1000, 2)) / 4;
    const Vreal = Qm3s / A;
    if (Vreal <= vmax * 1.15) return { ...t, Vreal };
  }
  const last = PVC_SCH40[PVC_SCH40.length - 1];
  const A = (Math.PI * Math.pow(last.dInt / 1000, 2)) / 4;
  return { ...last, Vreal: Qm3s / A };
}

export default function PressureEquipmentDesign() {
  const { ep, updEP } = useEP();
  const [page, setPage] = useState(1);

  const qac = dec(ep.qac), qasc = dec(ep.qasc);
  const hfac = dec(ep.hfac), hfacs = dec(ep.hfacs), hfotros = dec(ep.hfotros);
  const pred = dec(ep.pred), pmin = dec(ep.pmin), pmax = dec(ep.pmax);
  const zbomba = dec(ep.zbomba), ztop = dec(ep.ztop), zcis = dec(ep.zcis), hfcis = dec(ep.hfcis);
  const nt = dec(ep.nt) || 1, nr = dec(ep.nr);
  const etab = dec(ep.etab) || 0.65, etam = dec(ep.etam) || 0.85;
  const fs = dec(ep.fs) || 1.15, ciclos = dec(ep.ciclos) || 6;
  const alfa = dec(ep.alfa) || 0.30;
  const vsuc = dec(ep.vsuc) || 1.5, vimp = dec(ep.vimp) || 2.0;
  const isRed = ep.modo === "red";

  const ntot = nt + nr;
  const Qd = useMemo(() => Math.max(qac, qasc), [qac, qasc]);
  const Qm3h = Qd * 3.6;
  const Qgpm = Qd * 15.85;
  const Qb = nt > 0 ? Qd / nt : Qd;

  const Hg = isRed ? (ztop - zbomba) : (ztop - zcis);
  const HfCrit = Math.max(hfac, hfacs);
  const Hf = isRed ? (HfCrit + hfotros) : (HfCrit + hfotros + hfcis);
  const HMT = isRed ? (Hg + Hf + pmin - pred) : (Hg + Hf + pmin);

  const Phid = 1000 * 9.81 * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const Pfreno = (etab * etam * 745.7) > 0 ? Phid / (etab * etam * 745.7) : 0;
  const Pins_hp = Pfreno * fs;
  const Pins_kw = (Pfreno * 745.7 * fs) / 1000;

  const autoNema = useMemo(() => {
    for (const h of NEMA_HP) { if (h >= Pins_hp) return h; }
    return NEMA_HP[NEMA_HP.length - 1];
  }, [Pins_hp]);

  const nemaSel = useMemo(() => {
    const custom = dec(ep.pcomercial);
    if (custom > 0) return custom;
    return autoNema;
  }, [autoNema, ep.pcomercial]);

  const Pon = HMT;
  const Poff = Pon * 1.10;
  const PN2 = Pon * 0.90;
  const Pon_bar = Pon / 10.2;
  const Poff_bar = Poff / 10.2;
  const PN2_bar = PN2 / 10.2;
  const Vu = ciclos > 0 ? (Qd * 60) / (4 * ciclos) : 0;
  const Vt = alfa > 0 ? Vu / alfa : 0;

  const alertaHMT = HMT < 0;
  const alertaPmax = HMT > pmax && pmax > 0;
  const alertaCiclos = ciclos > 10;

  const sucDiam = useMemo(() => {
    const userDN = dec(ep.dnsuc);
    if (userDN > 0) {
      const entry = PVC_SCH40.find(t => t.dn === userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? (Qd / 1000) / A : 0 };
      }
    }
    return selectDN(Qd, vsuc);
  }, [Qd, vsuc, ep.dnsuc]);
  const impDiam = useMemo(() => {
    const userDN = dec(ep.dnimp);
    if (userDN > 0) {
      const entry = PVC_SCH40.find(t => t.dn === userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? (Qd / 1000) / A : 0 };
      }
    }
    return selectDN(Qd, vimp);
  }, [Qd, vimp, ep.dnimp]);
  const sucBomba = useMemo(() => selectDN(Qb, vsuc), [Qb, vsuc]);
  const impBomba = useMemo(() => selectDN(Qb, vimp), [Qb, vimp]);
  const sucCalcMm = Qd > 0 ? Math.sqrt((4 * (Qd / 1000)) / (Math.PI * vsuc)) * 1000 : 0;
  const impCalcMm = Qd > 0 ? Math.sqrt((4 * (Qd / 1000)) / (Math.PI * vimp)) * 1000 : 0;

  const tblStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };

  function Tbl({ cols, rows, thStyle, tdStyle, tdlStyle }: { cols: string[]; rows: any[][]; thStyle?: React.CSSProperties; tdStyle?: React.CSSProperties; tdlStyle?: React.CSSProperties }) {
    return <table className="tbl" style={tblStyle}>
      <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...TH, ...thStyle }}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { ...TDL, ...tdlStyle } : { ...TD, ...tdStyle }}>{c}</td>)}</tr>)}</tbody>
    </table>;
  }

  const page1 = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      {/* Selector de modo */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-start" }}>
        <button onClick={() => updEP("modo", "red")} style={{ padding: "6px 10px", background: isRed ? "rgba(0,220,229,0.1)" : "transparent", border: `1.5px solid ${isRed ? "#00dce5" : "var(--line)"}`, borderRadius: "var(--r)", color: isRed ? "#00dce5" : "var(--txt3)", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>🔵 SUCCIÓN DIRECTA (RED)</button>
        <button onClick={() => updEP("modo", "cisterna")} style={{ padding: "6px 10px", background: !isRed ? "rgba(255,152,0,0.1)" : "transparent", border: `1.5px solid ${!isRed ? "#ff9800" : "var(--line)"}`, borderRadius: "var(--r)", color: !isRed ? "#ff9800" : "var(--txt3)", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>🟠 SUCCIÓN DESDE CISTERNA</button>
      </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* Columna izquierda: Caudales + Presiones (sin gap) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. Caudales de diseño */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <span className="card-t">📊 Caudales de diseño</span>
              <span className="card-s">Del diseño de redes</span>
            </div>
            <div style={{ padding: 1 }}>
              <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
                [<Param name="Caudal diseño AF" sub="Red agua fría" />, <LazyInp field="qac" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Caudal probable de la red de agua fría. Obtenido del diseño hidráulico.</Comment>],
                [<Param name="Caudal diseño ACS" sub="Red agua caliente" />, <LazyInp field="qasc" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Típico 60–70% del Qac. Del diseño de red ACS.</Comment>],
              ]} />
            </div>
          </div>
          {/* 3. Presiones y cotas */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <span className="card-t">📐 Presiones y cotas</span>
              <span className="card-s">NTC 1500 + levantamiento</span>
            </div>
            <div style={{ padding: 1 }}>
              <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
                ...(isRed ? [[
                  <Param name="Presión acometida" sub="Red pública en entrega" />,
                  <LazyInp field="pred" />,
                  "m.c.a.",
                  <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Medida en campo</span> · Usar convertidor 1. Ej: 200 kPa = 20.39 m.c.a.</Comment>
                ]] as any[][] : []),
                [
                  <Param name="Presión mínima punto crítico" sub="Aparato más desfavorable" />,
                  <LazyInp field="pmin" />,
                  "m.c.a.",
                  <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NTC 1500 Tab.3</span> · Mín. 5.0 (49 kPa). Ducha confort: 7.13. Flujómetro: 10.70.</Comment>
                ],
                [
                  <Param name="Presión máxima sistema" sub="Límite 500 kPa = 51.0 m.c.a." />,
                  <LazyInp field="pmax" />,
                  "m.c.a.",
                  <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NSR-10 H.4.2</span> · Instalar RRP si Pred supera este valor.</Comment>
                ],
                [
                  <Param name="Cota bomba" />,
                  <LazyInp field="zbomba" />,
                  "m",
                  <Comment>Nivel de instalación del equipo. Referencia = 0.00 m.</Comment>
                ],
                [
                  <Param name="Cota punto más desfavorable" sub="Piso más alto o aparato más lejano" />,
                  <LazyInp field="ztop" />,
                  "m",
                  <Comment>Del levantamiento topográfico o planos arquitectónicos.</Comment>
                ],
              ]} />
            </div>
          </div>
        </div>

        {/* Columna derecha: Pérdidas + Bombas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 2. Pérdidas de carga */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <span className="card-t">💧 Pérdidas de carga</span>
              <span className="card-s">Del diseño de redes</span>
            </div>
            <div style={{ padding: 1 }}>
              <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
                [<Param name="Pérdidas red AF" sub="Tramos + accesorios" />, <LazyInp field="hfac" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · Sumatoria pérdidas tramo más desfavorable de la red AC.</Comment>],
                [<Param name="Pérdidas red ACS" sub="Tramos + accesorios" />, <LazyInp field="hfacs" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · El módulo usa MAX(Hf_ac, Hf_acs) como pérdida crítica de diseño.</Comment>],
                [<Param name="Pérdidas adicionales" sub="Intercambiador, filtros, zonas" />, <LazyInp field="hfotros" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Opcional</span> · Calentador, filtros multimedia, válvulas de zona u otros no incluidos en el diseño de redes.</Comment>],
              ]} />
            </div>
          </div>
          {/* 4. Configuración de bombas */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <span className="card-t">⚙️ Configuración de bombas</span>
            </div>
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 4, fontWeight: 600 }}>Bombas en trabajo</div>
                  <div style={{ padding: "2px 0" }}>
                    <LazyInp field="nt" style={{ ...SI, fontSize: 14, padding: "6px 8px", fontWeight: 700 }} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--txt4)", marginTop: 4 }}>Operan simultáneamente en régimen normal</div>
                </div>
                <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 4, fontWeight: 600 }}>Bombas en reserva</div>
                  <div style={{ padding: "2px 0" }}>
                    <LazyInp field="nr" style={{ ...SI, fontSize: 14, padding: "6px 8px", fontWeight: 700 }} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--txt4)", marginTop: 4 }}>Stand-by · arranque automático por falla</div>
                </div>
              </div>
              <div style={{
                marginTop: 6, padding: "6px 10px", background: "var(--bg3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "var(--r)", border: "1px solid var(--line)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--acc2)", fontFamily: "var(--mono)" }}>
                  Total: {ntot} bombas · {nt} trabajo + {nr} reserva · Qb = {Qb > 0 ? Qb.toFixed(3) : "—"} L/s c/u
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Parámetros del equipo — oculto por solicitud */}
      </div>
    </div>
  );

  const COMM_HP = [
    { hp: 0.33, kw: 0.25 }, { hp: 0.5, kw: 0.37 },
    { hp: 0.75, kw: 0.55 }, { hp: 1, kw: 0.75 }, { hp: 1.5, kw: 1.1 },
    { hp: 2, kw: 1.5 }, { hp: 3, kw: 2.2 }, { hp: 4, kw: 3 },
    { hp: 5, kw: 3.7 }, { hp: 5.5, kw: 4}, { hp: 7.5, kw: 5.5 }, { hp: 10, kw: 7.5 },{hp:12.5,kw:9.2},
    { hp: 15, kw: 11 }, { hp: 20, kw: 15}, { hp: 25, kw: 18.5 },
    { hp: 30, kw: 22 }, { hp: 40, kw: 30}, { hp: 50, kw: 37},{hp:60,kw:45},
    { hp: 75, kw: 55 }, { hp: 100, kw: 75 },
    { hp: 125, kw: 90 }, { hp: 150, kw: 110 },
  ];

  const pageParams = (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr", gap: 12, alignItems: "start" }}>
      {/* Col 1: Parámetros del equipo */}
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="card-h">
          <span className="card-t">📋 Parámetros del equipo — Datos del fabricante</span>
        </div>
        <div style={{ padding: 1 }}>
          <Tbl cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
            [
              <Param name="Eficiencia bomba (η_b)" />,
              <LazyInp field="etab" />,
              "dec",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.55 – 0.80</span> Verificar en curva característica del fabricante para el punto Qd / HMT.</Comment>
            ],
            [
              <Param name="Eficiencia motor (η_m)" />,
              <LazyInp field="etam" />,
              "dec",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.85 – 0.95</span> Motores IE2 o IE3 recomendados para uso con VFD.</Comment>
            ],
            [
              <Param name="Factor de seguridad potencia" />,
              <LazyInp field="fs" />,
              "dec",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>+25%</span> Margen sobre P_freno para selección de motor comercial estándar.</Comment>
            ],
            [
              <Param name="Ciclos/hora (n)" sub="Arranques permitidos por hora" />,
              <LazyInp field="ciclos" />,
              "arr/h",
              <Comment>{ciclos > 10
                ? <span style={{ background: "rgba(239,83,80,0.15)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "#ef5350" }}>No O.K.</span>
                : <span style={{ background: "rgba(34,197,94,0.15)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "#22c55e" }}>OK</span>} Máximo 10 arranques/hora. Verificar especificación del motor.</Comment>
            ],
            [
              <Param name="Fracción útil tanque (α)" />,
              <LazyInp field="alfa" />,
              "dec",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.25 – 0.35</span> Fracción del volumen del acumulador disponible para agua. Típico 30%.</Comment>
            ],
            [
              <Param name="Velocidad succión (V_suc)" sub="Para selección diámetro" />,
              <LazyInp field="vsuc" />,
              "m/s",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.5 – 1.5 m/s</span> RAS 2000. Velocidad de diseño para tubería de succión del equipo.</Comment>
            ],
            [
              <Param name="Velocidad impulsión (V_imp)" sub="Para selección diámetro" />,
              <LazyInp field="vimp" />,
              "m/s",
              <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>1.5 – 3.5 m/s</span> RAS 2000. Velocidad de diseño para tubería de impulsión del equipo.</Comment>
            ],
          ]} />
        </div>
      </div>

      {/* Col 2: Caudales + HMT apiladas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Caudales */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h">
            <span className="card-t">📊 Caudales</span>
          </div>
          <div style={{ padding: 1 }}>
            <Tbl thStyle={{ fontSize: 10, padding: "1px 4px" }} tdStyle={{ fontSize: 11, padding: "1px 4px" }} cols={["Parámetro", "Valor", "UNIDAD"]} rows={[
              [
                "Qd = MAX(Qac, Qasc)",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qd.toFixed(3) : "—"}</span>,
                "L/s",
              ],
              [
                "Qd en m³/h",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qm3h.toFixed(2) : "—"}</span>,
                "m³/h",
              ],
              [
                "Qd en GPM",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qgpm.toFixed(1) : "—"}</span>,
                "GPM",
              ],
              [
                "Caudal por bomba Qb = Qd / Nt",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qb > 0 ? Qb.toFixed(3) : "—"}</span>,
                "L/s",
              ],
            ]} />
          </div>
        </div>

        {/* HMT */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h">
            <span className="card-t">📐 {isRed ? "HMT = Hg + Hf + Pmin − Pred" : "HMT = Hg_total + Hf_red + Hf_suc + Pmin"}</span>
          </div>
          <div style={{ padding: 1 }}>
            <Tbl thStyle={{ fontSize: 10, padding: "1px 4px" }} tdStyle={{ fontSize: 11, padding: "1px 4px" }} cols={["Parámetro", "Valor", "UNIDAD"]} rows={[
              [
                "Desnivel Hg = z_top − z_bomba",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Hg !== 0 ? Hg.toFixed(2) : "—"}</span>,
                "m.c.a.",
              ],
              [
                "Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Hf > 0 ? Hf.toFixed(2) : "—"}</span>,
                "m.c.a.",
              ],
              [
                "Pmin punto crítico",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{pmin > 0 ? pmin.toFixed(2) : "—"}</span>,
                "m.c.a.",
              ],
              ...(isRed ? [] : [
                [
                  "Nivel mínimo cisterna (z_cis)",
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{zcis.toFixed(2)}</span>,
                  "m",
                ],
                [
                  "Hf succión cisterna",
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{hfcis > 0 ? hfcis.toFixed(2) : "—"}</span>,
                  "m.c.a.",
                ],
              ]),
              ...(!isRed ? [] : [
                [
                  "Pred. disponible",
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{pred > 0 ? pred.toFixed(2) : "—"}</span>,
                  "m.c.a.",
                ],
              ]),
              [
                <span style={{ fontWeight: 700 }}>HMT total</span>,
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: alertaHMT ? "#ef5350" : "var(--txt)" }}>{HMT.toFixed(2)}</span>,
                "m.c.a.",
              ],
              [
                "Verificación Pmáx",
                alertaPmax
                  ? <span style={{ color: "#ef5350", fontWeight: 700, fontFamily: "var(--mono)" }}>⚠ {HMT.toFixed(2)} &gt; {pmax.toFixed(2)}</span>
                  : <span style={{ color: "var(--ok)", fontWeight: 700, fontFamily: "var(--mono)" }}>✓ OK ({HMT.toFixed(2)} ≤ {pmax.toFixed(2)})</span>,
                "m.c.a.",
              ],
            ]} />
          </div>
        </div>
      </div>

      {/* Col 3: Potencia de la bomba + Potencia comercial */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h">
            <span className="card-t">⚡ Potencia de la bomba</span>
          </div>
          <div style={{ padding: 1 }}>
            <Tbl cols={["Parámetro", "Valor", "Ud."]} rows={[
              [
                "P_hid = γ · Qd · HMT",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Phid > 0 ? Phid.toFixed(0) : "—"}</span>,
                "W",
              ],
              [
                "P_freno = P_hid / (η_b · η_m)",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pfreno > 0 ? Pfreno.toFixed(3) : "—"}</span>,
                "HP",
              ],
              [
                "P calculada (× F.S.)",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"}</span>,
                "HP",
              ],
              [
                "P calculada (× F.S.)",
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pins_kw > 0 ? Pins_kw.toFixed(2) : "—"}</span>,
                "kW",
              ],
            ]} />
          </div>
        </div>

        {/* Potencia comercial seleccionada */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h">
            <span className="card-t">⚡ Potencia comercial seleccionada</span>
          </div>
          <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: "var(--txt3)" }}>
            P calculada = <strong style={{ color: "var(--txt)" }}>{Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"} HP</strong> · Comercial inmediata superior: <strong style={{ color: "var(--txt)", fontWeight: 700 }}>{autoNema} HP</strong>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={ep.pcomercial || ""}
              onChange={(e) => updEP("pcomercial", e.target.value)}
              style={{
                flex: 1, padding: "5px 8px", borderRadius: "var(--r)",
                border: "1px solid var(--line)",
                background: "var(--bg2)", color: "var(--txt)",
                fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                cursor: "pointer", outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="">SELECCIONE</option>
              {COMM_HP.map(({ hp, kw }) => (
                <option key={hp} value={String(hp)}>{hp} HP ({kw} kW)</option>
              ))}
            </select>
            <span style={{ fontSize: 10, color: "var(--txt3)", whiteSpace: "nowrap" }}>O ingrese valor:</span>
            <LazyInp field="pcomercial" style={{ ...SI, width: 50, fontSize: 11, padding: "2px 4px" }} />
            <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>HP</span>
          </div>

          <div style={{
            padding: "6px 8px", background: "var(--bg3)", borderRadius: "var(--r)",
            border: "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 9, color: "var(--txt4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Potencia seleccionada</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", fontFamily: "var(--mono)" }}>{nemaSel} HP</div>
            <div style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "var(--mono)", fontWeight: 600 }}>{(nemaSel * 0.7457).toFixed(2)} kW (IEC)</div>
            <div style={{ fontSize: 11, color: "var(--txt3)" }}>
              Margen: <span style={{ color: "var(--txt)", fontWeight: 700 }}>+{Pins_hp > 0 ? (((nemaSel - Pins_hp) / Pins_hp) * 100).toFixed(1) : "—"}%</span>
              <span style={{ color: "var(--txt4)", marginLeft: 4 }}>· sobre presión calculada</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  const verifyRow = (label: string, qLps: number, vMax: number, sel: ReturnType<typeof selectDN>, calcMm: number) => {
    const ok = sel.Vreal <= vMax * 1.15;
    return [
      label,
      <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{qLps > 0 ? qLps.toFixed(3) : "—"}</span>,
      <span style={{ fontFamily: "var(--mono)" }}>{vMax > 0 ? vMax.toFixed(2) : "—"}</span>,
      <span style={{ fontFamily: "var(--mono)" }}>{calcMm > 0 ? calcMm.toFixed(2) : "—"}</span>,
      <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{sel.dn ? `DN ${sel.dn}` : "—"}</span>,
      <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: ok ? "var(--ok)" : "#ef5350" }}>{sel.Vreal ? sel.Vreal.toFixed(2) : "—"}</span>,
      ok
        ? <span style={{ color: "var(--ok)", fontWeight: 700, fontFamily: "var(--mono)" }}>✓ OK</span>
        : <span style={{ color: "#ef5350", fontWeight: 700, fontFamily: "var(--mono)" }}>⚠ Supera</span>,
    ];
  };

  const page3 = (
    <div style={{ display: "grid", gridTemplateColumns: "480px 380px", gap: 16, justifyContent: "center", alignItems: "start" }}>
      {/* Col 1 */}
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="card-h">
          <span className="card-t">🎛️ Setpoint y tanque hidroneumático</span>
        </div>
        <div style={{ padding: 1 }}>
          <Tbl 
            thStyle={{ fontSize: 11, padding: "3px 6px" }} 
            tdStyle={{ fontSize: 12, padding: "4px 6px" }} 
            tdlStyle={{ fontSize: 13, padding: "4px 6px" }} 
            cols={["Parámetro", "Valor", "Ud.", "Fórmula"]} 
            rows={[
            [
              "P_on (arranque)",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Pon.toFixed(2)}</span>,
              "m.c.a.",
              "P_on = HMT"
            ],
            [
              "P_off (paro)",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Poff.toFixed(2)}</span>,
              "m.c.a.",
              "P_off = P_on × 1.10"
            ],
            [
              "P_on / P_off (presostato)",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Pon_bar.toFixed(2)} / {Poff_bar.toFixed(2)}</span>,
              "bar",
              "÷ 10.2 → bar"
            ],
            [
              "Precarga N₂ = 0.90 × P_on",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{PN2_bar.toFixed(2)}</span>,
              "bar",
              "—"
            ],
            [
              <span style={{ fontWeight: 600 }}>Volumen útil Vu = Qd·60 / (4·n)</span>,
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Vu.toFixed(1)}</span>,
              "L",
              "Vu = Qd×60 / (4×n)"
            ],
            [
              <span style={{ fontWeight: 700, color: "var(--txt)" }}>Volumen tanque Vt = Vu / α</span>,
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--txt)" }}>{Vt.toFixed(1)}</span>,
              "L",
              "Vt = Vu / α"
            ]
          ]} />
        </div>
      </div>

      {/* Col 2 */}
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="card-h">
          <span className="card-t">📏 Diámetros y velocidades</span>
        </div>
        <div style={{ padding: 1 }}>
          <Tbl 
            thStyle={{ fontSize: 11, padding: "3px 6px" }} 
            tdStyle={{ fontSize: 12, padding: "4px 6px" }} 
            tdlStyle={{ fontSize: 13, padding: "4px 6px" }} 
            cols={["Parámetro", "Valor", "Ud."]} 
            rows={[
            [
              <Param name="Tubería succión" sub="DN comercial" />,
              <LazyInp field="dnsuc" />,
              "mm DN"
            ],
            [
              "Velocidad real succión",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{sucDiam.Vreal ? sucDiam.Vreal.toFixed(2) : "—"}</span>,
              "m/s"
            ],
            [
              <Param name="Tubería impulsión" sub="DN comercial" />,
              <LazyInp field="dnimp" />,
              "mm DN"
            ],
            [
              "Velocidad real impulsión",
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{impDiam.Vreal ? impDiam.Vreal.toFixed(2) : "—"}</span>,
              "m/s"
            ]
          ]} />
        </div>
      </div>
    </div>
  );

  const pages = [
    { t: "Datos de entrada", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: page1 },
    { t: "Parámetros del equipo", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: pageParams },
    { t: "Resultados y Resumen", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: page3 },
  ];

  return (
    <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      <PageNav page={page} setPage={setPage} total={3} color="var(--ep)" labels={["Datos de entrada", "Parámetros", "Resultados"]} />
      <div style={{ flex: 1, padding: 6, overflow: "auto" }}>
        {pages[page - 1].c}
      </div>
    </div>
  );
}
