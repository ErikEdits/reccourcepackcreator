// Mob models for the 3D preview (docs/DECISIONS.md #37). Minecraft builds these in its code, not
// from data files, so they are described here: boxes with Minecraft's "box UV" texture layout,
// in Minecraft's model space (pixels; y points down; the mob looks towards -z).

export type Vec3 = [number, number, number]

/** One box. Its six faces take their pictures from a fixed layout starting at `uv`. */
export interface MobCube {
  /** Top-left corner of the box's area in the texture, in texture pixels. */
  uv: [number, number]
  from: Vec3
  size: Vec3
  /** Grows the box on every side without changing its texture (hats, sleeves, wool). */
  inflate?: number
  /** Uses the texture mirrored (left limbs drawn from the right limb's area). */
  mirror?: boolean
}

export interface MobPart {
  /** Where the part sits relative to its parent; it turns around this point. */
  pivot: Vec3
  /** Resting pose in radians, applied as Minecraft does: z, then y, then x. */
  rotation?: Vec3
  cubes: MobCube[]
  children?: MobPart[]
}

export interface MobModel {
  id: string
  /** The texture size the layout is made for; larger textures must keep this aspect ratio. */
  textureSize: [number, number]
  parts: MobPart[]
}

const HALF_PI = Math.PI / 2
const box = (uv: [number, number], from: Vec3, size: Vec3, extra: Partial<MobCube> = {}) => ({
  uv,
  from,
  size,
  ...extra,
})

/** Head and hat of zombies, skeletons and players. */
function humanoidHead(): MobPart[] {
  return [
    { pivot: [0, 0, 0], cubes: [box([0, 0], [-4, -8, -4], [8, 8, 8])] },
    { pivot: [0, 0, 0], cubes: [box([32, 0], [-4, -8, -4], [8, 8, 8], { inflate: 0.5 })] },
  ]
}

/** The classic 64×32 humanoid layout: left arm and leg mirror the right ones. */
function humanoid(id: string, height: 32 | 64, limb: 2 | 4 = 4): MobModel {
  const half = limb / 2
  return {
    id,
    textureSize: [64, height],
    parts: [
      ...humanoidHead(),
      { pivot: [0, 0, 0], cubes: [box([16, 16], [-4, 0, -2], [8, 12, 4])] },
      {
        pivot: [-5, 2, 0],
        cubes: [box([40, 16], [limb === 4 ? -3 : -1, -2, -half], [limb, 12, limb])],
      },
      {
        pivot: [5, 2, 0],
        cubes: [box([40, 16], [-1, -2, -half], [limb, 12, limb], { mirror: true })],
      },
      {
        pivot: [limb === 4 ? -1.9 : -2, 12, 0],
        cubes: [box([0, 16], [-half, 0, -half], [limb, 12, limb])],
      },
      {
        pivot: [limb === 4 ? 1.9 : 2, 12, 0],
        cubes: [box([0, 16], [-half, 0, -half], [limb, 12, limb], { mirror: true })],
      },
    ],
  }
}

/** Players (and drowned): own areas for the left limbs, plus an outer layer on everything. */
function player(id: string, slim: boolean, outerLayer: boolean): MobModel {
  const arm = slim ? 3 : 4
  const armY = slim ? 2.5 : 2
  const layer = (uv: [number, number], from: Vec3, size: Vec3): MobCube[] =>
    outerLayer ? [box(uv, from, size, { inflate: 0.25 })] : []
  return {
    id,
    textureSize: [64, 64],
    parts: [
      ...humanoidHead(),
      {
        pivot: [0, 0, 0],
        cubes: [
          box([16, 16], [-4, 0, -2], [8, 12, 4]),
          ...layer([16, 32], [-4, 0, -2], [8, 12, 4]),
        ],
      },
      {
        pivot: [-5, armY, 0],
        cubes: [
          box([40, 16], [-arm + 1, -2, -2], [arm, 12, 4]),
          ...layer([40, 32], [-arm + 1, -2, -2], [arm, 12, 4]),
        ],
      },
      {
        pivot: [5, armY, 0],
        cubes: [
          box([32, 48], [-1, -2, -2], [arm, 12, 4]),
          ...layer([48, 48], [-1, -2, -2], [arm, 12, 4]),
        ],
      },
      {
        pivot: [-1.9, 12, 0],
        cubes: [box([0, 16], [-2, 0, -2], [4, 12, 4]), ...layer([0, 32], [-2, 0, -2], [4, 12, 4])],
      },
      {
        pivot: [1.9, 12, 0],
        cubes: [box([16, 48], [-2, 0, -2], [4, 12, 4]), ...layer([0, 48], [-2, 0, -2], [4, 12, 4])],
      },
    ],
  }
}

