# Product decisions

These decisions were made in a 140-question planning session (120 product
questions + 20 security questions) before any code was written. Every feature
listed here belongs in the scope of the first release; the order in which they
get built is tracked separately.

Where the answer was "no preference", the recommended default was adopted and
is marked _(default)_.

## 1. Platform and audience

| #   | Topic                        | Decision                                                                |
| --- | ---------------------------- | ----------------------------------------------------------------------- |
| 1   | Platform                     | Desktop app                                                             |
| 2   | Minecraft edition            | Java Edition only                                                       |
| 3   | Supported Minecraft versions | Every version that has resource packs, from 1.6.1 to the latest release |
| 4   | UI language                  | English only                                                            |
| 6   | Operating systems            | Windows and Linux                                                       |
| 7   | Audience                     | Everyone, with a switchable Simple / Expert mode                        |
| 8   | Distribution                 | Free and open source (MIT)                                              |
| 16  | App name                     | Resource Pack Creator                                                   |
| 76  | Internet                     | An internet connection may be assumed (offline use is not a goal)       |
| 117 | Hardware                     | WebGL2 is required                                                      |

## 2. Technology

| #   | Topic                                     | Decision                                                                  |
| --- | ----------------------------------------- | ------------------------------------------------------------------------- |
| 5   | Desktop framework                         | Electron                                                                  |
| 9   | Language                                  | TypeScript                                                                |
| 10  | UI framework                              | React                                                                     |
| 11  | Build and packaging                       | electron-vite + electron-builder                                          |
| 12  | Styling                                   | Tailwind CSS                                                              |
| 40  | 3D                                        | Three.js + React Three Fiber                                              |
| 95  | Package manager                           | npm                                                                       |
| 96  | State management                          | Zustand                                                                   |
| 90  | Tests                                     | Vitest (unit) + Playwright (end-to-end against the real Electron app)     |
| 91  | CI/CD                                     | GitHub Actions: tests on every push, installers published on version tags |
| 92  | Code quality                              | ESLint + Prettier                                                         |
| 94  | Language of code, comments, docs, commits | English                                                                   |
| 116 | App versioning                            | SemVer, starting at 0.1.0                                                 |
| 119 | Git workflow                              | Feature branches + pull requests into `main`                              |
| 93  | Repository name                           | Stays `reccourcepackcreator`                                              |

## 3. Look and feel

| #   | Topic                                       | Decision                                                          |
| --- | ------------------------------------------- | ----------------------------------------------------------------- |
| 13  | Visual style                                | Modern UI with Minecraft accents (pixel icons, Minecraft colours) |
| 14  | Themes                                      | Light + dark, follows the system, switchable manually             |
| 15  | Main layout                                 | Three columns: texture list / editor and preview / properties     |
| 101 | Title bar                                   | Custom title bar drawn by the app                                 |
| 107 | App icon                                    | Electron default icon for now                                     |
| 108 | Accessibility                               | Scalable UI (font and control size)                               |
| 112 | Editor background behind transparent pixels | A single colour, user-selectable                                  |

## 4. Modes, onboarding, help

| #   | Topic                | Decision                                                                          |
| --- | -------------------- | --------------------------------------------------------------------------------- |
| 61  | Expert mode adds     | Full file tree, all settings, custom namespaces (no raw JSON editor)              |
| 62  | Mode switching       | Asked on first start, toggle always available afterwards                          |
| 60  | Beginner help        | First-start tutorial, tooltips, per-texture explanation                           |
| 118 | Texture explanations | Short hand-written descriptions stored in the repo + a link to the Minecraft Wiki |
| 63  | Keyboard shortcuts   | Sensible defaults (B = brush, E = eraser, G = fill, …), fully remappable          |
| 64  | Input devices        | Mouse + keyboard, pen tablets (pressure), touch screens                           |

## 5. Projects

| #   | Topic                         | Decision                                                                         |
| --- | ----------------------------- | -------------------------------------------------------------------------------- |
| 17  | New pack                      | Step-by-step wizard                                                              |
| 18  | Project storage               | A project _is_ a plain resource-pack folder, usable by Minecraft and other tools |
| 20  | Pack icon (`pack.png`)        | Upload an image                                                                  |
| 102 | Pack description              | Formatting/colour buttons with a live preview identical to the in-game menu      |
| 110 | Pack licence                  | Chosen in the wizard from a list of common licences                              |
| 111 | "Made with" credit in packs   | No                                                                               |
| 65  | Saving                        | Automatic                                                                        |
| 66  | Backups                       | Automatic snapshots inside the project's hidden `.rpc/` folder                   |
| 113 | Crash recovery                | Offer to restore unsaved changes on next start                                   |
| 103 | Files changed outside the app | Reloaded automatically                                                           |
| 67  | Start screen                  | Recent projects, New pack / Import, tips, news                                   |
| 68  | Several projects at once      | No, one project at a time                                                        |
| 114 | Settings                      | Exportable/importable as a file                                                  |

## 6. Vanilla data and versions

