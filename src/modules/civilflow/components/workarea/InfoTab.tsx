import React from "react";
import type { useWorkAreaState } from "../useWorkAreaState";
import ProjectIdCard from "./infoTab/ProjectIdCard";
import ActiveNetsCard from "./infoTab/ActiveNetsCard";
import ActiveEquiposCard from "./infoTab/ActiveEquiposCard";
import FloorGeneratorCard from "./infoTab/FloorGeneratorCard";
import LevelsCard from "./infoTab/LevelsCard";
import UsageGuideCard from "./infoTab/UsageGuideCard";

const InfoTab_S2: React.CSSProperties = { flexShrink: 0, padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, };
const InfoTab_S3: React.CSSProperties = { background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 8px', flexShrink: 0 };
const InfoTab_S4: React.CSSProperties = { display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 6, flex: 1, minHeight: 0, overflowY: 'hidden', overflowX: 'auto', alignItems: 'stretch' };

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface InfoTabProps {
  state: WorkAreaState;
}

function InfoTab({ state }: InfoTabProps) {
  const {
    proy, setP,
    redes, setRedes, netColors, setNetColors,
    nSotanos, nPisos, altPiso, altSotano, nptPiso1, conCubierta, setConCubierta,
    generarPisos, alertMsg, setAlertMsg,
    onIntChange, onIntBlur, onDecChange, onDecBlur,
    pisos, delPiso, addPiso, addSotano,
  } = state;

  return (
    <div className="fu info-gral" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {alertMsg && (
        <div role="alert" style={InfoTab_S2}>
          ⚠ {alertMsg}
          <button type="button" onClick={() => setAlertMsg(null)} style={InfoTab_S3}>✕</button>
        </div>
      )}
      <div style={InfoTab_S4}>
        <ProjectIdCard proy={proy} setP={setP} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto' }}>
          <ActiveNetsCard redes={redes} setRedes={setRedes} netColors={netColors} setNetColors={setNetColors} />
          <ActiveEquiposCard redes={redes} setRedes={setRedes} />
        </div>
        <FloorGeneratorCard
          nSotanos={nSotanos} nPisos={nPisos} altPiso={altPiso} altSotano={altSotano} nptPiso1={nptPiso1}
          conCubierta={conCubierta} setConCubierta={setConCubierta}
          onIntChange={onIntChange} onIntBlur={onIntBlur}
          onDecChange={onDecChange} onDecBlur={onDecBlur}
          setNSotanos={state.setNSotanos} setNPisos={state.setNPisos}
          setAltPiso={state.setAltPiso} setAltSotano={state.setAltSotano}
          setNptPiso1={state.setNptPiso1}
          generarPisos={generarPisos}
        />
        <LevelsCard pisos={pisos} delPiso={delPiso} addPiso={addPiso} addSotano={addSotano} setPisos={state.setPisos} />
        <UsageGuideCard />
      </div>
    </div>
  );
}
export default React.memo(InfoTab);