/** Four legs of the same box, the left ones mirrored, as cows, pigs and sheep have. */
function fourLegs(
  x: number,
  y: number,
  [back, front]: [number, number],
  height: number,
  extra: Partial<MobCube> = {},
): MobPart[] {
  const leg = (side: number, z: number): MobPart => ({
    pivot: [side * x, y, z],
    cubes: [box([0, 16], [-2, 0, -2], [4, height, 4], { ...extra, mirror: side > 0 })],
  })
  return [leg(-1, back), leg(1, back), leg(-1, front), leg(1, front)]
}

function cow(id: string): MobModel {
  return {
    id,
    textureSize: [64, 32],
    parts: [
      {
        pivot: [0, 4, -8],
        cubes: [
          box([0, 0], [-4, -4, -6], [8, 8, 6]),
          box([22, 0], [-5, -5, -4], [1, 3, 1]),
          box([22, 0], [4, -5, -4], [1, 3, 1]),
        ],
      },
      {
        pivot: [0, 5, 2],
        rotation: [HALF_PI, 0, 0],
        cubes: [box([18, 4], [-6, -10, -7], [12, 18, 10]), box([52, 0], [-2, 2, -8], [4, 6, 1])],
      },
      ...fourLegs(4, 12, [7, -6], 12),
    ],
  }
}

function pig(id: string): MobModel {
  return {
    id,
    textureSize: [64, 32],
    parts: [
      {
        pivot: [0, 12, -6],
        cubes: [box([0, 0], [-4, -4, -8], [8, 8, 8]), box([16, 16], [-2, 0, -9], [4, 3, 1])],
      },
      {
        pivot: [0, 11, 2],
        rotation: [HALF_PI, 0, 0],
        cubes: [box([28, 8], [-5, -10, -7], [10, 16, 8])],
      },
      ...fourLegs(3, 18, [7, -5], 6),
    ],
  }
}

function sheep(id: string, wool: boolean): MobModel {
  const grow = (amount: number): Partial<MobCube> => (wool ? { inflate: amount } : {})
  return {
    id,
    textureSize: [64, 32],
    parts: [
      {
        pivot: [0, 6, -8],
        cubes: [
          wool
            ? box([0, 0], [-3, -4, -4], [6, 6, 6], grow(0.6))
            : box([0, 0], [-3, -4, -6], [6, 6, 8]),
        ],
      },
      {
        pivot: [0, 5, 2],
        rotation: [HALF_PI, 0, 0],
        cubes: [box([28, 8], [-4, -10, -7], [8, 16, 6], grow(1.75))],
      },
      ...fourLegs(3, 12, [7, -5], wool ? 6 : 12, grow(0.5)),
    ],
  }
}

const CREEPER: MobModel = {
  id: 'creeper',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, 6, 0], cubes: [box([0, 0], [-4, -8, -4], [8, 8, 8])] },
    { pivot: [0, 6, 0], cubes: [box([16, 16], [-4, 0, -2], [8, 12, 4])] },
    ...[
      [-2, 4],
      [2, 4],
      [-2, -4],
      [2, -4],
    ].map(([x, z]): MobPart => ({
      pivot: [x, 18, z],
      cubes: [box([0, 16], [-2, 0, -2], [4, 6, 4])],
    })),
  ],
}

const CHICKEN: MobModel = {
  id: 'chicken',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, 15, -4], cubes: [box([0, 0], [-2, -6, -2], [4, 6, 3])] },
    { pivot: [0, 15, -4], cubes: [box([14, 0], [-2, -4, -4], [4, 2, 2])] },
    { pivot: [0, 15, -4], cubes: [box([14, 4], [-1, -2, -3], [2, 2, 2])] },
    {
      pivot: [0, 16, 0],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([0, 9], [-3, -4, -3], [6, 8, 6])],
    },
    { pivot: [-2, 19, 1], cubes: [box([26, 0], [-1, 0, -3], [3, 5, 3])] },
    { pivot: [1, 19, 1], cubes: [box([26, 0], [-1, 0, -3], [3, 5, 3])] },
    { pivot: [-4, 13, 0], cubes: [box([24, 13], [0, 0, -3], [1, 4, 6])] },
    { pivot: [4, 13, 0], cubes: [box([24, 13], [-1, 0, -3], [1, 4, 6])] },
  ],
}

