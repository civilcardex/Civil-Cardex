/* eslint-disable react-hooks/refs */
import { useMemo } from "react";
import { pisoLbl } from "../../constants";
import TipoTramoSelector from "./TipoTramoSelector";
import TramoEditor from "./TramoEditor";
import BajanteAsociacion from "./BajanteAsociacion";
import PdfViewerDrawnElements from "./PdfViewerDrawnElements";
import { CopyFromPlanPanel } from "./CopyFromPlanPanel";
import AparatosPanel from "../FixturesPanel";

interface PdfViewerSidebarRightProps {
  dynamicRightStyle: React.CSSProperties;
  selectedNivel: number | null;
  onSelectNivel: (nivel: number | null, idx: number) => void;
  pisos: any[];
  planos: any[];
  rightSidebarOpacity: React.CSSProperties;
  tipoTramo: string;
  setTipoTramo: React.Dispatch<React.SetStateAction<string>>;
  padreTributarioId: string | null;
  setPadreTributarioId: React.Dispatch<React.SetStateAction<string | null>>;
  drawnElements: any[];
  engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  activeNet: string;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, any[]>;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  handleUpdateSel: (field: string, value: any) => void;
  handleRotateLabel: () => void;
  lowerFloorsRamales: any[];
  planosCtx: { plans: any[] };
  scaleText: React.ReactNode;
  currentId: string | undefined;
  currentIdRef: React.MutableRefObject<string | undefined>;
  finalVisibleNets: any[];
}

export default function PdfViewerSidebarRight(props: PdfViewerSidebarRightProps) {
  const {
    dynamicRightStyle, selectedNivel, onSelectNivel, pisos, planos,
    rightSidebarOpacity, tipoTramo, setTipoTramo, padreTributarioId, setPadreTributarioId,
    drawnElements, engineRef, selElement, activeNet,
    diamSel, gasMatSel, pendSel, pendInput, mats, matLongName,
    setDiamSel, setGasMatSel, setPendSel, setPendInput, setSelElement,
    handleUpdateSel, handleRotateLabel,
    lowerFloorsRamales, planosCtx, scaleText, currentId, currentIdRef, finalVisibleNets,
  } = props;

  const planoAsocInfo = useMemo(() => {
    if (selectedNivel === null) return null;
    const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
    if (!planoAsoc) return null;
    return (
      <div style={{marginTop:8,padding:'6px 10px',background:'#1e2024',borderRadius:3,border:'1px solid rgba(0,220,229,.2)'}}>
        <div style={{fontSize:11,color:'#00dce5',fontFamily:"'Geist',monospace",fontWeight:600,display:'flex',alignItems:'center',gap:4}}>📄 {planoAsoc.name}</div>
        <div style={{fontSize:10,color:'#6b8cae',fontFamily:"'Geist',monospace",marginTop:2}}>Escala 1:{planoAsoc.scale}</div>
      </div>
    );
  }, [selectedNivel, planos]);

  return (
    <div className="visor-sidebar-right" style={dynamicRightStyle}>
      <h2 style={{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Panel de edición</h2>
      {/* Nivel — always enabled */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Nivel</div>
        <select aria-label="Seleccionar nivel" value={selectedNivel??''} onChange={e=>{
          const v=e.target.value?Number(e.target.value):null;
          onSelectNivel(v, v !== null ? planos.findIndex(p => p.nivel === v && p.status === 'confirmed') : -1);
        }}
          style={{width:'100%',padding:"5px 8px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:12,fontFamily:"'Geist',monospace",cursor:'pointer'}}>
          <option value="">— Seleccionar piso —</option>
          {[...pisos].sort((a,b)=>b.n-a.n).map(s=>{
            const tienePlano=planos.some(p=>p.nivel===s.n&&p.status==='confirmed');
            return <option key={s.id} value={s.n}>{tienePlano?'🟢 ':''}{pisoLbl(s.n)} ({s.npt} m)</option>;
          })}
        </select>
        {planoAsocInfo}
      </div>

      <CopyFromPlanPanel
        engineRef={engineRef}
        currentId={currentId}
        currentIdRef={currentIdRef}
        planosCtx={planosCtx}
        pisos={pisos}
        visibleNets={finalVisibleNets}
      />

      {/* Rest of sidebar — blocked when selecting without element selected */}
      <div style={rightSidebarOpacity}>

      <TipoTramoSelector
        tipoTramo={tipoTramo}
        setTipoTramo={setTipoTramo}
        padreTributarioId={padreTributarioId}
        setPadreTributarioId={setPadreTributarioId}
        drawnElements={drawnElements}
        engineRef={engineRef}
      />

      <TramoEditor
        selElement={selElement}
        activeNet={activeNet}
        engineRef={engineRef}
        diamSel={diamSel}
        gasMatSel={gasMatSel}
        pendSel={pendSel}
        pendInput={pendInput}
        mats={mats}
        matLongName={matLongName}
        setDiamSel={setDiamSel}
        setGasMatSel={setGasMatSel}
        setPendSel={setPendSel}
        setPendInput={setPendInput}
        setSelElement={setSelElement}
        handleUpdateSel={handleUpdateSel}
        handleRotateLabel={handleRotateLabel}
        plans={planosCtx.plans}
        pisos={pisos}
      />

      <BajanteAsociacion
        selElement={selElement}
        setSelElement={setSelElement}
        selectedNivel={selectedNivel}
        pisoLbl={pisoLbl}
        lowerFloorsRamales={lowerFloorsRamales}
        planosCtx={planosCtx}
        engineRef={engineRef}
      />

      {!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.tipo === 'area' || selElement.id?.startsWith('AR'))) && (
      <AparatosPanel activeNet={activeNet} selElement={selElement} planId={currentId} />
      )}

      <PdfViewerDrawnElements
        drawnElements={drawnElements}
        activeNet={activeNet}
        selElement={selElement}
        engineRef={engineRef}
      />

      <div style={{flex:1}}/>
    </div>
    </div>
  );
}