| #   | Topic                            | Decision                                                                                                                     |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 21  | Source of vanilla textures       | Local `.minecraft` installation first, otherwise the official Mojang download. Mojang assets are never shipped with the app. |
| 85  | Which textures exist per version | Read live from Mojang's client JARs                                                                                          |
| 89  | Renames between versions         | A hand-maintained JSON rename table in this repository (old → new)                                                           |
| 86  | New Minecraft versions           | Detected automatically from Mojang's version manifest; releases only, no snapshots                                           |
| 87  | Download cache                   | App data folder, with size display and a "clear cache" button                                                                |

## 7. Texture browser

| #   | Topic       | Decision                                                                                     |
| --- | ----------- | -------------------------------------------------------------------------------------------- |
| 22  | View        | Grid and list, switchable                                                                    |
| 23  | Filters     | By name, by category, changed only, by colour                                                |
| 24  | Progress    | Changed textures are marked in the list; overall progress shown (e.g. "312 / 1,024 changed") |
| 88  | Performance | Thumbnails are cached                                                                        |

## 8. Pixel editor

| #   | Topic                      | Decision                                                                                                                         |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Editor                     | Built-in editor only (no external editor integration)                                                                            |
| 26  | Basic tools                | Brush, eraser, fill, colour picker, shapes — and anything else a pixel editor needs                                              |
| 27  | Advanced tools             | Selection + move, flip + rotate, symmetry mode, gradients + dithering                                                            |
| 28  | Layers                     | Always available                                                                                                                 |
| 29  | Layer storage              | Hidden `.rpc/` folder inside the project; excluded from every export                                                             |
| 30  | Undo/redo                  | Unlimited, with a history panel                                                                                                  |
| 31  | Colours                    | Colour picker (HSV/RGB/hex/alpha), palette from the original texture, custom palettes, palette import (Lospec, .gpl, .pal, .hex) |
| 32  | Transparency               | Full alpha everywhere, no warnings                                                                                               |
| 33  | Resolutions                | 16×, 32×, 64×, 128×, 256×, 512× and above                                                                                        |
| 34  | Resolution setting         | A pack-wide default that individual textures can override                                                                        |
| 35  | Scaling                    | Nearest neighbour                                                                                                                |
| 36  | Navigation                 | Mouse-wheel zoom, toggleable pixel grid                                                                                          |
| 72  | Bringing in outside images | Drag and drop                                                                                                                    |

## 9. Preview

| #   | Topic                 | Decision                                                              |
| --- | --------------------- | --------------------------------------------------------------------- |
| 37  | What can be previewed | 3D blocks (real block models), items in first-person hand, mob models |
| 38  | Updates               | Live while painting                                                   |
| 39  | Controls              | Rotate and zoom with the mouse                                        |

## 10. Animation

| #   | Topic             | Decision                                                                                           |
| --- | ----------------- | -------------------------------------------------------------------------------------------------- |
| 41  | Animated textures | Yes, with a timeline; `.png.mcmeta` is generated automatically                                     |
| 42  | Features          | Frame management (add/duplicate/delete/reorder), per-frame duration, onion skin. No interpolation. |
| 43  | Formats           | GIF import, GIF export, sprite-sheet import, individual-frame import                               |
| 44  | Playback          | In the 2D editor and the 3D preview simultaneously                                                 |

## 11. Other pack content

| #   | Topic           | Decision                                                                                                        |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| 45  | Content, part 1 | Models (JSON), sounds, language files, fonts                                                                    |
| 46  | Content, part 2 | GUI, environment (sun, moon, clouds, colormaps), title screen (panorama, logo, splashes), particles and effects |
| 47  | Models          | Blockbench import + simple adjustments inside the app                                                           |
| 48  | Mod features    | Connected textures (CTM), custom item textures (CIT), random mob textures, emissive textures                    |
| 49  | Sounds          | Upload, listen and compare with the original, simple trimming                                                   |
| 50  | Audio formats   | Converted to `.ogg` automatically                                                                               |
| 51  | Language files  | Two-column table (original / new) with search                                                                   |
| 52  | Fonts           | Per-glyph pixel editor, TTF/OTF import, live text preview, custom symbols/emoji                                 |

## 12. Bulk editing and generators

| #   | Topic           | Decision                                                             |
| --- | --------------- | -------------------------------------------------------------------- |
| 69  | Bulk edits      | Hue/brightness/saturation, filters, colour replace, borders/outlines |
| 70  | Linked textures | No                                                                   |
| 71  | Generators      | Ore generator, tool tiers, 16 colour variants, wood sets             |

## 13. Import, validation, export

| #   | Topic                   | Decision                                                                                          |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| 55  | Import                  | `.zip` files                                                                                      |
| 56  | Old packs               | Converted to the current format automatically, with a report of what changed                      |
| 57  | Checks                  | Image sizes, file names and paths, JSON errors, version compatibility                             |
| 58  | When problems are shown | Live in a Problems panel, and again before export                                                 |
| 59  | Fixing                  | A "Fix" button per problem                                                                        |
| 19  | Multiple versions       | Export for one, several, or all versions; one ZIP per version, all placed in the Downloads folder |
| 53  | Export destinations     | Downloads folder (default) or a folder of the user's choice                                       |
| 54  | Export options          | Pre-export check, file-name template, only changed files                                          |
| 104 | "Test in game" button   | No                                                                                                |
| 109 | Completion notice       | In-app toast, system notification and a sound                                                     |

