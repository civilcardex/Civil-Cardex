import React, { useState, useRef, useEffect, useMemo } from "react";
import { useEP, type EPData } from "../../context/EPContext";
import { parseDecimalInput } from "../../utils/parseDecimal";
import Card from "../shared/Card";
import Tbl from "../shared/Tbl";
import { PVC_SCH40, NEMA_HP, COMM_HP, selectDN } from "./calculations";

const dec = (s: string) => parseDecimalInput(s) || 0;
const SI: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 3, background: "var(--bg4)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt)", width: "100%", boxSizing: "border-box", textAlign: "center", outline: "none", padding: "3px 5px" };

function LazyInp({ field, style, ariaLabel }: { field: keyof EPData; style?: React.CSSProperties; ariaLabel?: string }) {
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

  return <input type="text" inputMode="decimal" aria-label={ariaLabel} value={val} onChange={handleChange} onBlur={handleBlur} style={style || SI} />;
}

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

const FLEX_COL: React.CSSProperties = { display: "flex", flexDirection: "column" };

interface EPVerificationPageProps {
  section?: "params" | "results";
}

export default function EPVerificationPage({ section = "results" }: EPVerificationPageProps) {
  const { ep, updEP } = useEP();

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

  const hmtOk = HMT > 0 && HMT < pmax;
  const alertaPmax = HMT > pmax && pmax > 0;
  const alertaCiclos = ciclos > 10;
  const hgOk = Hg > 0;
  const hfOk = Hf >= 0;
  const pminOk = pmin > 0;
  const predOk = pred > 0;

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

  if (section === "params") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr", gap: 12, alignItems: "start" }}>
        <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/parametros_equipo.webp" iconImgStyle={{ width: 22, height: 22 }} title="Parámetros del equipo — Datos del fabricante" bodyStyle={{ padding: 0 }}>
          <Tbl cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
            [<Param name="Eficiencia bomba (η_b)" />, <LazyInp field="etab" ariaLabel="Eficiencia bomba" />, "dec", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.55 – 0.80</span> Verificar en curva característica del fabricante para el punto Qd / HMT.</Comment>],
            [<Param name="Eficiencia motor (η_m)" />, <LazyInp field="etam" ariaLabel="Eficiencia motor" />, "dec", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.85 – 0.95</span> Motores IE2 o IE3 recomendados para uso con VFD.</Comment>],
            [<Param name="Factor de seguridad potencia" />, <LazyInp field="fs" ariaLabel="Factor de seguridad potencia" />, "dec", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>+25%</span> Margen sobre P_freno para selección de motor comercial estándar.</Comment>],
            [<Param name="Ciclos/hora (n)" sub="Arranques permitidos por hora" />, <LazyInp field="ciclos" ariaLabel="Ciclos por hora" />, "arr/h", <Comment>{ciclos > 10 ? <span style={{ background: "rgba(239,83,80,0.15)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "#ef5350" }}>No O.K.</span> : <span style={{ background: "rgba(34,197,94,0.15)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "#22c55e" }}>OK</span>} Máximo 10 arranques/hora. Verificar especificación del motor.</Comment>],
            [<Param name="Fracción útil tanque (α)" />, <LazyInp field="alfa" ariaLabel="Fracción útil tanque" />, "dec", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.25 – 0.35</span> Fracción del volumen del acumulador disponible para agua. Típico 30%.</Comment>],
            [<Param name="Velocidad succión (V_suc)" sub="Para selección diámetro" />, <LazyInp field="vsuc" ariaLabel="Velocidad succión" />, "m/s", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>0.5 – 1.5 m/s</span> RAS 2000. Velocidad de diseño para tubería de succión del equipo.</Comment>],
            [<Param name="Velocidad impulsión (V_imp)" sub="Para selección diámetro" />, <LazyInp field="vimp" ariaLabel="Velocidad impulsión" />, "m/s", <Comment><span style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontSize: 10, color: "var(--txt2)" }}>1.5 – 3.5 m/s</span> RAS 2000. Velocidad de diseño para tubería de impulsión del equipo.</Comment>],
          ]} />
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/caudales.webp" iconImgStyle={{ width: 22, height: 22 }} title="Caudales" bodyStyle={{ padding: 0 }}>
            <Tbl thStyle={{ fontSize: 10, padding: "1px 4px" }} tdStyle={{ fontSize: 11, padding: "1px 4px" }} cols={["Parámetro", "Valor", "UNIDAD"]} rows={[
              ["Qd = MAX(Qac, Qasc)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qd.toFixed(3) : "—"}</span>, "L/s"],
              ["Qd en m³/h", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qm3h.toFixed(2) : "—"}</span>, "m³/h"],
              ["Qd en GPM", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qd > 0 ? Qgpm.toFixed(1) : "—"}</span>, "GPM"],
              ["Caudal por bomba Qb = Qd / Nt", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Qb > 0 ? Qb.toFixed(3) : "—"}</span>, "L/s"],
            ]} />
          </Card>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/altura_manometrica.webp" iconImgStyle={{ width: 22, height: 22 }} title={`${isRed ? "HMT = Hg + Hf + Pmin − Pred" : "HMT = Hg_total + Hf_red + Hf_suc + Pmin"}`} bodyStyle={{ padding: 0 }}>
            <Tbl thStyle={{ fontSize: 10, padding: "1px 4px" }} tdStyle={{ fontSize: 11, padding: "1px 4px" }} cols={["Parámetro", "Valor", "UNIDAD"]} rows={[
              ["Desnivel Hg = z_top − z_bomba", <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: hgOk ? "var(--ok)" : "#ef5350" }}>{hgOk ? "O.K" : "NO O.K"} {Hg.toFixed(2)}</span>, "m.c.a."],
              ["Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros", <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: hfOk ? "var(--ok)" : "#ef5350" }}>{hfOk ? "O.K" : "NO O.K"} {Hf.toFixed(2)}</span>, "m.c.a."],
              ["Pmin punto crítico", <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: pminOk ? "var(--ok)" : "#ef5350" }}>{pminOk ? "O.K" : "NO O.K"} {pmin.toFixed(2)}</span>, "m.c.a."],
              ...(isRed ? [] : [["Nivel mínimo cisterna (z_cis)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{zcis.toFixed(2)}</span>, "m"], ["Hf succión cisterna", <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: hfcis >= 0 ? "var(--ok)" : "#ef5350" }}>{hfcis >= 0 ? "O.K" : "NO O.K"} {hfcis.toFixed(2)}</span>, "m.c.a."]] as any[][]),
              ...(!isRed ? [] : [["Pred. disponible", <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: predOk ? "var(--ok)" : "#ef5350" }}>{predOk ? "O.K" : "NO O.K"} {pred.toFixed(2)}</span>, "m.c.a."]] as any[][]),
              [<span style={{ fontWeight: 700 }}>HMT total</span>, <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: hmtOk ? "var(--ok)" : "#ef5350" }}>{hmtOk ? "O.K" : "NO O.K"}  {HMT.toFixed(2)}</span>, "m.c.a."],
              ["Verificación Pmáx", alertaPmax ? <span style={{ color: "#ef5350", fontWeight: 700, fontFamily: "var(--mono)" }}>⚠ {HMT.toFixed(2)} &gt; {pmax.toFixed(2)}</span> : <span style={{ color: "var(--ok)", fontWeight: 700, fontFamily: "var(--mono)" }}>✓ OK ({HMT.toFixed(2)} ≤ {pmax.toFixed(2)})</span>, "m.c.a."],
            ]} />
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/potencia_bomba.webp" iconImgStyle={{ width: 22, height: 22 }} title="Potencia de la bomba" bodyStyle={{ padding: 0 }}>
            <Tbl cols={["Parámetro", "Valor", "Ud."]} rows={[
              ["P_hid = γ · Qd · HMT", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Phid > 0 ? Phid.toFixed(0) : "—"}</span>, "W"],
              ["P_freno = P_hid / (η_b · η_m)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pfreno > 0 ? Pfreno.toFixed(3) : "—"}</span>, "HP"],
              ["P calculada (× F.S.)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"}</span>, "HP"],
              ["P calculada (× F.S.)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{Pins_kw > 0 ? Pins_kw.toFixed(2) : "—"}</span>, "kW"],
            ]} />
          </Card>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/pot_comercial_seleccionada.webp" iconImgStyle={{ width: 22, height: 22 }} title="Potencia comercial seleccionada" bodyStyle={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: "var(--txt3)" }}>
              P calculada = <strong style={{ color: "var(--txt)" }}>{Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"} HP</strong> · Comercial inmediata superior: <strong style={{ color: "var(--txt)", fontWeight: 700 }}>{autoNema} HP</strong>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={ep.pcomercial || ""} onChange={(e) => updEP("pcomercial", e.target.value)} style={{ flex: 1, padding: "5px 8px", borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--txt)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none", boxSizing: "border-box" }}>
                <option value="">Seleccione</option>
                {COMM_HP.map(({ hp, kw }) => (<option key={hp} value={String(hp)}>{hp} HP ({kw} kW)</option>))}
              </select>
              <span style={{ fontSize: 10, color: "var(--txt3)", whiteSpace: "nowrap" }}>O ingrese valor:</span>
              <LazyInp field="pcomercial" ariaLabel="Potencia comercial" style={{ ...SI, width: 50, fontSize: 11, padding: "2px 4px" }} />
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>HP</span>
            </div>
            <div style={{ padding: "6px 8px", background: "var(--bg3)", borderRadius: "var(--r)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 9, color: "var(--txt4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Potencia seleccionada</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", fontFamily: "var(--mono)" }}>{nemaSel} HP</div>
              <div style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "var(--mono)", fontWeight: 600 }}>{(nemaSel * 0.7457).toFixed(2)} kW (IEC)</div>
              <div style={{ fontSize: 11, color: "var(--txt3)" }}>Margen: <span style={{ color: "var(--txt)", fontWeight: 700 }}>+{Pins_hp > 0 ? (((nemaSel - Pins_hp) / Pins_hp) * 100).toFixed(1) : "—"}%</span><span style={{ color: "var(--txt4)", marginLeft: 4 }}>· sobre presión calculada</span></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "480px 380px", gap: 16, justifyContent: "center", alignItems: "start" }}>
      <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/setpoint_tanque.webp" iconImgStyle={{ width: 22, height: 22 }} title="Setpoint y tanque hidroneumático" bodyStyle={{ padding: 0 }}>
        <Tbl thStyle={{ fontSize: 11, padding: "3px 6px" }} tdStyle={{ fontSize: 12, padding: "4px 6px" }} tdlStyle={{ fontSize: 13, padding: "4px 6px" }} cols={["Parámetro", "Valor", "Ud.", "Fórmula"]} rows={[
          ["P_on (arranque)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Pon.toFixed(2)}</span>, "m.c.a.", "P_on = HMT"],
          ["P_off (paro)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Poff.toFixed(2)}</span>, "m.c.a.", "P_off = P_on × 1.10"],
          ["P_on / P_off (presostato)", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Pon_bar.toFixed(2)} / {Poff_bar.toFixed(2)}</span>, "bar", "÷ 10.2 → bar"],
          ["Precarga N₂ = 0.90 × P_on", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{PN2_bar.toFixed(2)}</span>, "bar", "—"],
          [<span style={{ fontWeight: 600 }}>Volumen útil Vu = Qd·60 / (4·n)</span>, <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{Vu.toFixed(1)}</span>, "L", "Vu = Qd×60 / (4×n)"],
          [<span style={{ fontWeight: 700, color: "var(--txt)" }}>Volumen tanque Vt = Vu / α</span>, <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--txt)" }}>{Vt.toFixed(1)}</span>, "L", "Vt = Vu / α"]
        ]} />
      </Card>
      <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/diametros_velocidades.webp" iconImgStyle={{ width: 22, height: 22 }} title="Diámetros y velocidades" bodyStyle={{ padding: 0 }}>
        <Tbl thStyle={{ fontSize: 11, padding: "3px 6px" }} tdStyle={{ fontSize: 12, padding: "4px 6px" }} tdlStyle={{ fontSize: 13, padding: "4px 6px" }} cols={["Parámetro", "Valor", "Ud."]} rows={[
          [<Param name="Tubería succión" sub="DN comercial" />, <LazyInp field="dnsuc" ariaLabel="Tubería succión" />, "mm DN"],
          ["Velocidad real succión", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{sucDiam.Vreal ? sucDiam.Vreal.toFixed(2) : "—"}</span>, "m/s"],
          [<Param name="Tubería impulsión" sub="DN comercial" />, <LazyInp field="dnimp" ariaLabel="Tubería impulsión" />, "mm DN"],
          ["Velocidad real impulsión", <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" }}>{impDiam.Vreal ? impDiam.Vreal.toFixed(2) : "—"}</span>, "m/s"]
        ]} />
      </Card>
    </div>
  );
}
