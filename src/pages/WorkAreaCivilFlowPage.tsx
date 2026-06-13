import React from 'react'
import WorkArea from '../components/WorkAreaCivilFlow'
import { usePageMeta } from '../hooks/usePageMeta'

function WorkAreaCivilFlowPage() {
  usePageMeta('Área de Trabajo');
  return (
    <div className="h-full">
      <WorkArea />
    </div>
  )
}

export default WorkAreaCivilFlowPage
