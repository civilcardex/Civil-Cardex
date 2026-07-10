import { createContext } from 'react'
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine'

export interface TramoEditorContextValue {
  engineRef: React.MutableRefObject<PlanoEngine | null>
  selElement: any
  setSelElement: React.Dispatch<React.SetStateAction<any>>
  activeNet: string
  handleUpdateSel: (field: string, value: any) => void
  handleRotateLabel: () => void
  diamSel: Record<string, string>
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  gasMatSel: Record<string, string>
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  pendSel: Record<string, number>
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>
  pendInput: string
  setPendInput: React.Dispatch<React.SetStateAction<string>>
  mats: Record<string, Array<{ val: string }>> | null
  matLongName: (short: string) => string
  plans?: any[]
  pisos?: any[]
}

export const TramoEditorCtx = createContext<TramoEditorContextValue | null>(null)
