import { describe, it, expect } from 'vitest'
import {
  factorSimultaneidad,
  caudalHunterLPS,
  caudalTuboLleno,
  velocidadTuboLleno,
  diametroManning,
  GRAVEDAD,
  manning_SAN,
} from '../calcSanitary'

describe('factorSimultaneidad', () => {
  it('numSalidas=1 retorna 1', () => {
    expect(factorSimultaneidad(1)).toBe(1)
  })

  it('numSalidas=4 retorna 1/sqrt(3) ≈ 0.577', () => {
    const result = factorSimultaneidad(4)
    expect(result).toBeCloseTo(1 / Math.sqrt(3), 4)
  })

  it('numSalidas=0 retorna 1 (numSalidas <= 1)', () => {
    expect(factorSimultaneidad(0)).toBe(1)
  })
})

describe('caudalHunterLPS', () => {
  it('UD=10, K=1 usa rama UD < 240', () => {
    const result = caudalHunterLPS(10, 1)
    const expected = 1 * 0.1163 * Math.pow(10, 0.6875)
    expect(result).toBeCloseTo(expected, 6)
  })

  it('UD=240, K=1 usa rama UD >= 240', () => {
    const result = caudalHunterLPS(240, 1)
    const expected = 1 * 0.074 * Math.pow(240, 0.7504)
    expect(result).toBeCloseTo(expected, 6)
  })

  it('UD=1000, K=0.5 usa rama UD >= 240', () => {
    const result = caudalHunterLPS(1000, 0.5)
    const expected = 0.5 * 0.074 * Math.pow(1000, 0.7504)
    expect(result).toBeCloseTo(expected, 6)
  })
})

describe('Manning functions', () => {
  it('caudalTuboLleno computes correctly', () => {
    const Q = caudalTuboLleno(0.1, 0.009, 0.02)
    expect(Q).toBeGreaterThan(0)
  })

  it('caudalTuboLleno returns 0 for D_m <= 0', () => {
    expect(caudalTuboLleno(0, 0.009, 0.02)).toBe(0)
  })

  it('caudalTuboLleno returns 0 for S <= 0', () => {
    expect(caudalTuboLleno(0.1, 0.009, 0)).toBe(0)
  })

  it('velocidadTuboLleno computes correctly', () => {
    const V = velocidadTuboLleno(0.1, 0.009, 0.02)
    expect(V).toBeGreaterThan(0)
  })

  it('velocidadTuboLleno returns 0 for D_m <= 0', () => {
    expect(velocidadTuboLleno(0, 0.009, 0.02)).toBe(0)
  })

  it('diametroManning returns a positive value for valid inputs', () => {
    const D = diametroManning(0.005, 0.009, 0.02)
    expect(D).toBeGreaterThan(0)
  })

  it('diametroManning returns 0 for S <= 0', () => {
    expect(diametroManning(0.005, 0.009, 0)).toBe(0)
  })
})
