export const RegularUnitName = {
  WARD_HANDS: 'Ward-hands',
  WARRIOR: 'Warrior',
  DWARF: 'Dwarf',
  ORC: 'Orc',
  HALFLING: 'Halfling',
  ELF: 'Elf',
  DARK_ELF: 'Dark-Elf',
  // Driven Doctrine units
  GOLEM: 'Golem',
  GARGOYLE: 'Gargoyle',
  DENDRITE: 'Dendrite',
  // available only via SUMMON UNDEAD Spell
  UNDEAD: 'Undead',
} as const;

export type RegularUnitType = (typeof RegularUnitName)[keyof typeof RegularUnitName];

export const WarMachineName = {
  BALLISTA: 'Ballista',
  CATAPULT: 'Catapult',
  BATTERING_RAM: 'Battering Ram',
  SIEGE_TOWER: 'Siege Tower',
} as const;

export type WarMachineType = (typeof WarMachineName)[keyof typeof WarMachineName];

export const HeroUnitName = {
  // non-mage heroes units
  FIGHTER: 'Fighter',
  HAMMER_LORD: 'Hammer-lord',
  RANGER: 'Ranger',
  SHADOW_BLADE: 'Shadowblade',
  OGR: 'Ogr',
  // mage heroes units
  PYROMANCER: 'Pyromancer',
  CLERIC: 'Cleric',
  DRUID: 'Druid',
  ENCHANTER: 'Enchanter',
  NECROMANCER: 'Necromancer',
  // non-magic heroes (heroes who reject magic at all)
  WARSMITH: 'Warsmith',
} as const;

export type HeroUnitType = (typeof HeroUnitName)[keyof typeof HeroUnitName];

export type UnitType = RegularUnitType | HeroUnitType | WarMachineType;
