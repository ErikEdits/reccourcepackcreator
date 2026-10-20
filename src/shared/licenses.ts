// Licences offered in the pack wizard (docs/DECISIONS.md #110). IDs follow SPDX, as Modrinth expects.

export const PACK_LICENSES = [
  {
    id: 'LicenseRef-All-Rights-Reserved',
    name: 'All Rights Reserved',
    summary: 'Others may use the pack, but not share or change it without your permission.',
  },
  {
    id: 'CC-BY-4.0',
    name: 'CC BY 4.0',
    summary: 'Anyone may share and change it, also commercially, if they credit you.',
  },
  {
    id: 'CC-BY-SA-4.0',
    name: 'CC BY-SA 4.0',
    summary: 'Like CC BY, and changed versions must use the same licence.',
  },
  {
    id: 'CC-BY-NC-4.0',
    name: 'CC BY-NC 4.0',
    summary: 'Anyone may share and change it with credit, but not commercially.',
  },
  {
    id: 'CC-BY-NC-SA-4.0',
    name: 'CC BY-NC-SA 4.0',
    summary: 'Non-commercial, with credit, and changed versions must use the same licence.',
  },
  {
    id: 'CC0-1.0',
    name: 'CC0 (public domain)',
    summary: 'You give up all rights; anyone may do anything with it.',
  },
  {
    id: 'MIT',
    name: 'MIT',
    summary: 'Permissive: anyone may do anything as long as the licence text is kept.',
  },
] as const

export type PackLicenseId = (typeof PACK_LICENSES)[number]['id']

export const PACK_LICENSE_IDS = PACK_LICENSES.map((license) => license.id) as [
  PackLicenseId,
  ...PackLicenseId[],
]

export const DEFAULT_LICENSE: PackLicenseId = 'LicenseRef-All-Rights-Reserved'