const QUARTER_PI = Math.PI / 4
const EIGHTH_PI = Math.PI / 8
const SPIDER_SPLAY = 0.58119464

const SPIDER: MobModel = {
  id: 'spider',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, 15, -3], cubes: [box([32, 4], [-4, -4, -8], [8, 8, 8])] },
    { pivot: [0, 15, 0], cubes: [box([0, 0], [-3, -3, -3], [6, 6, 6])] },
    { pivot: [0, 15, 9], cubes: [box([0, 12], [-5, -4, -6], [10, 8, 12])] },
    // Right legs reach towards -x, left legs towards +x, fanned out like Minecraft's.
    ...(
      [
        [2, QUARTER_PI, QUARTER_PI],
        [1, EIGHTH_PI, SPIDER_SPLAY],
        [0, -EIGHTH_PI, SPIDER_SPLAY],
        [-1, -QUARTER_PI, QUARTER_PI],
      ] as const
    ).flatMap(([z, turn, splay]): MobPart[] => [
      {
        pivot: [-4, 15, z],
        rotation: [0, turn, -splay],
        cubes: [box([18, 0], [-15, -1, -1], [16, 2, 2])],
      },
      {
        pivot: [4, 15, z],
        rotation: [0, -turn, splay],
        cubes: [box([18, 0], [-1, -1, -1], [16, 2, 2])],
      },
    ]),
  ],
}

const ENDERMAN: MobModel = {
  id: 'enderman',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, -13, 0], cubes: [box([0, 0], [-4, -8, -4], [8, 8, 8], { inflate: -0.5 })] },
    { pivot: [0, -13, 0], cubes: [box([0, 16], [-4, -8, -4], [8, 8, 8], { inflate: -0.5 })] },
    { pivot: [0, -14, 0], cubes: [box([32, 16], [-4, 0, -2], [8, 12, 4])] },
    { pivot: [-5, -12, 0], cubes: [box([56, 0], [-1, -2, -1], [2, 30, 2])] },
    { pivot: [5, -12, 0], cubes: [box([56, 0], [-1, -2, -1], [2, 30, 2], { mirror: true })] },
    { pivot: [-2, -5, 0], cubes: [box([56, 0], [-1, 0, -1], [2, 30, 2])] },
    { pivot: [2, -5, 0], cubes: [box([56, 0], [-1, 0, -1], [2, 30, 2], { mirror: true })] },
  ],
}

const SLIME: MobModel = {
  id: 'slime',
  textureSize: [64, 32],
  parts: [
    {
      pivot: [0, 0, 0],
      cubes: [
        box([0, 16], [-3, 17, -3], [6, 6, 6]),
        box([32, 0], [-3.25, 18, -3.5], [2, 2, 2]),
        box([32, 4], [1.25, 18, -3.5], [2, 2, 2]),
        box([32, 8], [0, 21, -3.5], [1, 1, 1]),
        // The see-through outer cube last, so the inside shows through it.
        box([0, 0], [-4, 16, -4], [8, 8, 8]),
      ],
    },
  ],
}

const WOLF: MobModel = {
  id: 'wolf',
  textureSize: [64, 32],
  parts: [
    {
      pivot: [-1, 13.5, -7],
      cubes: [
        box([0, 0], [-2, -3, -2], [6, 6, 4]),
        box([16, 14], [-2, -5, 0], [2, 2, 1]),
        box([16, 14], [2, -5, 0], [2, 2, 1]),
        box([0, 10], [-0.5, 0, -5], [3, 3, 4]),
      ],
    },
    {
      pivot: [0, 14, 2],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([18, 14], [-3, -2, -3], [6, 9, 6])],
    },
    {
      pivot: [-1, 14, -3],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([21, 0], [-3, -3, -3], [8, 6, 7])],
    },
    ...[
      [-2.5, 7],
      [0.5, 7],
      [-2.5, -4],
      [0.5, -4],
    ].map(([x, z]): MobPart => ({
      pivot: [x, 16, z],
      cubes: [box([0, 18], [0, 0, -1], [2, 8, 2])],
    })),
    {
      pivot: [-1, 12, 8],
      rotation: [Math.PI / 5, 0, 0],
      cubes: [box([9, 18], [0, 0, -1], [2, 8, 2])],
    },
  ],
}

