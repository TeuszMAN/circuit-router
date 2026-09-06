import type { Campaign } from '../ui/campaign'
import { PACKS } from '@circuit/content/packs'

export function createCampaign(): Campaign {
  const levels = PACKS.flatMap(p => p.levels)
  const summaries = levels.map(l => ({ id: l.id, name: l.name }))
  const byId = new Map(levels.map(l => [l.id, l]))
  
  return {
    summaries,
    level(id) {
      return byId.get(id)
    }
  }
}
