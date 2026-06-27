export function checkActiveNet(engine: any, netId: string): boolean {
  const activeNets = (engine as any).activeNetworks as Set<string> | undefined;
  return activeNets ? activeNets.has(netId) : true;
}
