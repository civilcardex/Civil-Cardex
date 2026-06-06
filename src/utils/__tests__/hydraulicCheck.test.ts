import { describe, it, expect } from 'vitest'
import { calcHydraulicCheck } from '../hydraulicCheck'

describe('calcHydraulicCheck', () => {
  const params = {
    Q: 5,
    S: 0.02,
    n: 0.009,
    DintMm: 110,
    V_MIN: 0.45,
    V_MAX: 4.0,
    Y_D_MAX: 0.75,
    FUERZA_TRACTIVA_MIN: 0.15,
  }

  it('retorna todos los campos del resultado', () => {
    const result = calcHydraulicCheck(params)
    expect(result).toHaveProperty('Qo')
    expect(result).toHaveProperty('Vo')
    expect(result).toHaveProperty('qqo')
    expect(result).toHaveProperty('Vreal')
    expect(result).toHaveProperty('chequeoV')
    expect(result).toHaveProperty('Yc')
    expect(result).toHaveProperty('Yn')
    expect(result).toHaveProperty('Froude')
    expect(result).toHaveProperty('tipoFlujo')
    expect(result).toHaveProperty('Ymax')
    expect(result).toHaveProperty('chequeoYn')
    expect(result).toHaveProperty('fuerzaTractiva')
    expect(result).toHaveProperty('chequeoFT')
  })

  it('calcula Qo y Vo positivos para tuberia tipica', () => {
    const result = calcHydraulicCheck(params)
    expect(result.Qo).toBeGreaterThan(0)
    expect(result.Vo).toBeGreaterThan(0)
  })

  it('qqo es razonable (entre 0 y 1)', () => {
    const result = calcHydraulicCheck(params)
    expect(result.qqo).toBeGreaterThan(0)
    expect(result.qqo).toBeLessThan(1)
  })

  it('chequeoV es O.K. para valores tipicos', () => {
    const result = calcHydraulicCheck(params)
    expect(result.chequeoV).toBe('O.K.')
  })

  it('Yc y Yn son positivos', () => {
    const result = calcHydraulicCheck(params)
    expect(result.Yc).toBeGreaterThan(0)
    expect(result.Yn).toBeGreaterThan(0)
  })

  it('Froude es un valor razonable', () => {
    const result = calcHydraulicCheck(params)
    expect(result.Froude).toBeGreaterThan(0)
    expect(result.Froude).toBeLessThan(10)
  })

  it('tipoFlujo es un valor valido', () => {
    const result = calcHydraulicCheck(params)
    expect(['Subcrítico', 'Crítico', 'Supercrítico']).toContain(result.tipoFlujo)
  })
})
