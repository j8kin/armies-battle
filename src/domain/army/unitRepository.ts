import { HeroUnitName, RegularUnitName } from '../../types/UnitType';
import type { HeroUnitType, RegularUnitType } from '../../types/UnitType';

export interface CombatStats {
  attack: number;
  defense: number;
  health: number;
  speed: number;
  range?: number;
  rangeDamage?: number;
}

export const unitCombatStats: Record<RegularUnitType | HeroUnitType, CombatStats> = {
  [RegularUnitName.WARD_HANDS]: {
    attack: 5,
    defense: 3,
    health: 20,
    speed: 2,
  },
  [RegularUnitName.WARRIOR]: {
    attack: 8,
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
    attack: 30,
    defense: 3,
    range: 2,
    rangeDamage: 30,
    health: 18,
    speed: 4,
  },
  [HeroUnitName.FIGHTER]: {
    attack: 30,
    defense: 3,
    range: 2,
    rangeDamage: 30,
    health: 18,
    speed: 4,
  },
  // Dwarf hero
  [HeroUnitName.HAMMER_LORD]: {
    attack: 40,
    defense: 3,
    range: 2,
    rangeDamage: 40,
    health: 25,
    speed: 4,
  },
  // Orc hero
  [HeroUnitName.OGR]: {
    attack: 40,
    defense: 4,
    range: 2,
    rangeDamage: 45,
    health: 30,
    speed: 3,
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
    range: 2,
    rangeDamage: 25,
    health: 20,
    speed: 2,
  },
  // Druid - produce green mana
  [HeroUnitName.DRUID]: {
    attack: 20,
    defense: 4,
    range: 2,
    rangeDamage: 20,
    health: 22,
    speed: 3,
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
};
