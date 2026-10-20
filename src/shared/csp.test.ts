import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from './csp'

function directive(policy: string, name: string): string | undefined {
  return policy
    .split('; ')
    .find((entry) => entry.startsWith(`${name} `))
    ?.slice(name.length + 1)
}

describe('buildContentSecurityPolicy', () => {
  it('forbids inline scripts and styles in production', () => {
    const policy = buildContentSecurityPolicy('production')
    expect(directive(policy, 'script-src')).toBe("'self'")
    expect(directive(policy, 'style-src')).toBe("'self'")
    expect(policy).not.toContain('unsafe')
  })

  it('denies everything not listed and never allows plugins or frames', () => {
    const policy = buildContentSecurityPolicy('production')
    expect(directive(policy, 'default-src')).toBe("'none'")
    expect(directive(policy, 'object-src')).toBe("'none'")
    expect(directive(policy, 'frame-src')).toBe("'none'")
  })

  it('allows the dev server hot-reload socket only in development', () => {
    expect(directive(buildContentSecurityPolicy('development'), 'connect-src')).toContain(
      'ws://localhost:*',
    )
    expect(directive(buildContentSecurityPolicy('production'), 'connect-src')).toBe("'self'")
  })
})
