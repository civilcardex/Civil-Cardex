import { createContext, useContext } from 'react'
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine'

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  bajante: any;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
}

export interface BajanteContextMenuContextValue {
  contextMenuState: ContextMenuState
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
  bajante: any
  selectedNivel: number | null
  pisos: any[]
  engineRef: React.MutableRefObject<PlanoEngine | null>
  selElement: Record<string, any> | null
  setSelElement: (el: Record<string, any> | null) => void
  lowerFloorsRamales: any[]
  planosCtx: { plans: any[] }
  mats: Record<string, any[]>
  activeNet: string
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export const BajanteContextMenuCtx = createContext<BajanteContextMenuContextValue | null>(null)

export function useBajanteContextMenu(): BajanteContextMenuContextValue {
  const ctx = useContext(BajanteContextMenuCtx)
  if (!ctx) throw new Error('useBajanteContextMenu must be used within BajanteContextMenuProvider')
  return ctx
}
