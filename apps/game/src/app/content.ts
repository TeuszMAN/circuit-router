import type { Campaign } from '../ui/campaign'
import { PACKS } from '@circuit/content/packs'

export function createCampaign(): Campaign {
  const levels = PACKS.flatMap((p) => p.levels)
  const summaries = PACKS.flatMap((pack) =>
    pack.levels.map((level) => ({
      id: level.id,
      name: level.name,
      pack: { id: pack.id, name: pack.name, theme: pack.theme },
    })),
  )
  const byId = new Map(levels.map((l) => [l.id, l]))

  return {
    summaries,
    level(id) {
      return byId.get(id)
    },
  }
}
