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

/**
 * Villagers, their zombies, illagers and witches share a body: a long head with a nose, a robe
 * over the body, folded arms and two legs.
 */
function villager(
  id: string,
  options: { textureHeight?: number; hat?: boolean; foldedArms?: boolean; robe?: number } = {},
): MobModel {
  const { textureHeight = 64, hat = true, foldedArms = true, robe = 0.5 } = options
  const head: MobPart = {
    pivot: [0, 0, 0],
    cubes: [box([0, 0], [-4, -10, -4], [8, 10, 8])],
    children: [
      { pivot: [0, -2, 0], cubes: [box([24, 0], [-1, -1, -6], [2, 4, 2])] },
      ...(hat
        ? [
            {
              pivot: [0, 0, 0] as Vec3,
              cubes: [box([32, 0], [-4, -10, -4], [8, 10, 8], { inflate: 0.51 })],
              // Straw hats and hoods have a brim, flat around the head.
              children: [
                {
                  pivot: [0, 0, 0] as Vec3,
                  rotation: [-HALF_PI, 0, 0] as Vec3,
                  cubes: [box([30, 47], [-8, -8, -6], [16, 16, 1])],
                },
              ],
            },
          ]
        : []),
    ],
  }
  const arms: MobPart[] = foldedArms
    ? [
        {
          pivot: [0, 3, -1],
          rotation: [-0.75, 0, 0],
          cubes: [
            box([44, 22], [-8, -2, -2], [4, 8, 4]),
            box([44, 22], [4, -2, -2], [4, 8, 4], { mirror: true }),
            box([40, 38], [-4, 2, -2], [8, 4, 4]),
          ],
        },
      ]
    : [
        { pivot: [-5, 2, 0], cubes: [box([44, 22], [-3, -2, -2], [4, 12, 4])] },
        { pivot: [5, 2, 0], cubes: [box([44, 22], [-1, -2, -2], [4, 12, 4], { mirror: true })] },
      ]
  return {
    id,
    textureSize: [64, textureHeight],
    parts: [
      head,
      {
        pivot: [0, 0, 0],
        cubes: [
          box([16, 20], [-4, 0, -3], [8, 12, 6]),
          box([0, 38], [-4, 0, -3], [8, 20, 6], { inflate: robe }),
        ],
      },
      ...arms,
      { pivot: [-2, 12, 0], cubes: [box([0, 22], [-2, 0, -2], [4, 12, 4])] },
      { pivot: [2, 12, 0], cubes: [box([0, 22], [-2, 0, -2], [4, 12, 4], { mirror: true })] },
    ],
  }
}

function witch(): MobModel {
  const model = villager('witch', { textureHeight: 128, hat: false })
  const [head] = model.parts
  // A pointed hat of four ever smaller, slightly bent boxes, and a mole on the nose.
  const hat: MobPart = {
    pivot: [-5, -10.03125, -5],
    cubes: [box([0, 64], [0, 0, 0], [10, 2, 10])],
    children: [
      {
        pivot: [1.75, -4, 2],
        rotation: [-0.05235988, 0, 0.02617994],
        cubes: [box([0, 76], [0, 0, 0], [7, 4, 7])],
        children: [
          {
            pivot: [1.75, -4, 2],
            rotation: [-0.10471976, 0, 0.05235988],
            cubes: [box([0, 87], [0, 0, 0], [4, 4, 4])],
            children: [
              {
                pivot: [1.75, -2, 2],
                rotation: [-0.20943952, 0, 0.10471976],
                cubes: [box([0, 95], [0, 0, 0], [1, 2, 1], { inflate: 0.25 })],
              },
            ],
          },
        ],
      },
    ],
  }
  const [nose] = head.children ?? []
  const mole: MobPart = {
    pivot: [0, -2, 0],
    cubes: [box([0, 0], [0, 3, -6.75], [1, 1, 1], { inflate: -0.25 })],
  }
  return {
    ...model,
    parts: [{ ...head, children: [{ ...nose, children: [mole] }, hat] }, ...model.parts.slice(1)],
  }
}

