// Network and link rules (see docs/DECISIONS.md, #124 and #130).

/** Hosts the app may contact. Everything else is blocked. */
export const ALLOWED_NETWORK_HOSTS: readonly string[] = [
  // Mojang: version manifest, client JARs, assets
  'piston-meta.mojang.com',
  'piston-data.mojang.com',
  'launchermeta.mojang.com',
  'launcher.mojang.com',
  'resources.download.minecraft.net',
  // Modrinth publishing
  'api.modrinth.com',
  'cdn.modrinth.com',
  // GitHub: app updates and start-screen news
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]

/** Sites opened in the system browser without asking first. */
export const TRUSTED_LINK_HOSTS: readonly string[] = [
  'minecraft.wiki',
  'modrinth.com',
  'github.com',
]

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function matchesHost(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

/** True if the app itself may send a request to this URL. HTTPS only. */
export function isAllowedNetworkUrl(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url || url.protocol !== 'https:') return false
  return ALLOWED_NETWORK_HOSTS.includes(url.hostname)
}

export type LinkVerdict = 'open' | 'confirm' | 'block'

/** Decides how a link clicked in the UI is handled. Only http(s) links ever leave the app. */
export function classifyExternalLink(raw: string): LinkVerdict {
  const url = parseUrl(raw)
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return 'block'
  if (url.username || url.password) return 'block'
  if (url.protocol === 'https:' && matchesHost(url.hostname, TRUSTED_LINK_HOSTS)) return 'open'
  return 'confirm'
}
