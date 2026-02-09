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
 * - Health: +150% bonus (war machine structure is much more durable)
 * - Speed: -50% penalty (war machines are slow and cumbersome)
 * - Range: War machines become ranged with significant range boost
 * - Range Damage: Based on attack with range multiplier
 *
 * @param unitStats - The combat stats of the unit being used to arm the war machine
 * @returns Calculated combat stats for the armed war machine
 */
export function calculateArmedWarMachineStats(unitStats: CombatStats): CombatStats {
  const attack = Math.round(unitStats.attack * 2); // +100% attack (increased from 1.5)
  const defense = Math.round(unitStats.defense * 2); // +100% defense
  const health = Math.round(unitStats.health * 2.5); // +150% health
  const speed = Math.round(unitStats.speed * 0.5); // -50% speed (slower)

  // War machines gain powerful ranged capability
  const range = 35; // Fixed range for armed war machines (increased from 25)
  const rangeDamage = Math.round(attack * 1.2); // 120% of modified attack (increased from 0.9)

  return {
    attack,
    defense,
    health,
    speed,
    range,
    rangeDamage,
  };
}
