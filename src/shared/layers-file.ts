// The editor's layers, saved next to the pack in .rpc/layers/ (docs/DECISIONS.md #29).
// Minecraft never sees them; the pack itself only holds the flattened PNG.

import { z } from 'zod'

export const layersFileSchema = z.object({
  version: z.literal(1),
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
  layers: z
    .array(
      z.object({
        name: z.string().max(64),
        visible: z.boolean(),
        opacity: z.number().min(0).max(1),
        /** Base64-encoded PNG of exactly width × height. */
        png: z.string().max(64 * 1024 * 1024),
      }),
    )
    .min(1)
    .max(64),
})

export type LayersFile = z.infer<typeof layersFileSchema>
