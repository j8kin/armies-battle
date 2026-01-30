import { HeroUnitName, RegularUnitName, WarMachineName } from '../../types/UnitType';
import type { UnitType, RegularUnitType, WarMachineType, HeroUnitType } from '../../types/UnitType';

/**
 * Type guard to check if a unit type is a hero unit
 * @param unitType - The unit type to check
 * @returns true if the unit is a hero type
 */
export const isHeroType = (unitType: UnitType): unitType is HeroUnitType => {
  return Object.values(HeroUnitName).includes(unitType as HeroUnitType);
};

/**
 * Checks if a unit is a war machine
 * @param unitType - The unit type to check
 * @returns true if the unit is a war machine
 */
export const isWarMachine = (unitType: UnitType): unitType is WarMachineType => {
  return Object.values(WarMachineName).includes(unitType as WarMachineType);
};

export const isRegularUnit = (unitType: UnitType): unitType is RegularUnitType => {
  return Object.values(RegularUnitName).includes(unitType as RegularUnitType);
};

/**
 * Checks if a unit is a mage type hero
 * @param unitType - The unit type to check
 * @returns true if the unit is one of the mage hero types
 */
export const isMageType = (unitType: UnitType): boolean => {
  return (
    unitType === HeroUnitName.PYROMANCER ||
    unitType === HeroUnitName.DRUID ||
    unitType === HeroUnitName.ENCHANTER ||
    unitType === HeroUnitName.CLERIC ||
    unitType === HeroUnitName.NECROMANCER
  );
};

export const isDrivenType = (unitType: UnitType): boolean => {
  return (
    unitType === RegularUnitName.GOLEM ||
    unitType === RegularUnitName.GARGOYLE ||
    unitType === RegularUnitName.DENDRITE ||
    unitType === HeroUnitName.WARSMITH
  );
};
