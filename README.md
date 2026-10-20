# Resource Pack Creator

A desktop app for creating Minecraft **Java Edition** resource packs — textures,
models, sounds, fonts and more — for every Minecraft version from 1.6.1 to the
latest release. Built for beginners (Simple mode) and pack veterans (Expert
mode) alike, for Windows and Linux.

> **Status:** early preview (v0.1.0). You can create packs with the wizard and
> export them for every Minecraft version; the editors are being built next. See
> [CHANGELOG.md](CHANGELOG.md) for what is in each release and
> [docs/DECISIONS.md](docs/DECISIONS.md) for the full feature scope.

## Planned features

- Step-by-step wizard for new packs, with a live preview of the in-game pack description
- Vanilla textures as reference, read from your local Minecraft installation or downloaded from Mojang (never shipped with the app)
- Built-in pixel editor with layers, unlimited undo, palettes, symmetry, gradients and dithering
- Live 3D preview of blocks, held items and mobs
- Animated textures with a timeline, onion skin and GIF import/export
- Sounds, language files, fonts, GUI, environment and title-screen editing
- Generators for ores, tool tiers, colour variants and wood sets, plus bulk filters
- Pack checks with one-click fixes
- Export for one, several or all Minecraft versions at once
- One-click publishing to Modrinth

## Development

Requirements: Node.js 24 (see `.nvmrc`; 22.12 or newer works) and npm.

```sh
npm install
npm run dev
```

| Command                                   | What it does                                            |
| ----------------------------------------- | ------------------------------------------------------- |
| `npm run dev`                             | Start the app with hot reload                           |
| `npm run build`                           | Build main, preload and renderer into `out/`            |
| `npm run lint` / `npm run format`         | ESLint / Prettier                                       |
| `npm run typecheck`                       | TypeScript checks for all processes                     |
| `npm test`                                | Unit tests (Vitest)                                     |
| `npm run test:e2e`                        | Build, then drive the real app with Playwright          |
| `npm run dist:win` / `npm run dist:linux` | Build installers into `dist/`                           |
| `npm run update:versions`                 | Refresh the Minecraft version table after a new release |

On Linux without a display, run the end-to-end tests with
`xvfb-run --auto-servernum npm run test:e2e`.

### Project layout

```
src/
  main/       Electron main process: window, IPC handlers, security rules
  preload/    The only bridge between UI and main process (window.api)
  renderer/   React UI (Tailwind CSS, Zustand)
  shared/     Code used by several processes: IPC channels and schemas, CSP, network policy
tests/e2e/    Playwright tests against the built app
docs/         Product and security decisions
```

### Security model

The renderer runs sandboxed with context isolation and no Node.js access. It
can only call the functions in `src/preload/index.ts`, and the main process
validates every call's sender and arguments (zod) before handling it. Network
requests are limited to an allow-list of hosts over HTTPS, and links always open
in the system browser. Details: [SECURITY.md](SECURITY.md).

### Releases

Pushing a tag such as `v0.1.0` (matching the version in `package.json`) makes
GitHub Actions build the Windows (NSIS installer, MSI) and Linux (AppImage,
`.deb`) packages and publish them as a GitHub release. Every push also builds
the installers as downloadable CI artifacts. Installers are currently unsigned,
so Windows SmartScreen will warn on first launch.

## Licence

[MIT](LICENSE). Minecraft is a trademark of Mojang Studios; this project is not
affiliated with Mojang or Microsoft.
