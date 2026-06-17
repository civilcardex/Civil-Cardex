import React from 'react'
import WorkArea from '../components/WorkAreaCivilFlow'
import { usePageMeta } from '../hooks/usePageMeta'

function WorkAreaCivilFlowPage() {
  usePageMeta('Area de Trabajo', 'Area de trabajo de CivilCore. Diseno de redes hidraulicas, sanitarias, gas, aguas lluvias y equipos a presion.');
  return (
    <div className="h-full">
      <WorkArea />
    </div>
  )
}

export default WorkAreaCivilFlowPage
