import WaterNetworkDesign from "./WaterNetworkDesign";
import { DIAMETROS_AF } from "../utils/calcHydraulics";
import { lookupInterno } from "../utils/accesoriosUtils";

export default function DisenoRedAguaFria() {
  return <WaterNetworkDesign networkType="af" diamTable={DIAMETROS_AF} lookupFn={lookupInterno as any} />;
}
