import { describe, it, expect } from 'vitest'
import {
  getLe,
  realVelocity,
  hazenWilliamsLoss,
  nodePressure,
  checkVelocity,
  checkPressure,
  COEF_HAZEN,
} from '../calcHydraulics'

describe('getLe', () => {
  it('retorna la longitud equivalente para accesorio existente', () => {
    const le = getLe('codo90', 0.5)
    expect(le).toBeGreaterThan(0)
    expect(le).toBeCloseTo(0.36, 2)
  })

  it('retorna 0 para accesorio no existente', () => {
    expect(getLe('noexiste', 0.5)).toBe(0)
  })

  it('retorna valor correcto para Tee salida lateral 1"', () => {
    const le = getLe('teeLat', 1.0)
    expect(le).toBeCloseTo(0.38, 2)
  })
})

describe('realVelocity', () => {
  it('calcula velocidad correctamente', () => {
    const V = realVelocity(0.001, 0.05)
    // Q = 0.001 m3/s, D = 0.05 m => A = pi*D^2/4
    const A = Math.PI * 0.05 * 0.05 / 4
    const expected = 0.001 / A
    expect(V).toBeCloseTo(expected, 4)
  })

  it('retorna 0 para D_m <= 0', () => {
    expect(realVelocity(0.001, 0)).toBe(0)
  })

  it('retorna 0 para Q_m3s <= 0', () => {
    expect(realVelocity(0, 0.05)).toBe(0)
  })
})

describe('hazenWilliamsLoss', () => {
  it('calcula perdida por friccion', () => {
    const hf = hazenWilliamsLoss(0.001, 10, 0.05, COEF_HAZEN)
    expect(hf).toBeGreaterThan(0)
  })

  it('retorna 0 para Q_m3s <= 0', () => {
    expect(hazenWilliamsLoss(0, 10, 0.05, COEF_HAZEN)).toBe(0)
  })

  it('retorna 0 para L_m <= 0', () => {
    expect(hazenWilliamsLoss(0.001, 0, 0.05, COEF_HAZEN)).toBe(0)
  })
})

describe('nodePressure', () => {
  it('calcula presion en nudo correctamente', () => {
    const P = nodePressure(20, 3, 1.5)
    expect(P).toBe(21.5)
  })
})

describe('checkVelocity', () => {
  it('retorna cumple true para velocidad dentro del rango', () => {
    const result = checkVelocity(1.5)
    expect(result.cumple).toBe(true)
    expect(result.mensaje).toBe('OK')
  })

  it('retorna cumple false para velocidad baja', () => {
    const result = checkVelocity(0.3)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('sedimentacion')
  })

  it('retorna cumple false para velocidad alta', () => {
    const result = checkVelocity(4.0)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('golpe de ariete')
  })
})

describe('checkPressure', () => {
  it('retorna cumple true para presion suficiente', () => {
    const result = checkPressure(5.0, 1.0)
    expect(result.cumple).toBe(true)
  })

  it('retorna cumple false para presion insuficiente', () => {
    const result = checkPressure(0.3, 1.0)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('INSUFICIENTE')
  })
})
