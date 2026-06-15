import WaterNetworkDesign from "./WaterNetworkDesign";
import { DIAMETROS_AF, DIAMETROS_AC } from "../utils/calcHydraulics";
import { lookupInterno, lookupInternoAC } from "../utils/accesoriosUtils";

interface WaterNetworkDesignWrapperProps {
  type: "af" | "ac";
}

export default function WaterNetworkDesignWrapper({ type }: WaterNetworkDesignWrapperProps) {
  return (
    <WaterNetworkDesign
      networkType={type}
      diamTable={type === "af" ? DIAMETROS_AF : DIAMETROS_AC}
      lookupFn={(type === "af" ? lookupInterno : lookupInternoAC) as any}
    />
  );
}
