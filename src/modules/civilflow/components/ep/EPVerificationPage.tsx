import React, { useMemo } from "react";
import { useEP } from "../../context/EPContext";
import Card from "../shared/Card";
import Tbl from "../shared/Tbl";
import EditButton from "../shared/EditButton";
import { PVC_SCH40, NEMA_HP, COMM_HP, selectDN } from "./calculations";
import { LazyInp, Param } from "./EPShared";
import { SI } from "../../styles/sharedTableStyles";
import { dec } from "../../utils/parseDecimal";
import { AGUA_DENSIDAD, GRAVEDAD } from "../../utils/calcSanitaryCore";

interface EPVerificationPageProps {
  section?: "params" | "results";
}

const EPVerificationPage_selStyle: React.CSSProperties = { flex: 1, padding: "5px 8px", borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--txt)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, outline: "none", boxSizing: "border-box" };

export default function EPVerificationPage({ section = "results" }: EPVerificationPageProps) {
  const { ep, updEP } = useEP();

  const qac = dec(ep.qac), qasc = dec(ep.qasc);
  const hfac = dec(ep.hfac), hfacs = dec(ep.hfacs), hfotros = dec(ep.hfotros);
  const pred = dec(ep.pred), pmin = dec(ep.pmin), pmax = dec(ep.pmax);
  const zbomba = dec(ep.zbomba), ztop = dec(ep.ztop), zcis = dec(ep.zcis), hfcis = dec(ep.hfcis);
  const nt = dec(ep.nt) || 1;
  const etab = dec(ep.etab) || 0.65, etam = dec(ep.etam) || 0.85;
  const fs = dec(ep.fs) || 1.15, ciclos = dec(ep.ciclos) || 6;
  const alfa = dec(ep.alfa) || 0.30;
  const vsuc = dec(ep.vsuc) || 1.5, vimp = dec(ep.vimp) || 2.0;
  const isRed = ep.modo === "red";

  const [editParams, setEditParams] = React.useState(false);
  const [editPComercial, setEditPComercial] = React.useState(false);
  const [editDiametros, setEditDiametros] = React.useState(false);

  const Qd = Math.max(qac, qasc);
  const Qm3h = Qd * 3.6;
  const Qgpm = Qd * 15.85;
  const Qb = nt > 0 ? Qd / nt : Qd;

  const Hg = isRed ? (ztop - zbomba) : (ztop - zcis);
  const HfCrit = Math.max(hfac, hfacs);
  const Hf = isRed ? (HfCrit + hfotros) : (HfCrit + hfotros + hfcis);
  const HMT = isRed ? (Hg + Hf + pmin - pred) : (Hg + Hf + pmin);

  const Phid = AGUA_DENSIDAD * GRAVEDAD * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const Pfreno_w = (etab * etam) > 0 ? Phid / (etab * etam) : 0;
  const Pfreno_hp = Pfreno_w / 745.7;
  const Pins_hp = Pfreno_hp * fs;
  const Pins_kw = (Pfreno_hp * 745.7 * fs) / 1000;

  const ramalCol = (qLps: number, vDiseno: number) => {
    const Qm3s = qLps / 1000;
    const diamCalcM = Math.sqrt((4 * Qm3s) / (Math.PI * vDiseno));
    const diamCalcMm = diamCalcM * 1000;
    const entry = selectDN(qLps, vDiseno);
    return { diamCalcMm, dn: entry.dn, vReal: entry.Vreal };
  };
  const rSucColector = ramalCol(Qd, vsuc);
  const rImpColector = ramalCol(Qd, vimp);
  const rSucBomba = ramalCol(Qb, vsuc);
  const rImpBomba = ramalCol(Qb, vimp);

  const fmtMm = (v: number) => v > 0 ? v.toFixed(1) : "—";
  const fmtMs = (v: number) => v > 0 ? v.toFixed(2) : "—";
  const fmtHp = (v: number) => v > 0 ? v.toFixed(3) : "—";
  const fmtBar = (v: number) => v !== 0 ? v.toFixed(2) : "—";
  const fmtLps = (v: number) => v > 0 ? v.toFixed(3) : "—";
  const fmtM3h = (v: number) => v > 0 ? v.toFixed(2) : "—";
  const fmtGpm = (v: number) => v > 0 ? v.toFixed(1) : "—";
  const fmtMca = (v: number) => v !== 0 ? v.toFixed(2) : "—";
  const fmtL = (v: number) => v > 0 ? v.toFixed(1) : "—";
  const fmtW = (v: number) => v > 0 ? v.toFixed(0) : "—";

  const M = { fontFamily: "var(--mono)", fontWeight: 600, color: "var(--txt)" } as const;
  const MB = { fontFamily: "var(--mono)", fontWeight: 700, color: "var(--txt)" } as const;
  const OK = { fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ok)" };
  const ERR = { fontFamily: "var(--mono)", fontWeight: 700, color: "#ef5350" };
  const autoNema = useMemo(() => {
    for (const h of NEMA_HP) { if (h >= Pins_hp) return h; }
    return NEMA_HP[NEMA_HP.length - 1];
  }, [Pins_hp]);

  const nemaSel = useMemo(() => {
    const custom = dec(ep.pcomercial);
    if (custom > 0) return custom;
    return autoNema;
  }, [autoNema, ep.pcomercial]);

  const margenPct = Pins_hp > 0 ? ((nemaSel - Pins_hp) / Pins_hp) * 100 : 0;
  const pComercialOk = nemaSel >= Pins_hp;

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

  const hgOk = Hg > 0;
  const hfOk = Hf >= 0;
  const pminOk = pmin > 0;
  const predOk = pred > 0;

  const sucDiam = (() => {
    const userDN = dec(ep.dnsuc);
    if (userDN > 0) {
      const entry = PVC_SCH40.find(t => t.dn === userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? (Qd / 1000) / A : 0 };
      }
    }
    return selectDN(Qd, vsuc);
  })();

  const impDiam = (() => {
    const userDN = dec(ep.dnimp);
    if (userDN > 0) {
      const entry = PVC_SCH40.find(t => t.dn === userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? (Qd / 1000) / A : 0 };
      }
    }
    return selectDN(Qd, vimp);
  })();

  if (section === "params") {
    const TH_S = { fontSize: 10, padding: "2px 4px" };
    const TD_S = { fontSize: 10, padding: "2px 4px" };
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/parametros_equipo.webp" iconImgStyle={{ width: 20, height: 20 }} title="Parámetros del equipo — Datos del fabricante" bodyStyle={{ padding: 0 }} headerRight={<EditButton edit={editParams} setEdit={setEditParams} />}>
            <Tbl caption="Parámetros del equipo" thStyle={TH_S} tdStyle={TD_S} cols={["Parámetro", "Valor", "Unidad"]} rows={[
              ["Eficiencia bomba (η_b)", <LazyInp disabled={!editParams} field="etab" ariaLabel="Eficiencia bomba" />, "dec"],
              ["Eficiencia motor (η_m)", <LazyInp disabled={!editParams} field="etam" ariaLabel="Eficiencia motor" />, "dec"],
              ["Factor de seguridad potencia", <LazyInp disabled={!editParams} field="fs" ariaLabel="Factor de seguridad potencia" />, "dec"],
              [<span style={{ fontWeight: 600 }}>{`Ciclos/hora (n)  `}{ciclos > 10 ? <span style={{ fontWeight: 700, color: "#ef5350" }}>No O.K.</span> : <span style={{ fontWeight: 700, color: "#22c55e" }}>OK</span>}</span>, <LazyInp disabled={!editParams} field="ciclos" ariaLabel="Ciclos por hora" />, "arr/h"],
              ["Fracción útil tanque (α)", <LazyInp disabled={!editParams} field="alfa" ariaLabel="Fracción útil tanque" />, "dec"],
              ["Velocidad succión (V_suc)", <LazyInp disabled={!editParams} field="vsuc" ariaLabel="Velocidad succión" />, "m/s"],
              ["Velocidad impulsión (V_imp)", <LazyInp disabled={!editParams} field="vimp" ariaLabel="Velocidad impulsión" />, "m/s"],
            ]} />
          </Card>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/altura_manometrica.webp" iconImgStyle={{ width: 20, height: 20 }} title={`${isRed ? "Altura manométrica total — Succión directa" : "Altura manométrica total — Succión desde cisterna"}`} bodyStyle={{ padding: 0 }}>
            <Tbl caption="Altura manométrica total" thStyle={TH_S} tdStyle={TD_S} cols={["Parámetro", "Valor", "Unidad"]} rows={(() => {
              const r: any[][] = [];
              r.push(["Desnivel geométrico", <span style={hgOk ? OK : ERR}>{hgOk ? `✓ ${(ztop - zbomba).toFixed(2)}` : `✗ ${(ztop - zbomba).toFixed(2)}`}</span>, "m.c.a."]);
              if (!isRed) r.push(["Desnivel total", <span style={M}>{fmtMca(Hg)}</span>, "m.c.a."]);
              r.push(["Pérdidas de carga críticas", <span style={hfOk ? OK : ERR}>{hfOk ? `✓ ${HfCrit.toFixed(2)}` : `✗ ${HfCrit.toFixed(2)}`}</span>, "m.c.a."]);
              if (!isRed) r.push(["Pérdidas de carga totales", <span style={hfOk ? OK : ERR}>{hfOk ? `✓ ${Hf.toFixed(2)}` : `✗ ${Hf.toFixed(2)}`}</span>, "m.c.a."]);
              r.push(["Presión mínima punto crítico", <span style={pminOk ? OK : ERR}>{pminOk ? `✓ ${pmin.toFixed(2)}` : `✗ ${pmin.toFixed(2)}`}</span>, "m.c.a."]);
              if (isRed) r.push(["Presión disponible acometida", <span style={predOk ? OK : ERR}>{predOk ? `✓ ${pred.toFixed(2)}` : `✗ ${pred.toFixed(2)}`}</span>, "m.c.a."]);
              r.push([<span style={{ fontWeight: 700 }}>Altura manométrica total HMT</span>, <span style={hmtOk ? OK : ERR}>{hmtOk ? `✓ ${HMT.toFixed(2)}` : `✗ ${HMT.toFixed(2)}`}</span>, "m.c.a."]);
              r.push(["Verificación presión máxima del sistema", alertaPmax ? <span style={ERR}>⚠ {HMT.toFixed(2)} &gt; {pmax.toFixed(2)}</span> : <span style={OK}>✓ HMT dentro del límite</span>, "m.c.a."]);
              return r;
            })()} />
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/potencia_bomba.webp" iconImgStyle={{ width: 20, height: 20 }} title="Potencia de la bomba" bodyStyle={{ padding: 0 }}>
            <Tbl caption="Potencia de la bomba" thStyle={TH_S} tdStyle={TD_S} cols={["Parámetro", "Valor", "Ud."]} rows={[
              ["Potencia hidráulica", <span style={M}>{fmtW(Phid)}</span>, "W"],
              ["Potencia al freno", <span style={M}>{fmtW(Pfreno_w)}</span>, "W"],
              ["Potencia al freno", <span style={M}>{fmtHp(Pfreno_hp)}</span>, "HP"],
              ["Potencia calculada con factor de seguridad", <span style={M}>{Pins_hp > 0 ? `${Pins_hp.toFixed(2)} HP / ${Pins_kw > 0 ? Pins_kw.toFixed(2) : "—"} kW` : "—"}</span>, ""],
              ["Potencia comercial seleccionada", <span style={MB}>{nemaSel}</span>, "HP"],
              ["Margen potencia comercial vs calculada", <span style={pComercialOk ? OK : ERR}>{pComercialOk ? `+${margenPct.toFixed(1)}%` : `${margenPct.toFixed(1)}%`}</span>, "%"],
              ["Verificación potencia comercial", <span style={pComercialOk ? OK : ERR}>{pComercialOk ? "✓ Adecuada" : "⚠ Insuficiente"}</span>, ""],
            ]} />
          </Card>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Card style={{display:'flex',flexDirection:'column', flex: 1, minWidth: 0}} iconImg="/iconos_civilflow/diseno_redes/equipos/caudales.webp" iconImgStyle={{ width: 20, height: 20 }} title="Caudales" bodyStyle={{ padding: 0 }}>
              <Tbl caption="Caudales" thStyle={TH_S} tdStyle={TD_S} cols={["Parámetro", "Valor", "Ud."]} rows={[
                ["Qd = MAX(Qac, Qasc)", <span style={M}>{fmtLps(Qd)}</span>, "L/s"],
                ["Qd en m³/h", <span style={M}>{fmtM3h(Qm3h)}</span>, "m³/h"],
                ["Qd en GPM", <span style={M}>{fmtGpm(Qgpm)}</span>, "GPM"],
                ["Qb = Qd / Nt", <span style={M}>{fmtLps(Qb)}</span>, "L/s"],
              ]} />
            </Card>
            <Card style={{display:'flex',flexDirection:'column', flex: 1, minWidth: 0}} iconImg="/iconos_civilflow/diseno_redes/equipos/pot_comercial_seleccionada.webp" iconImgStyle={{ width: 20, height: 20 }} title="Potencia comercial seleccionada" bodyStyle={{ padding: "5px 8px", display: "flex", flexDirection: "column", gap: 5 }} headerRight={<EditButton edit={editPComercial} setEdit={setEditPComercial} />}>
              <div style={{ fontSize: 10, color: "var(--txt3)" }}>
                P calculada = <strong style={{ color: "var(--txt)" }}>{Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"} HP</strong> · Comercial superior: <strong style={{ color: "var(--txt)", fontWeight: 700 }}>{autoNema} HP</strong>
              </div>
              <select aria-label="Potencia comercial" disabled={!editPComercial} value={ep.pcomercial || ""} onChange={(e) => updEP("pcomercial", e.target.value)} style={{ ...EPVerificationPage_selStyle, fontSize: 10, padding: "4px 6px", cursor: editPComercial ? "pointer" : "default", opacity: editPComercial ? 1 : 0.7 }}>
                <option value="">Seleccione</option>
                {COMM_HP.map(({ hp, kw }) => (<option key={hp} value={String(hp)}>{hp} HP ({kw} kW)</option>))}
              </select>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--txt3)", whiteSpace: "nowrap" }}>O ingrese valor:</span>
                <LazyInp disabled={!editPComercial} field="pcomercial" ariaLabel="Potencia comercial" style={{ ...SI, width: 46, fontSize: 10, padding: "2px 4px" }} />
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>HP</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const TH_R = { fontSize: 11, padding: "2px 4px" };
  const TD_R = { fontSize: 11, padding: "3px 4px" };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
      <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp" iconImgStyle={{ width: 22, height: 22 }} title="Presión de setpoint y tanque hidroneumático" bodyStyle={{ padding: 0 }}>
        <Tbl caption="Presión de setpoint y tanque hidroneumático" thStyle={TH_R} tdStyle={TD_R} cols={["Parámetro", "Valor", "Unidad", "Fórmula"]} rows={[
          ["Presión de arranque", <span style={M}>{fmtMca(Pon)}</span>, "m.c.a.", "P_arranque = HMT"],
          ["Presión de paro", <span style={M}>{fmtMca(Poff)}</span>, "m.c.a.", "P_paro = P_arranque × 1.10"],
          ["Presión de arranque en bar", <span style={M}>{fmtBar(Pon_bar)}</span>, "bar", "P_arranque = HMT / 10.2"],
          ["Presión de paro en bar", <span style={M}>{fmtBar(Poff_bar)}</span>, "bar", "P_paro = P_arranque × 1.10"],
          ["Precarga de nitrógeno N₂ = 0.90 × P_arranque", <span style={M}>{fmtBar(PN2_bar)}</span>, "bar", "P_precarga = 0.90 × P_arranque"],
          [<span style={{ fontWeight: 600 }}>Volumen útil Vu = Qd × 60 / (4 × n)</span>, <span style={M}>{fmtL(Vu)}</span>, "L", "Vu = Qd × 60 / (4 × n)"],
          [<span style={{ fontWeight: 700, color: "var(--txt)" }}>Volumen total tanque Vt = Vu / α</span>, <span style={MB}>{fmtL(Vt)}</span>, "L", "Vt = Vu / α"],
          ["Volumen total tanque Vt", <span style={M}>{Vt > 0 ? (Vt / 1000).toFixed(3) : "—"}</span>, "m³", "Vt / 1000"],
        ]} />
      </Card>
      <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp" iconImgStyle={{ width: 22, height: 22 }} title="Diámetros seleccionados por el usuario (anulan los recomendados)" bodyStyle={{ padding: 0 }}>
        <Tbl caption="Diámetros seleccionados por el usuario" thStyle={TH_R} tdStyle={TD_R} cols={["Parámetro", "Valor", "Unidad"]} rows={[
          [<Param name="Tubería de succión" sub="Diámetro nominal comercial" />, <LazyInp disabled={!editDiametros} field="dnsuc" ariaLabel="Tubería de succión" />, "mm DN"],
          ["Velocidad real en succión", <span style={M}>{fmtMs(sucDiam.Vreal)}</span>, "m/s"],
          [<Param name="Tubería de impulsión" sub="Diámetro nominal comercial" />, <LazyInp disabled={!editDiametros} field="dnimp" ariaLabel="Tubería de impulsión" />, "mm DN"],
          ["Velocidad real en impulsión", <span style={M}>{fmtMs(impDiam.Vreal)}</span>, "m/s"],
        ]} />
      </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
      <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp" iconImgStyle={{ width: 22, height: 22 }} title="Diámetros nominales de tuberías del equipo" bodyStyle={{ padding: 0 }} headerRight={<EditButton edit={editDiametros} setEdit={setEditDiametros} />}>
        <Tbl caption="Diámetros nominales de tuberías del equipo" thStyle={TH_R} tdStyle={{ ...TD_R, width: '1%', whiteSpace: 'nowrap' }} cols={["Ramal", "Q (L/s)", "V diseño (m/s)", "D calc (mm)", "DN (mm)", "V real (m/s)"]} rows={[
          ["Succión colector (Qd)", <span style={M}>{fmtLps(Qd)}</span>, <span style={M}>{vsuc}</span>, <span style={M}>{fmtMm(rSucColector.diamCalcMm)}</span>, <span style={MB}>{rSucColector.dn}</span>, <span style={M}>{fmtMs(rSucColector.vReal)}</span>],
          ["Impulsión colector (Qd)", <span style={M}>{fmtLps(Qd)}</span>, <span style={M}>{vimp}</span>, <span style={M}>{fmtMm(rImpColector.diamCalcMm)}</span>, <span style={MB}>{rImpColector.dn}</span>, <span style={M}>{fmtMs(rImpColector.vReal)}</span>],
          ["Succión por bomba (Qb)", <span style={M}>{fmtLps(Qb)}</span>, <span style={M}>{vsuc}</span>, <span style={M}>{fmtMm(rSucBomba.diamCalcMm)}</span>, <span style={MB}>{rSucBomba.dn}</span>, <span style={M}>{fmtMs(rSucBomba.vReal)}</span>],
          ["Impulsión por bomba (Qb)", <span style={M}>{fmtLps(Qb)}</span>, <span style={M}>{vimp}</span>, <span style={M}>{fmtMm(rImpBomba.diamCalcMm)}</span>, <span style={MB}>{rImpBomba.dn}</span>, <span style={M}>{fmtMs(rImpBomba.vReal)}</span>],
        ]} />
      </Card>
      <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp" iconImgStyle={{ width: 22, height: 22 }} title="Especificación técnica del equipo" bodyStyle={{ padding: 0 }}>
        <Tbl caption="Especificación técnica del equipo" thStyle={TH_R} tdStyle={TD_R} cols={["Parámetro", "Valor"]} rows={[
          ["Caudal nominal", <span style={M}>{fmtLps(Qd)} L/s = {fmtM3h(Qm3h)} m³/h = {fmtGpm(Qgpm)} GPM</span>],
          ["Altura manométrica total", <span style={M}>{fmtMca(HMT)} m.c.a. = {fmtBar(HMT / 10.2)} bar</span>],
          ["Configuración de bombas", <span style={M}>{nt + dec(ep.nr)} uds: {nt} trabajo + {dec(ep.nr)} reserva · Qb = {fmtLps(Qb)} L/s c/u</span>],
          ["Potencia comercial", <span style={M}>{nemaSel} HP = {(nemaSel * 0.7457).toFixed(0)} kW (calc: {Pins_hp > 0 ? Pins_hp.toFixed(2) : "—"} HP)</span>],
          ["Setpoint P_arranque / P_paro", <span style={M}>{fmtBar(Pon_bar)} / {fmtBar(Poff_bar)} bar</span>],
          ["Tanque acumulador", <span style={M}>{fmtL(Vt)} L · Precarga N₂ = {fmtBar(PN2_bar)} bar</span>],
          ["DN succión / impulsión", <span style={M}>DN {rSucColector.dn} / DN {rImpColector.dn} mm (PVC Sch 40)</span>],
          ["Control", <span style={M}>VFD × {nt + dec(ep.nr)} · Transductor 4–20 mA · PLC/SCADA</span>],
          ["Normas", <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--txt4)" }}>NTC 1500:2018 · RAS 2000 Tít. B · NSR-10 Tít. H · NFPA 20</span>],
        ]} />
      </Card>
      </div>
    </div>
  );
}
