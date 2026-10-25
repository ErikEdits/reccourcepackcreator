# Changelog

## [0.7.0] - 2026-10-25

### New

- **More mobs in 3D:** villagers (with every biome and profession), zombie villagers,
  pillagers, vindicators, evokers, illusioners, witches, piglins, piglin brutes, zombified
  piglins, all cats and the ocelot, horses (all coats, markings and armour), skeleton and zombie
  horses, donkeys, mules, foxes (and snow foxes), squids and glow squids, ghasts, blazes, snow
  golems and polar bears.
- **Overlays on their mob.** Textures that only add something to a mob — a villager's
  profession or biome clothes, a pig's saddle, the enderman's eyes, a wolf's collar, a horse's
  markings or armour, an iron golem's cracks, the outer layers of drowned, strays and bogged —
  are shown on the mob they belong to, so you see what you paint in place. Clicks go to the
  overlay, also where it is still empty.

## [0.6.0] - 2026-10-25

### New

- **Mobs in 3D.** Mob textures are shown on their Minecraft models and can be painted there,
  just like blocks and items: zombie, husk, drowned, skeleton, stray, wither skeleton, bogged,
  creeper, cow, red and brown mooshroom, pig, sheep (and its wool), chicken, spider, cave
  spider, enderman, slime, wolf (all variants), iron golem, and the player skins (wide and
  slim). Higher-resolution packs work as long as the texture keeps its proportions.
- Clicks on the 3D model go through empty pixels of outer layers (a player's hat or jacket) to
  what is visible behind them.

### Notes

- The cow, pig and chicken models that Minecraft 1.21.5 redrew are not included yet; their new
  textures show no 3D view.

## [0.5.0] - 2026-10-25

### New

- **3D preview.** Blocks are shown with their real Minecraft models (stairs, torches, plants,
  logs …) including the biome colour of grass and leaves, Minecraft's shading and see-through
  parts; items are shown as thick sprites like in the hand. The preview follows every stroke
  live. Choose 2D, 3D or both side by side below the editor.
- **Paint in 3D.** Pencil, eraser, fill and the colour picker work directly on the model.
  Clicking a face that shows another texture of the block (the grass block's top) switches to
  that texture; the next click paints it. Drag beside the model, with the right mouse button
  or with Shift to turn it; the mouse wheel zooms.
- **One entry per block in the texture list.** The textures of a block (top, side, overlay,
  snowy side …) now appear together as one tile with a count, instead of separately. The
  editor shows them as tabs. "Blocks" next to the filters switches back to single textures.
- Switching between the textures of a block keeps each texture's undo history.

### Notes

- Mob models and the item-in-hand view come in a later release.
- Minecraft 1.6 and 1.7 have no block models, so they keep the flat list and have no 3D
  view for blocks.

## [0.4.0] - 2026-10-24

### New

- **Pixel editor.** Clicking a texture opens it in the built-in editor. Changes are saved
  automatically; an original texture only becomes part of the pack once you change it, and
  starts at the pack's resolution.
  - Tools: pencil, eraser, fill, gradient (smooth or dithered with two colours), colour
    picker, line, rectangle and ellipse (outlined or filled), selection and move. Left and
    right mouse button paint with two colours; Alt picks a colour with any painting tool.
  - Brush size, mirror drawing (left/right, top/bottom), flip and rotate for the selection or
    the whole layer, copy, cut and paste (as a new layer).
  - Layers with visibility, opacity, renaming, reordering and merging. They are kept in the
    project's hidden `.rpc` folder; the pack and its exports only get the combined picture.
  - Unlimited undo and redo, with a history panel to jump back to any step.
  - Colour picker with saturation/brightness square, hue, opacity, RGB and hex; the colours
    of the original texture as a palette; your own palettes, and palette import from `.gpl`,
    `.pal`, `.hex` and `.txt` files (e.g. from Lospec).
  - Mouse-wheel zoom around the pointer, pan with Space or the middle mouse button, pixel
    grid, fit to window. Pens and touch screens work too; pen pressure changes the brush
    size.
  - Keyboard shortcuts for every tool and action, changeable in Settings.
  - Settings: the colour shown behind transparent pixels.
- "Import image…" and dropping an image onto the editor replace the texture as one step
  that can be undone.

## [0.3.0] - 2026-10-24

### New

- **Exports for older and newer Minecraft versions now use the right texture names.** A pack
  made for 1.21 that is exported for 1.12 gets `blocks/planks_oak.png` instead of
  `block/oak_planks.png`, and the other way round; animation files move along. This covers
  1,100 renames from 1.6.1 to 26.3, including the 1.13 "Flattening". The export message says
  how many textures were renamed.
- "One ZIP per pack format" now also splits where texture names changed without a new pack
  format (1.6.x and 1.7.x).

### Fixed

- Messages in the bottom corner covered the dialogs' buttons for six seconds. They now appear
  bottom left and never block clicks.

### Known limitations

- Textures that Minecraft split up or redrew with a new layout (GUI sprites in 1.20.2,
  paintings and villagers in 1.14, the 64×64 cow, pig and rabbit models of 1.21.5 and 26.1)
  are not converted.

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