const IRON_GOLEM: MobModel = {
  id: 'iron_golem',
  textureSize: [128, 128],
  parts: [
    {
      pivot: [0, -7, -2],
      cubes: [box([0, 0], [-4, -12, -5.5], [8, 10, 8]), box([24, 0], [-1, -5, -7.5], [2, 4, 2])],
    },
    {
      pivot: [0, -7, 0],
      cubes: [
        box([0, 40], [-9, -2, -6], [18, 12, 11]),
        box([0, 70], [-4.5, 10, -3], [9, 5, 6], { inflate: 0.5 }),
      ],
    },
    { pivot: [0, -7, 0], cubes: [box([60, 21], [-13, -2.5, -3], [4, 30, 6])] },
    { pivot: [0, -7, 0], cubes: [box([60, 58], [9, -2.5, -3], [4, 30, 6])] },
    { pivot: [-4, 11, 0], cubes: [box([37, 0], [-3.5, -3, -3], [6, 16, 5])] },
    { pivot: [5, 11, 0], cubes: [box([60, 0], [-3.5, -3, -3], [6, 16, 5], { mirror: true })] },
  ],
}

const MODELS: MobModel[] = [
  humanoid('zombie', 64),
  humanoid('humanoid_legacy', 32),
  humanoid('skeleton', 32, 2),
  player('player_wide', false, true),
  player('player_slim', true, true),
  player('drowned', false, false),
  cow('cow'),
  pig('pig'),
  sheep('sheep', false),
  sheep('sheep_wool', true),
  CREEPER,
  CHICKEN,
  SPIDER,
  ENDERMAN,
  SLIME,
  WOLF,
  IRON_GOLEM,
]

/** Which models a texture can be shown on, best first (texture paths differ by version). */
const TEXTURE_MODELS: [RegExp, string[]][] = [
  [/^entity\/zombie\/(zombie|husk)\.png$/, ['zombie', 'humanoid_legacy']],
  [/^entity\/zombie\/drowned(_outer_layer)?\.png$/, ['drowned']],
  [/^entity\/zombie\.png$/, ['zombie', 'humanoid_legacy']],
  [/^entity\/player\/wide\/[a-z_]+\.png$/, ['player_wide']],
  [/^entity\/player\/slim\/[a-z_]+\.png$/, ['player_slim']],
  [/^entity\/steve\.png$/, ['player_wide', 'humanoid_legacy']],
  [/^entity\/alex\.png$/, ['player_slim']],
  [
    /^entity\/skeleton\/(skeleton|stray|wither_skeleton|bogged|stray_overlay|bogged_overlay)\.png$/,
    ['skeleton'],
  ],
  [/^entity\/creeper\/creeper\.png$/, ['creeper']],
  [/^entity\/cow\/(cow|red_mooshroom|brown_mooshroom)\.png$/, ['cow']],
  [/^entity\/pig\/(pig|pig_saddle)\.png$/, ['pig']],
  [/^entity\/sheep\/sheep\.png$/, ['sheep']],
  [/^entity\/sheep\/(sheep_fur|sheep_wool)\.png$/, ['sheep_wool']],
  [/^entity\/chicken\.png$/, ['chicken']],
  [/^entity\/spider\/(spider|cave_spider)\.png$/, ['spider']],
  [/^entity\/enderman\/(enderman|enderman_eyes)\.png$/, ['enderman']],
  [/^entity\/slime\/slime\.png$/, ['slime']],
  [/^entity\/wolf\/wolf[a-z_]*\.png$/, ['wolf']],
  [/^entity\/iron_golem\/iron_golem[a-z_]*\.png$/, ['iron_golem']],
]

/**
 * The mob model for a texture, if there is one whose layout fits the texture's size. Packs
 * may use higher resolutions, as long as the aspect ratio stays the same.
 */
export function mobModelFor(path: string, width: number, height: number): MobModel | null {
  const ids = TEXTURE_MODELS.find(([pattern]) => pattern.test(path))?.[1]
  if (!ids || width <= 0 || height <= 0) return null
  for (const id of ids) {
    const model = MODELS.find((entry) => entry.id === id)
    if (model && model.textureSize[0] * height === model.textureSize[1] * width) return model
  }
  return null
}
