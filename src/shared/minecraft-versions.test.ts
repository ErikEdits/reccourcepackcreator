import { describe, expect, it } from 'vitest'
import {
  findVersion,
  formatLabel,
  groupByFormat,
  LATEST_VERSION,
  MINECRAFT_VERSIONS,
  versionRangeLabel,
} from './minecraft-versions'

describe('MINECRAFT_VERSIONS', () => {
  it('starts at 1.6.1, the first release with resource packs', () => {
    expect(MINECRAFT_VERSIONS[0]).toEqual({ id: '1.6.1', format: { major: 1, minor: 0 } })
  })

  it('lists every release once', () => {
    const ids = MINECRAFT_VERSIONS.map((version) => version.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never lets the pack format go backwards', () => {
    for (let i = 1; i < MINECRAFT_VERSIONS.length; i++) {
      const previous = MINECRAFT_VERSIONS[i - 1].format
      const current = MINECRAFT_VERSIONS[i].format
      expect(current.major * 1000 + current.minor).toBeGreaterThanOrEqual(
        previous.major * 1000 + previous.minor,
      )
    }
  })

  it.each([
    ['1.8.9', 1],
    ['1.10.2', 2],
    ['1.12.2', 3],
    ['1.13.2', 4],
    ['1.16.5', 6],
    ['1.20.1', 15],
    ['1.21.4', 46],
  ])('knows that %s uses pack format %i', (id, major) => {
    expect(findVersion(id)?.format.major).toBe(major)
  })

  it('ends with the newest release', () => {
    expect(LATEST_VERSION).toBe(MINECRAFT_VERSIONS[MINECRAFT_VERSIONS.length - 1])
  })
})

describe('groupByFormat', () => {
  it('puts consecutive versions with the same format together', () => {
    const versions = ['1.20.2', '1.20.3', '1.20.4', '1.20.5'].map((id) => findVersion(id)!)
    const groups = groupByFormat(versions)
    expect(groups.map((group) => group.versions.map((version) => version.id))).toEqual([
      ['1.20.2'],
      ['1.20.3', '1.20.4'],
      ['1.20.5'],
    ])
  })
})

describe('labels', () => {
  it('shows minor format versions only when they exist', () => {
    expect(formatLabel({ major: 46, minor: 0 })).toBe('46')
    expect(formatLabel({ major: 97, minor: 1 })).toBe('97.1')
  })

  it('describes a run of versions as a range', () => {
    expect(versionRangeLabel([findVersion('1.21.4')!])).toBe('1.21.4')
    expect(versionRangeLabel([findVersion('1.6.1')!, findVersion('1.8.9')!])).toBe('1.6.1-1.8.9')
  })
})
