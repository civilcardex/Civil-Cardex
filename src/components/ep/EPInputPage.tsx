import React, { useMemo } from "react";
import { useEP } from "../../context/EPContext";
import Card from "../shared/Card";
import Tbl from "../shared/Tbl";
import { LazyInp, Fmt, SI, Param, Comment, FLEX_COL } from "./EPShared";
import { dec } from "../../utils/parseDecimal";

function EPInputPage() {
  const { ep, updEP } = useEP();

  const qac = dec(ep.qac), qasc = dec(ep.qasc);
  const nt = dec(ep.nt) || 1, nr = dec(ep.nr);
  const isRed = ep.modo === "red";

  const ntot = nt + nr;
  const Qd = useMemo(() => Math.max(qac, qasc), [qac, qasc]);
  const Qb = nt > 0 ? Qd / nt : Qd;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-start" }}>
        <button onClick={() => updEP("modo", "red")} style={{ padding: "8px 14px", background: isRed ? "rgba(0,220,229,0.1)" : "transparent", border: `1.5px solid ${isRed ? "#00dce5" : "var(--line)"}`, borderRadius: "var(--r)", color: isRed ? "#00dce5" : "var(--txt3)", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase"}}><img src="/iconos_diseno_redes/equipos/succion_red.webp" alt=""  width={22} height={22} style={{width:22,height:22}}  loading="lazy" /> Succión directa (red)</button>
        <button onClick={() => updEP("modo", "cisterna")} style={{ padding: "8px 14px", background: !isRed ? "rgba(255,152,0,0.1)" : "transparent", border: `1.5px solid ${!isRed ? "#ff9800" : "var(--line)"}`, borderRadius: "var(--r)", color: !isRed ? "#ff9800" : "var(--txt3)", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}><img src="/iconos_diseno_redes/equipos/succion_cisterna.webp" alt=""  width={22} height={22} style={{width:22,height:22}}  loading="lazy" /> Succión cisterna</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/caudales_diseno.webp" iconImgStyle={{ width: 22, height: 22 }} title="Caudales de diseño" subtitle="Del diseño de redes" bodyStyle={{ padding: 0 }}>
            <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              [<Param name="Caudal diseño AF" sub="Red agua fría" />, <LazyInp field="qac" ariaLabel="Caudal diseño AF" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Caudal probable de la red de agua fría. Obtenido del diseño hidráulico.</Comment>],
              [<Param name="Caudal diseño ACS" sub="Red agua caliente" />, <LazyInp field="qasc" ariaLabel="Caudal diseño ACS" />, "L/s", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Hunter / RAS 2000</span> · Típico 60–70% del Qac. Del diseño de red ACS.</Comment>],
            ]} />
          </Card>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/presiones_y_cotas.webp" iconImgStyle={{ width: 22, height: 22 }} title="Presiones y cotas" subtitle="NTC 1500 + levantamiento" bodyStyle={{ padding: 0 }}>
            <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              ...(isRed ? [[
                <Param name="Presión acometida" sub="Red pública en entrega" />,
                <LazyInp field="pred" ariaLabel="Presión acometida" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Medida en campo</span> · Usar convertidor 1. Ej: 200 kPa = 20.39 m.c.a.</Comment>
              ]] as any[][] : []),
              [
                <Param name="Presión mínima punto crítico" sub="Aparato más desfavorable" />,
                <LazyInp field="pmin" ariaLabel="Presión mínima punto crítico" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NTC 1500 Tab.3</span> · Mín. 5.0 (49 kPa). Ducha confort: 7.13. Flujómetro: 10.70.</Comment>
              ],
              [
                <Param name="Presión máxima sistema" sub="Límite 500 kPa = 51.0 m.c.a." />,
                <LazyInp field="pmax" ariaLabel="Presión máxima sistema" />,
                "m.c.a.",
                <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>NSR-10 H.4.2</span> · Instalar RRP si Pred supera este valor.</Comment>
              ],
              [
                <Param name="Cota bomba" />,
                <LazyInp field="zbomba" ariaLabel="Cota bomba" />,
                "m",
                <Comment>Nivel de instalación del equipo. Referencia = 0.00 m.</Comment>
              ],
              [
                <Param name="Cota punto más desfavorable" sub="Piso más alto o aparato más lejano" />,
                <LazyInp field="ztop" ariaLabel="Cota punto más desfavorable" />,
                "m",
                <Comment>Del levantamiento topográfico o planos arquitectónicos.</Comment>
              ],
            ]} />
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/perdidas_de_carga.webp" iconImgStyle={{ width: 22, height: 22 }} title="Pérdidas de carga" subtitle="Del diseño de redes" bodyStyle={{ padding: 0 }}>
            <Tbl thStyle={{ fontSize: 13 }} tdStyle={{ fontSize: 14 }} tdlStyle={{ fontSize: 15 }} cols={["Parámetro", "Valor", "Ud.", "Comentario / Referencia"]} rows={[
              [<Param name="Pérdidas red AF" sub="Tramos + accesorios" />, <LazyInp field="hfac" ariaLabel="Pérdidas red AF" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · Sumatoria pérdidas tramo más desfavorable de la red AC.</Comment>],
              [<Param name="Pérdidas red ACS" sub="Tramos + accesorios" />, <LazyInp field="hfacs" ariaLabel="Pérdidas red ACS" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Darcy-Weisbach</span> · El módulo usa MAX(Hf_ac, Hf_acs) como pérdida crítica de diseño.</Comment>],
              [<Param name="Pérdidas adicionales" sub="Intercambiador, filtros, zonas" />, <LazyInp field="hfotros" ariaLabel="Pérdidas adicionales" />, "m.c.a.", <Comment><span style={{ color: "var(--txt3)", fontWeight: 600 }}>Opcional</span> · Calentador, filtros multimedia, válvulas de zona u otros no incluidos en el diseño de redes.</Comment>],
            ]} />
          </Card>
          <Card style={FLEX_COL} iconImg="/iconos_diseno_redes/equipos/config_bombas.webp" iconImgStyle={{ width: 22, height: 22 }} title="Configuración de bombas" bodyStyle={{ padding: 6, display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 4, fontWeight: 600 }}>Bombas en trabajo</div>
                <div style={{ padding: "2px 0" }}>
                  <LazyInp field="nt" ariaLabel="Bombas en trabajo" style={{ ...SI, fontSize: 14, padding: "6px 8px", fontWeight: 700 }} />
                </div>
                <div style={{ fontSize: 9, color: "var(--txt4)", marginTop: 4 }}>Operan simultáneamente en régimen normal</div>
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg2)", padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 4, fontWeight: 600 }}>Bombas en reserva</div>
                <div style={{ padding: "2px 0" }}>
                  <LazyInp field="nr" ariaLabel="Bombas en reserva" style={{ ...SI, fontSize: 14, padding: "6px 8px", fontWeight: 700 }} />
                </div>
                <div style={{ fontSize: 9, color: "var(--txt4)", marginTop: 4 }}>Reserva · arranque automático por falla</div>
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
          </Card>
        </div>
      </div>
    </div>
  );
}
export default React.memo(EPInputPage);