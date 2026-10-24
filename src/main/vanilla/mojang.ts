// Downloads a Minecraft client JAR from Mojang and verifies it (docs/DECISIONS.md #21, #129).

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PackError } from '../pack-io'

export const VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export type Fetcher = (url: string) => Promise<Response>
export type ProgressListener = (received: number, total: number) => void

const manifestSchema = z.object({
  versions: z.array(z.object({ id: z.string(), url: z.string(), sha1: z.string() })),
})

const versionSchema = z.object({
  downloads: z.object({
    client: z.object({ url: z.string(), sha1: z.string(), size: z.number() }),
  }),
})

function sha1(bytes: Uint8Array): string {
  return createHash('sha1').update(bytes).digest('hex')
}

async function fetchBytes(
  fetcher: Fetcher,
  url: string,
  onProgress?: ProgressListener,
  expectedSize = 0,
): Promise<Uint8Array> {
  let response: Response
  try {
    response = await fetcher(url)
  } catch {
    throw new PackError(
      "Could not reach Mojang's servers to download the game files. Check your internet connection.",
    )
  }
  if (!response.ok) {
    throw new PackError(`Mojang's server answered with error ${response.status}. Try again later.`)
  }
  const total = Number(response.headers.get('content-length')) || expectedSize
  if (!onProgress || !response.body) return new Uint8Array(await response.arrayBuffer())

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress(received, total)
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function parseJson<T>(bytes: Uint8Array, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
  if (!parsed.success) throw new PackError("Mojang's version data has an unexpected format.")
  return parsed.data
}

/** Downloads the client JAR of a release, checking every file against Mojang's SHA-1. */
export async function downloadClientJar(
  versionId: string,
  fetcher: Fetcher,
  onProgress?: ProgressListener,
): Promise<Uint8Array> {
  const manifest = parseJson(await fetchBytes(fetcher, VERSION_MANIFEST_URL), manifestSchema)
  const entry = manifest.versions.find((version) => version.id === versionId)
  if (!entry) throw new PackError(`Mojang does not offer Minecraft ${versionId} for download.`)

  const versionBytes = await fetchBytes(fetcher, entry.url)
  if (sha1(versionBytes) !== entry.sha1) {
    throw new PackError(`The version data for Minecraft ${versionId} failed its checksum test.`)
  }
  const { client } = parseJson(versionBytes, versionSchema).downloads

  const jar = await fetchBytes(fetcher, client.url, onProgress, client.size)
  if (sha1(jar) !== client.sha1) {
    throw new PackError(`The download of Minecraft ${versionId} is damaged. Please try again.`)
  }
  return jar
}