## 14. Modrinth publishing

| #   | Topic                | Decision                                                                                                                                       |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 73  | Sharing              | One-click upload to the user's existing Modrinth project using a Modrinth personal access token                                                |
| 78  | What the upload does | New version (all exported ZIPs, tagged with their Minecraft versions), updated description, gallery images. Creating projects is out of scope. |
| 79  | Version numbers      | Auto-incremented, editable before upload                                                                                                       |
| 80  | Changelog            | Generated from changes since the last version, editable                                                                                        |
| 74  | Collaboration        | Not for now                                                                                                                                    |
| 75  | User accounts        | None                                                                                                                                           |

## 15. Updates and distribution

| #   | Topic                                       | Decision                                         |
| --- | ------------------------------------------- | ------------------------------------------------ |
| 81  | App updates                                 | Auto-update from GitHub Releases                 |
| 82  | Windows packages                            | NSIS installer (`.exe`) and MSI                  |
| 83  | Linux packages                              | AppImage and `.deb`                              |
| 106 | Code signing                                | Unsigned for now (Windows SmartScreen will warn) |
| 84  | Telemetry                                   | None                                             |
| 105 | Discord Rich Presence                       | Always on                                        |
| 115 | Contributor files (CONTRIBUTING, templates) | No preference — added later when needed          |

## 16. Security

| #   | Topic                                | Decision                                                                                                                                                |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 121 | Electron baseline                    | _(default)_ Strict: `sandbox`, `contextIsolation`, no Node.js in the renderer, strict Content Security Policy                                           |
| 122 | File-system access                   | Only approved folders: project, Downloads, `.minecraft`, app data, and folders the user picks in a dialog                                               |
| 123 | IPC                                  | Fixed list of channels; every payload validated with a zod schema before it is handled                                                                  |
| 124 | Links                                | _(default)_ Always opened in the system browser; unknown domains need confirmation; the app never loads foreign pages                                   |
| 125 | ZIP import                           | Path check only (rejects entries escaping the target folder); no size limits                                                                            |
| 126 | Unknown file types in imported packs | _(default)_ Only known pack file types are imported; the rest are listed in a report and dropped                                                        |
| 127 | Untrusted images                     | No size limits                                                                                                                                          |
| 128 | Audio conversion                     | Bundled native ffmpeg binary                                                                                                                            |
| 129 | Mojang downloads                     | _(default)_ Verified against the SHA-1 checksums Mojang publishes                                                                                       |
| 130 | Network                              | Allow-list of known hosts only (Mojang, Modrinth, GitHub, Discord via local IPC); HTTPS only                                                            |
| 131 | Start-screen news                    | Taken from GitHub Releases, rendered as sanitised text (no scripts)                                                                                     |
| 132 | Update verification                  | No extra verification beyond what electron-updater does on its own                                                                                      |
| 133 | Modrinth token scopes                | The required scopes are explained; tokens are not checked                                                                                               |
| 134 | Token protection                     | Token lives in the main process only (never sent to the renderer), redacted from logs, expiry/invalid warning                                           |
| 77  | Token storage                        | OS keychain (Windows Credential Manager / Linux Secret Service) via Electron `safeStorage`                                                              |
| 135 | Discord Rich Presence content        | Only "Creating a resource pack" — no pack or file names                                                                                                 |
| 136 | Logs                                 | Full local logs in the app data folder (tokens still redacted, see #134)                                                                                |
| 137 | Dependencies                         | _(default)_ Committed lockfile + `npm ci`, `npm audit` in CI, Dependabot                                                                                |
| 138 | GitHub security features             | _(default)_ Least-privilege permissions for GitHub Actions. CodeQL, secret scanning and branch protection are repository settings the owner can enable. |
| 139 | Electron fuses                       | Left at Electron's defaults                                                                                                                             |
| 140 | Vulnerability reporting              | _(default)_ `SECURITY.md` pointing to GitHub's private vulnerability reporting                                                                          |

### Accepted risks

These answers trade safety for simplicity and should be revisited if the app
starts handling packs from untrusted sources at scale:

- **#125 / #127:** without size limits, a crafted ZIP ("zip bomb") or a huge
  image can exhaust memory or disk and freeze the app.
- **#128:** a native ffmpeg binary parses untrusted audio files outside the
  Chromium sandbox; a WebAssembly build would contain such bugs.
- **#132 / #106:** updates are unsigned. electron-updater still compares each
  download with the SHA-512 in the release's `latest.yml`, but anyone who can
  publish to the GitHub releases can ship an update.
- **#139:** default fuses leave `ELECTRON_RUN_AS_NODE` and `--inspect`
  available on the installed app.

## 17. First release scope and starting point

| #     | Topic             | Decision                                                                                               |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| 97–99 | First release     | Everything above                                                                                       |
| 100   | First coding step | Project skeleton: Electron + React + TypeScript + Tailwind, empty three-column window, tests, CI, lint |
