import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { buildContentSecurityPolicy } from './src/shared/csp'

/** Injects the Content Security Policy as the first tag of the renderer's <head>. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'resource-pack-creator:csp',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, context) => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: buildContentSecurityPolicy(context.server ? 'development' : 'production'),
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}

export default defineConfig({
  main: {},
  preload: {
    // The sandboxed preload cannot require node_modules, so bundle everything into it.
    build: { externalizeDeps: false },
  },
  renderer: {
    plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  },
})
