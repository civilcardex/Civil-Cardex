import WorkAreaCivilManager from '../modules/civilmanager/WorkAreaCivilManager'
import { usePageMeta } from '../hooks/usePageMeta'

const WorkAreaCivilManagerPage_S1: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };

function WorkAreaCivilManagerPage() {
  usePageMeta('Área de trabajo CivilManager', 'Presupuestos de obra civil: catálogos, análisis de precios unitarios (APU) y presupuestos con AIU.');
  return (
    <div className="h-full">
      <h1 style={WorkAreaCivilManagerPage_S1}>
        Área de trabajo CivilManager
      </h1>
      <WorkAreaCivilManager />
    </div>
  )
}

export default WorkAreaCivilManagerPage
