import WorkArea from '../components/WorkAreaCivilFlow'
import { usePageMeta } from '../hooks/usePageMeta'

function WorkAreaCivilFlowPage() {
  usePageMeta('Área de trabajo', 'Área de trabajo de CivilCore. Diseño de redes hidráulicas, sanitarias, gas, aguas lluvias y equipos a presión.');
  return (
    <div className="h-full">
      <WorkArea />
    </div>
  )
}

export default WorkAreaCivilFlowPage
