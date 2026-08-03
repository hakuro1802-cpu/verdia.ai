import { describe, expect, it } from 'vitest'
import { getGreeting } from './greeting'

describe('getGreeting', () => {
  it('returns the default verdia.ai greeting', () => {
    expect(getGreeting()).toBe('Hello from verdia.ai')
  })

  it('returns a custom greeting', () => {
    expect(getGreeting('developer')).toBe('Hello from developer')
  })
})
