import { describe, it, expect } from 'vitest'
import { fmtPulg } from '../formatUtils'

describe('fmtPulg', () => {
  it('retorna "—" para valor 0', () => {
    expect(fmtPulg(0)).toBe('—')
  })

  it('retorna "—" para valor negativo', () => {
    expect(fmtPulg(-1)).toBe('—')
  })

  it('retorna entero sin fraccion', () => {
    expect(fmtPulg(2)).toBe('2"')
  })

  it('retorna fraccion sola (sin entero)', () => {
    expect(fmtPulg(0.5)).toBe('½"')
  })

  it('retorna entero + fraccion', () => {
    expect(fmtPulg(1.5)).toBe('1 ½"')
  })

  it('retorna decimal con 2 cifras si no hay fraccion Unicode', () => {
    expect(fmtPulg(1.33)).toBe('1.33"')
  })

  it('soporta 0.75 → ¾"', () => {
    expect(fmtPulg(0.75)).toBe('¾"')
  })

  it('soporta 0.25 → ¼"', () => {
    expect(fmtPulg(0.25)).toBe('¼"')
  })
})