/** Piglins: a player's body with a wide head, snout, tusks and floppy ears. */
function piglin(id: string): MobModel {
  const model = player(id, false, true)
  const head: MobPart = {
    pivot: [0, 0, 0],
    cubes: [
      box([0, 0], [-5, -8, -4], [10, 8, 8]),
      box([31, 1], [-2, -4, -5], [4, 4, 1]),
      box([2, 4], [2, -2, -5], [1, 2, 1]),
      box([2, 0], [-3, -2, -5], [1, 2, 1]),
    ],
    children: [
      {
        pivot: [4.5, -6, 0],
        rotation: [0, 0, -Math.PI / 6],
        cubes: [box([51, 6], [0, 0, -2], [1, 5, 4])],
      },
      {
        pivot: [-4.5, -6, 0],
        rotation: [0, 0, Math.PI / 6],
        cubes: [box([39, 6], [-1, 0, -2], [1, 5, 4])],
      },
    ],
  }
  // The player's head and hat (the first two parts) give way to the piglin's head.
  return { ...model, parts: [head, ...model.parts.slice(2)] }
}

const CAT: MobModel = {
  id: 'cat',
  textureSize: [64, 32],
  parts: [
    {
      pivot: [0, 15, -9],
      cubes: [
        box([0, 0], [-2.5, -2, -3], [5, 4, 5]),
        box([0, 24], [-1.5, -0.001, -4], [3, 2, 2]),
        box([0, 10], [-2, -3, 0], [1, 1, 2]),
        box([6, 10], [1, -3, 0], [1, 1, 2]),
      ],
    },
    {
      pivot: [0, 12, -10],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([20, 0], [-2, 3, -8], [4, 16, 6])],
    },
    { pivot: [0, 15, 8], rotation: [0.9, 0, 0], cubes: [box([0, 15], [-0.5, 0, 0], [1, 8, 1])] },
    {
      pivot: [0, 20, 14],
      rotation: [1.7278761, 0, 0],
      cubes: [box([4, 15], [-0.5, 0, 0], [1, 8, 1])],
    },
    { pivot: [1.1, 18, 5], cubes: [box([8, 13], [-1, 0, 1], [2, 6, 2])] },
    { pivot: [-1.1, 18, 5], cubes: [box([8, 13], [-1, 0, 1], [2, 6, 2])] },
    { pivot: [1.2, 14.1, -5], cubes: [box([40, 0], [-1, 0, 0], [2, 10, 2])] },
    { pivot: [-1.2, 14.1, -5], cubes: [box([40, 0], [-1, 0, 0], [2, 10, 2])] },
  ],
}

/** Horses (and donkeys and mules, with their long ears). */
function horse(id: string, longEars: boolean): MobModel {
  const leg = (x: number, z: number, mirror: boolean): MobPart => ({
    pivot: [x, 14, z],
    cubes: [box([48, 21], [mirror ? -3 : -1, -1.01, z < 0 ? -1.9 : -1], [4, 11, 4], { mirror })],
  })
  const ears: MobPart[] = longEars
    ? [1, -1].map((side) => ({
        pivot: [side * 1.25, -10, 4] as Vec3,
        rotation: [0.2617994, 0, side * 0.2617994] as Vec3,
        cubes: [box([0, 12], [-1, -7, 0], [2, 7, 1])],
      }))
    : [
        {
          pivot: [0, 0, 0],
          cubes: [
            box([19, 16], [0.55, -13, 4], [2, 3, 1], { inflate: -0.001 }),
            box([19, 16], [-2.55, -13, 4], [2, 3, 1], { inflate: -0.001 }),
          ],
        },
      ]
  return {
    id,
    textureSize: [64, 64],
    parts: [
      {
        pivot: [0, 11, 5],
        cubes: [box([0, 32], [-5, -8, -17], [10, 10, 22], { inflate: 0.05 })],
        children: [
          {
            pivot: [0, -5, 2],
            rotation: [Math.PI / 6, 0, 0],
            cubes: [box([42, 36], [-1.5, 0, 0], [3, 14, 4])],
          },
        ],
      },
      {
        pivot: [0, 4, -12],
        rotation: [Math.PI / 6, 0, 0],
        cubes: [
          box([0, 35], [-2.05, -6, -2], [4, 12, 7]),
          box([56, 36], [-1, -11, 5.01], [2, 16, 2]),
          box([0, 25], [-2, -11, -7], [4, 5, 5]),
        ],
        children: [
          { pivot: [0, 0, 0], cubes: [box([0, 13], [-3, -11, -2], [6, 5, 7])], children: ears },
        ],
      },
      leg(4, 7, true),
      leg(-4, 7, false),
      leg(4, -10, true),
      leg(-4, -10, false),
    ],
  }
}

