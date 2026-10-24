// Content Security Policy for the renderer page (docs/DECISIONS.md #121).
// The dev server needs inline scripts/styles for hot reloading; builds do not.

const common = {
  'default-src': ["'none'"],
  // rpc-texture: serves game and pack textures (src/main/textures.ts).
  'img-src': ["'self'", 'data:', 'blob:', 'rpc-texture:'],
  'font-src': ["'self'", 'data:'],
  'media-src': ["'self'", 'data:', 'blob:'],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-src': ["'none'"],
}

const production = {
  ...common,
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'connect-src': ["'self'"],
}

const development = {
  ...common,
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'ws://localhost:*', 'ws://127.0.0.1:*'],
}

export function buildContentSecurityPolicy(mode: 'development' | 'production'): string {
  const directives = mode === 'development' ? development : production
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}
