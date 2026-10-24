import { useEffect, useState } from 'react'
import type { MinecraftFilesInfo } from '../../../shared/api'
import { formatMegabytes } from '../lib/format'
import { useProject } from '../store/project'
import { Button, Modal } from './ui'

export function SettingsDialog() {
  const setDialog = useProject((state) => state.setDialog)
  const [info, setInfo] = useState<MinecraftFilesInfo | null>(null)

  useEffect(() => {
    void window.api.minecraft.filesInfo().then(setInfo)
  }, [])

  const clearCache = async (): Promise<void> => {
    await window.api.minecraft.clearCache()
    setInfo(await window.api.minecraft.filesInfo())
  }

  return (
    <Modal title="Settings" onClose={() => setDialog(null)} width="max-w-xl">
      <section aria-label="Minecraft files" className="flex flex-col gap-3 text-sm">
        <h3 className="font-medium">Minecraft files</h3>
        {info && (
          <>
            <div>
              <p>Minecraft installation</p>
              <code className="block truncate text-xs text-ink-muted">{info.minecraftDir}</code>
              <p className="text-xs text-ink-muted">
                {info.found
                  ? 'Found. Installed versions are read from here.'
                  : 'Not found. Game files are downloaded from Mojang when a pack needs them.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="flex-1">
                Downloaded game files: <strong>{formatMegabytes(info.cacheBytes)}</strong>
              </p>
              <Button disabled={info.cacheBytes === 0} onClick={() => void clearCache()}>
                Delete downloads
              </Button>
            </div>
          </>
        )}
        <p className="text-xs text-ink-muted">
          Minecraft&apos;s own textures are only shown as a reference on this computer. They are
          never copied into your packs or exports.
        </p>
      </section>
    </Modal>
  )
}
