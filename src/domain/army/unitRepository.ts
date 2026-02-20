import { HeroUnitName, RegularUnitName, WarMachineName } from '../../types/UnitType';
import type { HeroUnitType, RegularUnitType, WarMachineType } from '../../types/UnitType';

export interface CombatStats {
  attack: number;
  defense: number;
  health: number;
  speed: number;
  range?: number;
  rangeDamage?: number;
}

export const unitCombatStats: Record<RegularUnitType | HeroUnitType | WarMachineType, CombatStats> = {
  [RegularUnitName.WARD_HANDS]: {
    attack: 5,
    defense: 3,
    health: 20,
    speed: 2,
  },
  [RegularUnitName.WARRIOR]: {
    attack: 15,
    defense: 6,
    health: 25,
    speed: 2,
  },
  [RegularUnitName.DWARF]: {
    attack: 12,
    defense: 20,
    health: 40,
    speed: 1,
  },
  [RegularUnitName.GOLEM]: {
    attack: 25,
    defense: 50,
    health: 10,
    speed: 5,
  },
  [RegularUnitName.GARGOYLE]: {
    attack: 25,
    defense: 50,
    health: 10,
    speed: 5,
  },
  [RegularUnitName.DENDRITE]: {
    attack: 25,
    defense: 50,
    health: 10,
    speed: 5,
  },
  [RegularUnitName.UNDEAD]: {
    attack: 25,
    defense: 50,
    health: 10,
    speed: 5,
  },
  [RegularUnitName.ORC]: {
    attack: 10,
    defense: 15,
    health: 30,
    speed: 2,
  },
  [RegularUnitName.HALFLING]: {
    attack: 6,
    defense: 3,
    range: 15,
    rangeDamage: 8,
    health: 15,
    speed: 4,
  },
  [RegularUnitName.ELF]: {
    attack: 15,
    defense: 4,
    range: 20,
    rangeDamage: 15,
    health: 20,
    speed: 3,
  },
  [RegularUnitName.DARK_ELF]: {
    attack: 15,
    defense: 4,
    range: 20,
    rangeDamage: 15,
    health: 20,
    speed: 3,
  },
  // HEROES
  // Human warrior hero
  [HeroUnitName.WARSMITH]: {
    attack: 35,
    defense: 3,
    range: 4,
    rangeDamage: 35,
    health: 25,
    speed: 6,
  },
  [HeroUnitName.FIGHTER]: {
    attack: 35,
    defense: 3,
    range: 4,
    rangeDamage: 35,
    health: 25,
    speed: 6,
  },
  // Dwarf hero
  [HeroUnitName.HAMMER_LORD]: {
    attack: 45,
    defense: 15,
    range: 6,
    rangeDamage: 50,
    health: 40,
    speed: 8,
  },
  // Orc hero
  [HeroUnitName.OGR]: {
    attack: 50,
    defense: 4,
    range: 4,
    rangeDamage: 55,
    health: 35,
    speed: 5,
  },
  // Elf hero
  [HeroUnitName.SHADOW_BLADE]: {
    attack: 30,
    defense: 3,
    range: 30,
    rangeDamage: 30,
    health: 18,
    speed: 5,
  },
  [HeroUnitName.RANGER]: {
    attack: 30,
    defense: 3,
    range: 30,
    rangeDamage: 30,
    health: 18,
    speed: 5,
  },
  // Mage Heroes
  // Pyromancer - produce red mana
  [HeroUnitName.PYROMANCER]: {
    attack: 30,
    defense: 3,
    range: 30,
    rangeDamage: 30,
    health: 18,
    speed: 2,
  },
  // Cleric - produce white mana
  [HeroUnitName.CLERIC]: {
    attack: 25,
    defense: 5,
    range: 5,
    rangeDamage: 25,
    health: 22,
    speed: 3,
  },
  // Druid - produce green mana
  [HeroUnitName.DRUID]: {
    attack: 20,
    defense: 4,
    range: 6,
    rangeDamage: 20,
    health: 25,
    speed: 4,
  },
  // Enchanter - produce blue mana
  [HeroUnitName.ENCHANTER]: {
    attack: 15,
    defense: 3,
    range: 35,
    rangeDamage: 15,
    health: 16,
    speed: 2,
  },
  // Necromancer - produce black mana
  [HeroUnitName.NECROMANCER]: {
    attack: 35,
    defense: 2,
    range: 25,
    rangeDamage: 35,
    health: 15,
    speed: 2,
  },
  // WAR MACHINES - Base stats for unarmed war machines (minimal effectiveness)
  // War machines must be armed with a melee unit to become effective
  [WarMachineName.BALLISTA]: {
    attack: 1,
    defense: 10,
    health: 50,
    speed: 1,
  },
  [WarMachineName.CATAPULT]: {
    attack: 1,
    defense: 10,
    health: 50,
    speed: 1,
  },
  [WarMachineName.BATTERING_RAM]: {
    attack: 1,
    defense: 15,
    health: 60,
    speed: 1,
  },
  [WarMachineName.SIEGE_TOWER]: {
    attack: 1,
    defense: 20,
    health: 70,
    speed: 1,
  },
};
