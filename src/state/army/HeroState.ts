import type { HeroUnitType } from '../../types/UnitType';
import type { Artifact } from '../../types/Treasures';
import type { CombatStats } from '../../domain/army/unitRepository';

export interface HeroState {
  id: string; // uuid
  type: HeroUnitType;
  name: string;
  level: number;
  combatStats: CombatStats;
  artifacts: Artifact[]; // for now, it is planned to have only one artifact per hero
  mana?: number; // how many mana produced per turn, undefined for non-magic heroes
  cost: number; // maintenance cost per turn
}
