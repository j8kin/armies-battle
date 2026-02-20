import { BattleArmy, BattleSide } from '../state/army/BattleArmy';
import { RegularUnitName, HeroUnitName, WarMachineName } from '../types/UnitType';
import { UnitRank } from '../state/army/RegularsState';
import { unitCombatStats } from '../domain/army/unitRepository';

export const HUMAN_ARMY: BattleArmy = {
  controlledBy: 'human',
  battleSide: BattleSide.ATTACKER,
  regulars: [
    {
      type: RegularUnitName.WARRIOR,
      rank: UnitRank.REGULAR,
      count: 60,
      combatStats: unitCombatStats[RegularUnitName.WARRIOR],
      cost: 10,
    },
    {
      type: RegularUnitName.ELF,
      rank: UnitRank.REGULAR,
      count: 40,
      combatStats: unitCombatStats[RegularUnitName.ELF],
      cost: 15,
    },
  ],
  heroes: [
    {
      id: 'hero-1',
      type: HeroUnitName.FIGHTER,
      name: 'Sir Arthur',
      level: 1,
      combatStats: unitCombatStats[HeroUnitName.FIGHTER],
      artifacts: [],
      cost: 100,
    },
  ],
  warMachines: [
    {
      type: WarMachineName.CATAPULT,
      count: 2,
      durability: 10,
    },
  ],
};

export const COMPUTER_ARMY: BattleArmy = {
  controlledBy: 'computer',
  battleSide: BattleSide.DEFENDER,
  regulars: [
    {
      type: RegularUnitName.ORC,
      rank: UnitRank.REGULAR,
      count: 100,
      combatStats: unitCombatStats[RegularUnitName.ORC],
      cost: 5,
    },
    {
      type: RegularUnitName.HALFLING,
      rank: UnitRank.REGULAR,
      count: 80,
      combatStats: unitCombatStats[RegularUnitName.HALFLING],
      cost: 20,
    },
  ],
  heroes: [
    {
      id: 'hero-2',
      type: HeroUnitName.NECROMANCER,
      name: 'Malphas',
      level: 2,
      combatStats: unitCombatStats[HeroUnitName.NECROMANCER],
      artifacts: [],
      cost: 150,
    },
  ],
  warMachines: [
    {
      type: WarMachineName.BALLISTA,
      count: 1,
      durability: 8,
    },
  ],
};
