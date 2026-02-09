import { HeroUnitName, RegularUnitName, WarMachineName } from '../types/UnitType';
import type { UnitType } from '../types/UnitType';
import type { Team } from './battleTypes';

export const TEAM_COLORS: Record<Team, number> = {
  attacker: 0x4bb3fd,
  defender: 0xfb4d46,
};

export const UNIT_TYPE_COLORS: Partial<Record<UnitType, number>> = {
  // Regular units - Neutral colors
  [RegularUnitName.WARD_HANDS]: 0xcccccc,
  [RegularUnitName.WARRIOR]: 0xaaaaaa,
  [RegularUnitName.DWARF]: 0x8b4513,
  [RegularUnitName.ORC]: 0x228b22,
  [RegularUnitName.HALFLING]: 0xdaa520,
  [RegularUnitName.ELF]: 0x90ee90,
  [RegularUnitName.DARK_ELF]: 0x4b0082,
  [RegularUnitName.GOLEM]: 0x808080,
  [RegularUnitName.GARGOYLE]: 0x696969,
  [RegularUnitName.DENDRITE]: 0x2e8b57,
  [RegularUnitName.UNDEAD]: 0x8b008b,
  // Heroes - Bright colors
  [HeroUnitName.FIGHTER]: 0xff6347,
  [HeroUnitName.HAMMER_LORD]: 0xffa500,
  [HeroUnitName.RANGER]: 0x32cd32,
  [HeroUnitName.SHADOW_BLADE]: 0x9370db,
  [HeroUnitName.OGR]: 0xff4500,
  [HeroUnitName.PYROMANCER]: 0xff0000,
  [HeroUnitName.CLERIC]: 0xffffff,
  [HeroUnitName.DRUID]: 0x00ff00,
  [HeroUnitName.ENCHANTER]: 0x00bfff,
  [HeroUnitName.NECROMANCER]: 0x800080,
  [HeroUnitName.WARSMITH]: 0xffd700,
  // War machines - Dark metallic colors
  [WarMachineName.BALLISTA]: 0x2f4f4f,
  [WarMachineName.CATAPULT]: 0x3c3c3c,
  [WarMachineName.BATTERING_RAM]: 0x4a4a4a,
  [WarMachineName.SIEGE_TOWER]: 0x555555,
};