const FOX: MobModel = {
  id: 'fox',
  textureSize: [48, 32],
  parts: [
    {
      pivot: [-1, 16.5, -3],
      cubes: [
        box([1, 5], [-3, -2, -5], [8, 6, 6]),
        box([8, 1], [-3, -4, -4], [2, 2, 1]),
        box([15, 1], [3, -4, -4], [2, 2, 1]),
        box([6, 18], [-1, 2.01, -8], [4, 2, 3]),
      ],
    },
    {
      pivot: [0, 16, -6],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([24, 15], [-3, 3.999, -3.5], [6, 11, 6])],
      children: [
        {
          pivot: [-4, 15, -1],
          rotation: [-0.05235988, 0, 0],
          cubes: [box([30, 0], [2, 0, -1], [4, 9, 5])],
        },
      ],
    },
    ...(
      [
        [-5, 7, 13],
        [-1, 7, 4],
        [-5, 0, 13],
        [-1, 0, 4],
      ] as const
    ).map(([x, z, u]): MobPart => ({
      pivot: [x, 17.5, z],
      cubes: [box([u, 24], [2, 0.5, -1], [2, 6, 2], { inflate: 0.001 })],
    })),
  ],
}

const SQUID: MobModel = {
  id: 'squid',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, 8, 0], cubes: [box([0, 0], [-6, -8, -6], [12, 16, 12])] },
    // Eight tentacles in a ring under the body.
    ...Array.from({ length: 8 }, (_, i): MobPart => {
      const angle = (i * Math.PI * 2) / 8
      return {
        pivot: [Math.cos(angle) * 5, 15, Math.sin(angle) * 5],
        rotation: [0, -angle + HALF_PI, 0],
        cubes: [box([48, 0], [-1, 0, -1], [2, 18, 2])],
      }
    }),
  ],
}

/** In the game the ghast's tentacles have random lengths; these are fixed ones in that range. */
const GHAST_TENTACLES = [10, 13, 9, 12, 8, 14, 11, 9, 12]

const GHAST: MobModel = {
  id: 'ghast',
  textureSize: [64, 32],
  parts: [
    { pivot: [0, 17.6, 0], cubes: [box([0, 0], [-8, -8, -8], [16, 16, 16])] },
    ...GHAST_TENTACLES.map((length, i): MobPart => {
      const column = i % 3
      const row = Math.floor(i / 3)
      return {
        pivot: [(column - 0.75 - (row % 2) * 0.5) * 5, 24.6, (row - 1) * 5],
        cubes: [box([0, 0], [-1, 0, -1], [2, length, 2])],
      }
    }),
  ],
}

/** The blaze's twelve rods in three rings, where the game has them at the first moment. */
function blazeRods(): MobPart[] {
  const rod = (x: number, y: number, z: number): MobPart => ({
    pivot: [x, y, z],
    cubes: [box([0, 16], [0, 0, 0], [2, 8, 2])],
  })
  const rods: MobPart[] = []
  for (let i = 0; i < 4; i++) {
    rods.push(rod(Math.cos(i) * 9, -2 + Math.cos(i * 2 * 0.25), Math.sin(i) * 9))
  }
  for (let j = 4; j < 8; j++) {
    const angle = Math.PI / 4 + (j - 4)
    rods.push(rod(Math.cos(angle) * 7, 2 + Math.cos(j * 2 * 0.25), Math.sin(angle) * 7))
  }
  for (let k = 8; k < 12; k++) {
    const angle = 0.47123894 + (k - 8)
    rods.push(rod(Math.cos(angle) * 5, 11 + Math.cos(k * 1.5 * 0.5), Math.sin(angle) * 5))
  }
  return rods
}

const BLAZE: MobModel = {
  id: 'blaze',
  textureSize: [64, 32],
  parts: [{ pivot: [0, 0, 0], cubes: [box([0, 0], [-4, -4, -4], [8, 8, 8])] }, ...blazeRods()],
}

const SNOW_GOLEM: MobModel = {
  id: 'snow_golem',
  textureSize: [64, 64],
  parts: [
    { pivot: [0, 4, 0], cubes: [box([0, 0], [-4, -8, -4], [8, 8, 8], { inflate: -0.5 })] },
    {
      pivot: [5, 6, 1],
      rotation: [0, 0, 1],
      cubes: [box([32, 0], [-1, 0, -1], [12, 2, 2], { inflate: -0.5 })],
    },
    {
      pivot: [-5, 6, -1],
      rotation: [0, Math.PI, -1],
      cubes: [box([32, 0], [-1, 0, -1], [12, 2, 2], { inflate: -0.5 })],
    },
    { pivot: [0, 13, 0], cubes: [box([0, 16], [-5, -10, -5], [10, 10, 10], { inflate: -0.5 })] },
    { pivot: [0, 24, 0], cubes: [box([0, 36], [-6, -12, -6], [12, 12, 12], { inflate: -0.5 })] },
  ],
}

