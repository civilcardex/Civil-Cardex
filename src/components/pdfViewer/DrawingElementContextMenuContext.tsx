import { createContext, useContext } from 'react'
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine'

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  element: any; // was bajante
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
}

export interface DrawingElementContextMenuContextValue {
  contextMenuState: ContextMenuState
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
  element: any // was bajante
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

export const DrawingElementContextMenuCtx = createContext<DrawingElementContextMenuContextValue | null>(null)

export function useDrawingElementContextMenu(): DrawingElementContextMenuContextValue {
  const ctx = useContext(DrawingElementContextMenuCtx)
  if (!ctx) throw new Error('useDrawingElementContextMenu must be used within DrawingElementContextMenuProvider')
  return ctx
}
