import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DOG_BREEDS, DOG_BREED_QUICK_PICKS, filterDogBreeds } from '../lib/dog-breeds'
import { WALK_AREA_CATALOG } from '../lib/walk-area-catalog'

const fixture = {
  schemaVersion: 1,
  source: ['lib/dog-breeds.ts', 'lib/walk-area-catalog.ts'],
  dogBreeds: DOG_BREEDS,
  dogBreedQuickPicks: DOG_BREED_QUICK_PICKS,
  dogBreedSearchCases: ['', 'しば', 'といぷーどる', 'ﾁﾜﾜ', '雑種', 'ほっかいどう'].map(
    (query) => ({ query, expected: filterDogBreeds(query) })
  ),
  walkAreas: WALK_AREA_CATALOG,
}

const currentFile = fileURLToPath(import.meta.url)
const output = resolve(
  dirname(currentFile),
  '../swift/WanspotKit/Sources/WanspotKit/Resources/onboarding-catalog.json'
)

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)
