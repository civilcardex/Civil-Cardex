import WorkArea from '../components/WorkAreaCivilFlow';
import { usePageMeta } from '../../../hooks/usePageMeta';
const WorkAreaCivilFlowPage_S1: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function WorkAreaCivilFlowPage() {
  usePageMeta(
    'Área de trabajo',
    'Área de trabajo de CivilCardex. Diseño de redes hidráulicas, sanitarias, gas, aguas lluvias y equipos a presión.',
  );
  return (
    <div className="h-full">
      <h1 style={WorkAreaCivilFlowPage_S1}>Área de trabajo</h1>
      <WorkArea />
    </div>
  );
}

export default WorkAreaCivilFlowPage;
