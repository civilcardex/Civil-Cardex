import { describe, it, expect } from 'vitest'
import { diamPulgFromLabel } from '../diamPulgFromLabel'

describe('diamPulgFromLabel', () => {
  it('parses integers and decimals with double quotes', () => {
    expect(diamPulgFromLabel('2"')).toBe(2)
    expect(diamPulgFromLabel('1.5"')).toBe(1.5)
  })

  it('parses space-separated fractions with double quotes', () => {
    expect(diamPulgFromLabel('1 1/2"')).toBe(1.5)
    expect(diamPulgFromLabel('2 3/4"')).toBe(2.75)
  })

  it('parses simple fractions with double quotes', () => {
    expect(diamPulgFromLabel('1/2"')).toBe(0.5)
    expect(diamPulgFromLabel('3/4"')).toBe(0.75)
  })

  it('parses Unicode fractions', () => {
    expect(diamPulgFromLabel('½"')).toBe(0.5)
    expect(diamPulgFromLabel('1½"')).toBe(1.5)
    expect(diamPulgFromLabel('½')).toBe(0.5)
    expect(diamPulgFromLabel('1½')).toBe(1.5)
    expect(diamPulgFromLabel('1 ½"')).toBe(1.5)
    expect(diamPulgFromLabel('1 ½')).toBe(1.5)
  })

  it('parses values without double quotes as fallback', () => {
    expect(diamPulgFromLabel('1 1/2')).toBe(1.5)
    expect(diamPulgFromLabel('3/4')).toBe(0.75)
    expect(diamPulgFromLabel('1.5')).toBe(1.5)
    expect(diamPulgFromLabel('2')).toBe(2)
  })

  it('handles spaces and different dash types', () => {
    expect(diamPulgFromLabel('1 - 1/2')).toBe(1.5)
  })

  it('returns 0 for empty or invalid values', () => {
    expect(diamPulgFromLabel('')).toBe(0)
    expect(diamPulgFromLabel(null)).toBe(0)
    expect(diamPulgFromLabel('abc')).toBe(0)
  })
})
