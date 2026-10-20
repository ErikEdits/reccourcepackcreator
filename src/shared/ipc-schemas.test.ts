import { describe, expect, it } from 'vitest'
import { IpcChannel } from './channels'
import { ipcArgs } from './ipc-schemas'

describe('ipcArgs', () => {
  it('has a schema for every channel', () => {
    expect(Object.keys(ipcArgs).sort()).toEqual(Object.values(IpcChannel).sort())
  })

  it('rejects extra arguments on argument-less channels', () => {
    expect(ipcArgs[IpcChannel.WindowClose].safeParse([]).success).toBe(true)
    expect(ipcArgs[IpcChannel.WindowClose].safeParse(['surprise']).success).toBe(false)
  })

  it('accepts only a bounded string for openExternal', () => {
    const schema = ipcArgs[IpcChannel.ShellOpenExternal]
    expect(schema.safeParse(['https://minecraft.wiki/']).success).toBe(true)
    expect(schema.safeParse([42]).success).toBe(false)
    expect(schema.safeParse([]).success).toBe(false)
    expect(schema.safeParse([`https://x.test/${'a'.repeat(3000)}`]).success).toBe(false)
  })
})
