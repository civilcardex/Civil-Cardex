import WaterNetworkDesign from "./WaterNetworkDesign";
import { DIAMETROS_AC } from "../utils/calcHydraulics";
import { lookupInternoAC } from "../utils/accesoriosUtils";

export default function DisenoRedAguaCaliente() {
  return <WaterNetworkDesign networkType="ac" diamTable={DIAMETROS_AC} lookupFn={lookupInternoAC as any} />;
}
