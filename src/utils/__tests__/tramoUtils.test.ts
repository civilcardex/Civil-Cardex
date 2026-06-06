import { describe, it, expect } from 'vitest'
import { getTributarioIds } from '../tramoUtils'

describe('getTributarioIds', () => {
  it('array vacio retorna Set vacio', () => {
    const result = getTributarioIds([])
    expect(result.size).toBe(0)
  })

  it('array con tramos que tienen recibeDe retorna IDs correctos', () => {
    const tramos = [
      { recibeDe: ['T1', 'T2'] },
      { recibeDe: ['T3'] },
    ]
    const result = getTributarioIds(tramos)
    expect(result).toEqual(new Set(['T1', 'T2', 'T3']))
  })

  it('array con tramos que tienen descripcion con IDs separados por +', () => {
    const tramos = [
      { descripcion: 'T1 + T2' },
      { descripcion: 'T3' },
    ]
    const result = getTributarioIds(tramos)
    expect(result).toEqual(new Set(['T1', 'T2', 'T3']))
  })

  it('mezcla recibeDe y descripcion', () => {
    const tramos = [
      { recibeDe: ['T1'], descripcion: 'T2 + T3' },
    ]
    const result = getTributarioIds(tramos)
    expect(result).toEqual(new Set(['T1', 'T2', 'T3']))
  })

  it('ignora tramos sin recibeDe ni descripcion', () => {
    const tramos = [
      { id: 'X' },
      { recibeDe: ['T1'] },
    ]
    const result = getTributarioIds(tramos)
    expect(result).toEqual(new Set(['T1']))
  })
})
