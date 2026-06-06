import { describe, it, expect } from 'vitest'
import { safeParse } from '../parseUtils'

describe('safeParse', () => {
  it('safeParse(\'{"a":1}\', {}) retorna {a:1}', () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('safeParse(\'invalid\', {default: true}) retorna el fallback', () => {
    expect(safeParse('invalid', { default: true })).toEqual({ default: true })
  })

  it('safeParse(null, []) retorna []', () => {
    expect(safeParse(null, [])).toEqual([])
  })

  it('safeParse(\'"hello"\', \'\') retorna "hello"', () => {
    expect(safeParse('"hello"', '')).toBe('hello')
  })
})
