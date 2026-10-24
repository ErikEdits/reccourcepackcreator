# Changelog

## [0.2.0] - 2026-10-24

### New

- **Texture list:** all textures of the pack's Minecraft version, as a grid or a list, with
  search, category and colour filters and a "changed only" switch. Textures your pack changes
  are marked, and the status bar counts them ("12 / 2,512 textures changed").
- **Original textures** come from your Minecraft installation (`.minecraft`) when that version
  is installed, otherwise they are downloaded once from Mojang, checked against Mojang's SHA-1
  checksums and kept in a cache. Settings show the cache size and can delete it. The game's
  textures are only used as a reference and never copied into packs or exports.
- **Replace textures** by dropping an image onto the preview or choosing a file. Images are
  scaled with hard pixel edges to the pack's resolution; animation strips stay animated.
  "Revert to original" removes your version again.
- Properties of the selected texture: file, category, size, frames, colour, the original for
  comparison and a link to the Minecraft Wiki.

## [0.1.0] - 2026-10-20

First preview release for Windows and Linux.

### New

- **Pack wizard:** create a resource pack in six steps: name, description, main Minecraft
  version and texture resolution, icon, licence and location. The pack is a normal folder
  Minecraft can load directly.
- **Description editor** with buttons for all 16 Minecraft colours and the bold, italic,
  underline, strikethrough, obfuscated and reset codes, plus a live preview of the pack as it
  appears in Minecraft's pack list.
- **Pack icon:** drop in any image; it is cropped to a square and saved as a 128×128 `pack.png`.
- **Export** for one, several or all 86 Minecraft releases from 1.6.1 to 26.3. Every ZIP gets
  the right `pack.mcmeta` for its version (`pack_format`, or `min_format`/`max_format` from
  1.21.9 on). Optionally one ZIP per pack format instead of per version, a file-name template,
  and Downloads or any other folder as the destination. A sound, a notification and a message
  confirm the export.
- **Start screen** with recent packs and tips; open any existing pack folder.
- Light, dark and system themes; Simple and Expert mode (Expert shows the pack's files).

### Security

- Sandboxed interface without Node.js access, strict Content Security Policy, validated
  communication with the main process, network allow-list, and file access limited to
  folders you choose.

### Known limitations

- Installers are not code-signed: Windows SmartScreen shows "Unknown publisher". Choose
  "More info" → "Run anyway".
- Texture browsing and editing, sounds, models and Modrinth publishing are not in this
  release yet.
