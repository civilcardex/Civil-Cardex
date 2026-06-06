import { describe, it, expect } from 'vitest'
import {
  getLe,
  velocidadReal,
  perdidaHazenWilliams,
  presionNudo,
  verificarVelocidad,
  verificarPresion,
  COEF_HAZEN_PVC,
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

describe('velocidadReal', () => {
  it('calcula velocidad correctamente', () => {
    const V = velocidadReal(0.001, 0.05)
    // Q = 0.001 m3/s, D = 0.05 m => A = pi*D^2/4
    const A = Math.PI * 0.05 * 0.05 / 4
    const expected = 0.001 / A
    expect(V).toBeCloseTo(expected, 4)
  })

  it('retorna 0 para D_m <= 0', () => {
    expect(velocidadReal(0.001, 0)).toBe(0)
  })

  it('retorna 0 para Q_m3s <= 0', () => {
    expect(velocidadReal(0, 0.05)).toBe(0)
  })
})

describe('perdidaHazenWilliams', () => {
  it('calcula perdida por friccion', () => {
    const hf = perdidaHazenWilliams(0.001, 10, 0.05, COEF_HAZEN_PVC)
    expect(hf).toBeGreaterThan(0)
  })

  it('retorna 0 para Q_m3s <= 0', () => {
    expect(perdidaHazenWilliams(0, 10, 0.05, COEF_HAZEN_PVC)).toBe(0)
  })

  it('retorna 0 para L_m <= 0', () => {
    expect(perdidaHazenWilliams(0.001, 0, 0.05, COEF_HAZEN_PVC)).toBe(0)
  })
})

describe('presionNudo', () => {
  it('calcula presion en nudo correctamente', () => {
    const P = presionNudo(20, 3, 1.5)
    expect(P).toBe(21.5)
  })
})

describe('verificarVelocidad', () => {
  it('retorna cumple true para velocidad dentro del rango', () => {
    const result = verificarVelocidad(1.5)
    expect(result.cumple).toBe(true)
    expect(result.mensaje).toBe('OK')
  })

  it('retorna cumple false para velocidad baja', () => {
    const result = verificarVelocidad(0.3)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('sedimentacion')
  })

  it('retorna cumple false para velocidad alta', () => {
    const result = verificarVelocidad(4.0)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('golpe de ariete')
  })
})

describe('verificarPresion', () => {
  it('retorna cumple true para presion suficiente', () => {
    const result = verificarPresion(5.0, 1.0)
    expect(result.cumple).toBe(true)
  })

  it('retorna cumple false para presion insuficiente', () => {
    const result = verificarPresion(0.3, 1.0)
    expect(result.cumple).toBe(false)
    expect(result.mensaje).toContain('INSUFICIENTE')
  })
})
