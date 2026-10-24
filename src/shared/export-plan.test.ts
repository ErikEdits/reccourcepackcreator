import { describe, expect, it } from 'vitest'
import { planExport } from './export-plan'

const project = { name: 'Pack', packVersion: '1.0.0' }
const template = '{name}_MC{mc}'

describe('planExport', () => {
  it('makes one ZIP per version by default, oldest first', () => {
    const plan = planExport(project, {
      versions: ['1.20.4', '1.20.3', '1.21.4'],
      combineSameFormat: false,
      fileNameTemplate: template,
    })
    expect(plan.units.map((unit) => unit.fileName)).toEqual([
      'Pack_MC1.20.3.zip',
      'Pack_MC1.20.4.zip',
      'Pack_MC1.21.4.zip',
    ])
    expect(plan.hasDuplicateNames).toBe(false)
  })

  it('can combine versions that share a pack format', () => {
    const plan = planExport(project, {
      versions: ['1.20.3', '1.20.4', '1.21.4'],
      combineSameFormat: true,
      fileNameTemplate: template,
    })
    expect(plan.units.map((unit) => unit.fileName)).toEqual([
      'Pack_MC1.20.3-1.20.4.zip',
      'Pack_MC1.21.4.zip',
    ])
  })

  it('keeps versions with different texture names apart even when the format matches', () => {
    const plan = planExport(project, {
      versions: ['1.6.4', '1.7.2', '1.8.9'],
      combineSameFormat: true,
      fileNameTemplate: template,
    })
    expect(plan.units.map((unit) => unit.fileName)).toEqual([
      'Pack_MC1.6.4.zip',
      'Pack_MC1.7.2-1.8.9.zip',
    ])
  })

  it('flags templates that would give several ZIPs the same name', () => {
    const plan = planExport(project, {
      versions: ['1.20.3', '1.21.4'],
      combineSameFormat: false,
      fileNameTemplate: '{name}',
    })
    expect(plan.hasDuplicateNames).toBe(true)
  })

  it('ignores unknown versions', () => {
    const plan = planExport(project, {
      versions: ['0.1', '1.21.4'],
      combineSameFormat: false,
      fileNameTemplate: template,
    })
    expect(plan.units).toHaveLength(1)
  })
})