const POLAR_BEAR: MobModel = {
  id: 'polar_bear',
  textureSize: [128, 64],
  parts: [
    {
      pivot: [0, 10, -16],
      cubes: [
        box([0, 0], [-3.5, -3, -3], [7, 7, 7]),
        box([0, 44], [-2.5, 1, -6], [5, 3, 3]),
        box([26, 0], [-4.5, -4, -1], [2, 2, 1]),
        box([26, 0], [2.5, -4, -1], [2, 2, 1], { mirror: true }),
      ],
    },
    {
      pivot: [-2, 9, 12],
      rotation: [HALF_PI, 0, 0],
      cubes: [box([0, 19], [-5, -13, -7], [14, 14, 11]), box([39, 0], [-4, -25, -7], [12, 12, 10])],
    },
    { pivot: [-4.5, 14, 6], cubes: [box([50, 22], [-2, 0, -2], [4, 10, 8])] },
    { pivot: [4.5, 14, 6], cubes: [box([50, 22], [-2, 0, -2], [4, 10, 8])] },
    { pivot: [-3.5, 14, -8], cubes: [box([50, 40], [-2, 0, -2], [4, 10, 6])] },
    { pivot: [3.5, 14, -8], cubes: [box([50, 40], [-2, 0, -2], [4, 10, 6])] },
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
  villager('villager'),
  villager('zombie_villager', { foldedArms: false, robe: 0.05 }),
  villager('illager', { hat: false }),
  witch(),
  piglin('piglin'),
  CAT,
  horse('horse', false),
  horse('donkey', true),
  FOX,
  SQUID,
  GHAST,
  BLAZE,
  SNOW_GOLEM,
  POLAR_BEAR,
]

/**
 * Which models a texture can be shown on, best first (texture paths differ by version), and for
 * overlays (a villager's profession, a saddle, eyes) the textures drawn underneath them.
 */
const TEXTURE_MODELS: { pattern: RegExp; models: string[]; under?: string[] }[] = [
  { pattern: /^entity\/zombie\/(zombie|husk)\.png$/, models: ['zombie', 'humanoid_legacy'] },
  { pattern: /^entity\/zombie\/drowned\.png$/, models: ['drowned'] },
  {
    pattern: /^entity\/zombie\/drowned_outer_layer\.png$/,
    models: ['drowned'],
    under: ['entity/zombie/drowned.png'],
  },
  { pattern: /^entity\/zombie\.png$/, models: ['zombie', 'humanoid_legacy'] },
  { pattern: /^entity\/player\/wide\/[a-z_]+\.png$/, models: ['player_wide'] },
  { pattern: /^entity\/player\/slim\/[a-z_]+\.png$/, models: ['player_slim'] },
  { pattern: /^entity\/steve\.png$/, models: ['player_wide', 'humanoid_legacy'] },
  { pattern: /^entity\/alex\.png$/, models: ['player_slim'] },
  {
    pattern: /^entity\/skeleton\/(skeleton|stray|wither_skeleton|bogged)\.png$/,
    models: ['skeleton'],
  },
  {
    pattern: /^entity\/skeleton\/stray_overlay\.png$/,
    models: ['skeleton'],
    under: ['entity/skeleton/stray.png'],
  },
  {
    pattern: /^entity\/skeleton\/bogged_overlay\.png$/,
    models: ['skeleton'],
    under: ['entity/skeleton/bogged.png'],
  },
  { pattern: /^entity\/creeper\/creeper\.png$/, models: ['creeper'] },
  { pattern: /^entity\/cow\/(cow|red_mooshroom|brown_mooshroom)\.png$/, models: ['cow'] },
  { pattern: /^entity\/pig\/pig\.png$/, models: ['pig'] },
  { pattern: /^entity\/pig\/pig_saddle\.png$/, models: ['pig'], under: ['entity/pig/pig.png'] },
  { pattern: /^entity\/sheep\/sheep\.png$/, models: ['sheep'] },
  { pattern: /^entity\/sheep\/(sheep_fur|sheep_wool)\.png$/, models: ['sheep_wool'] },
  { pattern: /^entity\/chicken\.png$/, models: ['chicken'] },
  { pattern: /^entity\/spider\/(spider|cave_spider)\.png$/, models: ['spider'] },
  { pattern: /^entity\/enderman\/enderman\.png$/, models: ['enderman'] },
  {
    pattern: /^entity\/enderman\/enderman_eyes\.png$/,
    models: ['enderman'],
    under: ['entity/enderman/enderman.png'],
  },
  { pattern: /^entity\/slime\/slime\.png$/, models: ['slime'] },
  {
    pattern: /^entity\/wolf\/wolf_(collar|armor[a-z_]*)\.png$/,
    models: ['wolf'],
    under: ['entity/wolf/wolf_tame.png'],
  },
  { pattern: /^entity\/wolf\/wolf[a-z_]*\.png$/, models: ['wolf'] },
  { pattern: /^entity\/iron_golem\/iron_golem\.png$/, models: ['iron_golem'] },
  {
    pattern: /^entity\/iron_golem\/iron_golem_crackiness_[a-z]+\.png$/,
    models: ['iron_golem'],
    under: ['entity/iron_golem/iron_golem.png'],
  },
  // Villagers wear their biome's clothes and then their profession's over the base body.
  { pattern: /^entity\/villager\/villager\.png$/, models: ['villager'] },
  {
    pattern: /^entity\/villager\/type\/[a-z_]+\.png$/,
    models: ['villager'],
    under: ['entity/villager/villager.png'],
  },
  {
    pattern: /^entity\/villager\/profession(_level)?\/[a-z_]+\.png$/,
    models: ['villager'],
    under: ['entity/villager/villager.png', 'entity/villager/type/plains.png'],
  },
  { pattern: /^entity\/zombie_villager\/zombie_villager\.png$/, models: ['zombie_villager'] },
  {
    pattern: /^entity\/zombie_villager\/type\/[a-z_]+\.png$/,
    models: ['zombie_villager'],
    under: ['entity/zombie_villager/zombie_villager.png'],
  },
  {
    pattern: /^entity\/zombie_villager\/profession(_level)?\/[a-z_]+\.png$/,
    models: ['zombie_villager'],
    under: ['entity/zombie_villager/zombie_villager.png', 'entity/zombie_villager/type/plains.png'],
  },
  {
    pattern: /^entity\/illager\/(pillager|vindicator|evoker|illusioner)\.png$/,
    models: ['illager'],
  },
  { pattern: /^entity\/witch\.png$/, models: ['witch'] },
  { pattern: /^entity\/piglin\/(piglin|piglin_brute|zombified_piglin)\.png$/, models: ['piglin'] },
  {
    pattern: /^entity\/cat\/cat_collar\.png$/,
    models: ['cat'],
    under: ['entity/cat/tabby.png'],
  },
  { pattern: /^entity\/cat\/[a-z_]+\.png$/, models: ['cat'] },
  { pattern: /^entity\/horse\/(donkey|mule)\.png$/, models: ['donkey'] },
  {
    pattern: /^entity\/horse\/horse_markings_[a-z]+\.png$/,
    models: ['horse'],
    under: ['entity/horse/horse_chestnut.png'],
  },
  { pattern: /^entity\/horse\/[a-z_]+\.png$/, models: ['horse'] },
  {
    pattern: /^entity\/equipment\/horse_body\/[a-z_]+\.png$/,
    models: ['horse'],
    under: ['entity/horse/horse_chestnut.png'],
  },
  { pattern: /^entity\/fox\/[a-z_]+\.png$/, models: ['fox'] },
  { pattern: /^entity\/squid\/(squid|glow_squid)\.png$/, models: ['squid'] },
  { pattern: /^entity\/ghast\/(ghast|ghast_shooting)\.png$/, models: ['ghast'] },
  { pattern: /^entity\/blaze\.png$/, models: ['blaze'] },
  { pattern: /^entity\/snow_golem\.png$/, models: ['snow_golem'] },
  { pattern: /^entity\/bear\/polarbear\.png$/, models: ['polar_bear'] },
]

const mappingFor = (path: string) => TEXTURE_MODELS.find(({ pattern }) => pattern.test(path))

/** Textures drawn underneath an overlay texture, bottom first (none for normal textures). */
export function mobTexturesUnder(path: string): string[] {
  return mappingFor(path)?.under ?? []
}

/**
 * The mob model for a texture, if there is one whose layout fits the texture's size. Packs
 * may use higher resolutions, as long as the aspect ratio stays the same.
 */
export function mobModelFor(path: string, width: number, height: number): MobModel | null {
  const ids = mappingFor(path)?.models
  if (!ids || width <= 0 || height <= 0) return null
  for (const id of ids) {
    const model = MODELS.find((entry) => entry.id === id)
    if (model && model.textureSize[0] * height === model.textureSize[1] * width) return model
  }
  return null
}
