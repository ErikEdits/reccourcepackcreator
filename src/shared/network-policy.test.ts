import { describe, expect, it } from 'vitest'
import { classifyExternalLink, isAllowedNetworkUrl } from './network-policy'

describe('isAllowedNetworkUrl', () => {
  it('allows HTTPS requests to listed hosts', () => {
    expect(
      isAllowedNetworkUrl('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'),
    ).toBe(true)
    expect(isAllowedNetworkUrl('https://api.modrinth.com/v2/project/abc')).toBe(true)
  })

  it('rejects plain HTTP even for listed hosts', () => {
    expect(isAllowedNetworkUrl('http://api.modrinth.com/v2/project/abc')).toBe(false)
  })

  it('rejects unlisted hosts and look-alike subdomains', () => {
    expect(isAllowedNetworkUrl('https://example.com/')).toBe(false)
    expect(isAllowedNetworkUrl('https://api.modrinth.com.evil.test/')).toBe(false)
    expect(isAllowedNetworkUrl('https://evil.github.com/')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(isAllowedNetworkUrl('not a url')).toBe(false)
  })
})

describe('classifyExternalLink', () => {
  it('opens trusted HTTPS sites directly, including their subdomains', () => {
    expect(classifyExternalLink('https://minecraft.wiki/w/Resource_pack')).toBe('open')
    expect(classifyExternalLink('https://docs.modrinth.com/')).toBe('open')
  })

  it('asks before opening unknown or unencrypted sites', () => {
    expect(classifyExternalLink('https://example.com/')).toBe('confirm')
    expect(classifyExternalLink('http://minecraft.wiki/')).toBe('confirm')
  })

  it('blocks every non-web protocol', () => {
    expect(classifyExternalLink('file:///etc/passwd')).toBe('block')
    expect(classifyExternalLink('javascript:alert(1)')).toBe('block')
    expect(classifyExternalLink('ms-settings:privacy')).toBe('block')
  })

  it('blocks links carrying credentials', () => {
    expect(classifyExternalLink('https://user:pass@github.com/')).toBe('block')
  })
})
