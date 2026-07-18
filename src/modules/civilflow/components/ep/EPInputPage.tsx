import React, { useState } from "react";
import { useEP } from "../../context/EPContext";
import Card from "../shared/Card";
import Tbl from "../shared/Tbl";
import EditButton from "../shared/EditButton";
import { LazyInp, Param, Comment } from "./EPShared";
import { SI } from "../../styles/sharedTableStyles";
import { dec } from "../../utils/parseDecimal";
const EPInputPage_S1: React.CSSProperties = { marginTop: 6, padding: "6px 10px", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r)", border: "1px solid var(--line)", };
const EPInputPage_modoBtn: React.CSSProperties = { padding: "8px 14px", borderRadius: "var(--r)", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase" };


function EPInputPage() {
  const { ep, updEP } = useEP();

  const qac = dec(ep.qac), qasc = dec(ep.qasc);
  const nt = dec(ep.nt) || 1, nr = dec(ep.nr);
  const isRed = ep.modo === "red";

  const ntot = nt + nr;
  const Qd = Math.max(qac, qasc);
  const Qb = nt > 0 ? Qd / nt : Qd;

  const [editCaudales, setEditCaudales] = useState(false);
  const [editPresiones, setEditPresiones] = useState(false);
  const [editPerdidas, setEditPerdidas] = useState(false);
  const [editBombas, setEditBombas] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-start" }}>
        <button type="button" onClick={() => updEP("modo", "red")} style={{ ...EPInputPage_modoBtn, background: isRed ? "rgba(0,220,229,0.1)" : "transparent", border: `1.5px solid ${isRed ? "#00dce5" : "var(--line)"}`, color: isRed ? "#00dce5" : "var(--txt3)" }}><img src="/iconos_civilflow/diseno_redes/equipos/succion_red.webp" alt="Succión directa"  width={22} height={22} style={{width:22,height:22}}  loading="lazy" /> Succión directa (red)</button>
        <button type="button" onClick={() => updEP("modo", "cisterna")} style={{ ...EPInputPage_modoBtn, background: !isRed ? "rgba(255,152,0,0.1)" : "transparent", border: `1.5px solid ${!isRed ? "#ff9800" : "var(--line)"}`, color: !isRed ? "#ff9800" : "var(--txt3)" }}><img src="/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp" alt="Succión cisterna"  width={22} height={22} style={{width:22,height:22}}  loading="lazy" /> Succión cisterna</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/caudales_diseno.webp" iconImgStyle={{ width: 22, height: 22 }} title="1. Caudales de diseño" bodyStyle={{ padding: 0 }} headerRight={<EditButton edit={editCaudales} setEdit={setEditCaudales} />}>
            <Tbl caption="Caudales de diseño" thStyle={{ fontSize: 11 }} tdStyle={{ fontSize: 12 }} tdlStyle={{ fontSize: 13 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              [<Param name="Caudal diseño AF" sub="Red agua fría" />, <LazyInp disabled={!editCaudales} field="qac" ariaLabel="Caudal diseño AF" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Caudal probable de la red de agua fría. Obtenido del diseño hidráulico.</Comment>],
              [<Param name="Caudal diseño ACS" sub="Red agua caliente" />, <LazyInp disabled={!editCaudales} field="qasc" ariaLabel="Caudal diseño ACS" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Típico 60–70% del Qac. Del diseño de red ACS.</Comment>],
            ]} />
          </Card>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/presiones_y_cotas.webp" iconImgStyle={{ width: 22, height: 22 }} title="3. Presiones y cotas" bodyStyle={{ padding: 0 }} headerRight={<EditButton edit={editPresiones} setEdit={setEditPresiones} />}>
            <Tbl caption="Presiones y cotas" thStyle={{ fontSize: 11 }} tdStyle={{ fontSize: 12 }} tdlStyle={{ fontSize: 13 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              ...(isRed ? [[
                <Param name="Presión acometida" sub="Red pública en entrega" />,
                <LazyInp disabled={!editPresiones} field="pred" ariaLabel="Presión acometida" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Medida en campo</span> · Usar convertidor 1. Ej: 200 kPa = 20.39 m.c.a.</Comment>
              ]] as React.ReactNode[][] : []),
              [
                <Param name="Presión mínima punto crítico" sub="Aparato más desfavorable" />,
                <LazyInp disabled={!editPresiones} field="pmin" ariaLabel="Presión mínima punto crítico" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NTC 1500 Tab.3</span> · Mín. 5.0 (49 kPa). Ducha confort: 7.13. Flujómetro: 10.70.</Comment>
              ],
              [
                <Param name="Presión máxima sistema" sub="Límite 500 kPa = 51.0 m.c.a." />,
                <LazyInp disabled={!editPresiones} field="pmax" ariaLabel="Presión máxima sistema" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NSR-10 H.4.2</span> · Instalar RRP si Pred supera este valor.</Comment>
              ],
              [
                <Param name="Cota bomba" />,
                <LazyInp disabled={!editPresiones} field="zbomba" ariaLabel="Cota bomba" />,
                "m",
                <Comment>Nivel de instalación del equipo. Referencia = 0.00 m.</Comment>
              ],
              [
                <Param name="Cota punto más desfavorable" sub="Piso más alto o aparato más lejano" />,
                <LazyInp disabled={!editPresiones} field="ztop" ariaLabel="Cota punto más desfavorable" />,
                "m",
                <Comment>Del levantamiento topográfico o planos arquitectónicos.</Comment>
              ],
            ]} />
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/perdidas_de_carga.webp" iconImgStyle={{ width: 22, height: 22 }} title="2. Pérdidas de carga" bodyStyle={{ padding: 0 }} headerRight={<EditButton edit={editPerdidas} setEdit={setEditPerdidas} />}>
            <Tbl caption="Pérdidas de carga" thStyle={{ fontSize: 11 }} tdStyle={{ fontSize: 12 }} tdlStyle={{ fontSize: 13 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              [<Param name="Pérdidas red AF" sub="Tramos + accesorios" />, <LazyInp disabled={!editPerdidas} field="hfac" ariaLabel="Pérdidas red AF" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · Sumatoria pérdidas tramo más desfavorable de la red AC.</Comment>],
              [<Param name="Pérdidas red ACS" sub="Tramos + accesorios" />, <LazyInp disabled={!editPerdidas} field="hfacs" ariaLabel="Pérdidas red ACS" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · El módulo usa MAX(Hf_ac, Hf_acs) como pérdida crítica de diseño.</Comment>],
              [<Param name="Pérdidas adicionales" sub="Intercambiador, filtros, zonas" />, <LazyInp disabled={!editPerdidas} field="hfotros" ariaLabel="Pérdidas adicionales" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Opcional</span> · Calentador, filtros multimedia, válvulas de zona u otros no incluidos en el diseño de redes.</Comment>],
            ]} />
          </Card>
          <Card style={{display:'flex',flexDirection:'column'}} iconImg="/iconos_civilflow/diseno_redes/equipos/config_bombas.webp" iconImgStyle={{ width: 22, height: 22 }} title="4. Configuración de bombas" bodyStyle={{ padding: 4, display: "flex", flexDirection: "column", gap: 0 }} headerRight={<EditButton edit={editBombas} setEdit={setEditBombas} />}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "6px 8px" }}>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 2, fontWeight: 600 }}>Bombas en trabajo</div>
                <div style={{ padding: "1px 0" }}>
                  <LazyInp disabled={!editBombas} field="nt" ariaLabel="Bombas en trabajo" style={{ ...SI, fontSize: 13, padding: "4px 6px", fontWeight: 700 }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--txt4)", marginTop: 2 }}>Operan simultáneamente en régimen normal</div>
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "6px 8px" }}>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 2, fontWeight: 600 }}>Bombas en reserva</div>
                <div style={{ padding: "1px 0" }}>
                  <LazyInp disabled={!editBombas} field="nr" ariaLabel="Bombas en reserva" style={{ ...SI, fontSize: 13, padding: "4px 6px", fontWeight: 700 }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--txt4)", marginTop: 2 }}>Reserva · arranque automático por falla</div>
              </div>
            </div>
            <div style={EPInputPage_S1}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--acc2)", fontFamily: "var(--mono)" }}>
                Total: {ntot} bombas · {nt} trabajo + {nr} reserva · Qb = {Qb > 0 ? Qb.toFixed(3) : "—"} L/s c/u
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default React.memo(EPInputPage);