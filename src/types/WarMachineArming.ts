import type { RegularUnitType } from './UnitType';
import type { CombatStats } from '../domain/army/unitRepository';

/**
 * Represents an armed war machine with stats derived from a regular unit
 */
export interface ArmedWarMachine {
  /** The regular unit type used to arm this war machine */
  armedWith: RegularUnitType;
  /** Calculated combat stats based on the armed unit */
  combatStats: CombatStats;
}

/**
 * Calculates war machine combat stats based on the unit it's armed with.
 *
 * War machines gain stats from the unit they're armed with, with the following modifiers:
 * - Attack: +50% bonus (war machine amplifies the unit's offensive power)
 * - Defense: +100% bonus (war machine provides heavy armor protection)
 * - Health: Total HP of all units used to arm it (pack size * unit HP)
 * - Speed: Very low (1 or 2)
 * - Range: War machines become ranged with significant range boost
 * - Range Damage: Based on attack with range multiplier
 * - Cooldown: Slower fire rate (e.g. 2.5s - 3.5s)
 *
 * @param unitStats - The combat stats of the unit being used to arm the war machine
 * @param packSize - The number of units in the arming pack
 * @returns Calculated combat stats for the armed war machine
 */
export function calculateArmedWarMachineStats(
  unitStats: CombatStats,
  packSize: number
): CombatStats & { cooldownMs?: number } {
  const attack = Math.round(unitStats.attack * 2); // +100% attack
  const defense = Math.round(unitStats.defense * 2); // +100% defense
  // Health is total HP of all units in the pack
  const health = unitStats.health * packSize;
  // Speed is forced to 1 or 2
  const speed = Math.max(1, Math.min(2, Math.round(unitStats.speed * 0.3)));

  // War machines gain powerful ranged capability
  const range = 45; // Fixed range for armed war machines
  const rangeDamage = Math.round(attack * 1.5); // 150% of modified attack

  // Slower fire rate for war machines (3 seconds)
  const cooldownMs = 3000;

  return {
    attack,
    defense,
    health,
    speed,
    range,
    rangeDamage,
    cooldownMs,
  };
}
