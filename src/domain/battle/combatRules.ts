import type { CombatStats } from '../army/unitRepository';

export interface BattleDerivedStats {
  speed: number;
  range: number;
  isRanged: boolean;
  cooldownMs: number;
}

export interface AttackProfile {
  attack: number;
  rangeDamage?: number;
}

export interface DefenseProfile {
  defense: number;
}

const DEFAULT_MELEE_RANGE = 18;
const RANGE_SCALE = 5;
const SPEED_SCALE = 20;
const RANGED_THRESHOLD = 10;
const RANGED_COOLDOWN_MS = 700;
const MELEE_COOLDOWN_MS = 450;

export const speedToPixelsPerSecond = (speed: number) => speed * SPEED_SCALE;

export const rangeToPixels = (range: number | undefined) => (range ? range * RANGE_SCALE : DEFAULT_MELEE_RANGE);

export const deriveBattleStats = (stats: CombatStats): BattleDerivedStats => {
  const range = rangeToPixels(stats.range);
  const isRanged = stats.range !== undefined && stats.range >= RANGED_THRESHOLD;

  return {
    speed: speedToPixelsPerSecond(stats.speed),
    range,
    isRanged,
    cooldownMs: stats.range ? RANGED_COOLDOWN_MS : MELEE_COOLDOWN_MS,
  };
};

export const calculateDamage = (attacker: AttackProfile, target: DefenseProfile) => {
  const attackPower =
    attacker.rangeDamage !== undefined && attacker.rangeDamage > 0 ? attacker.rangeDamage : attacker.attack;
  const mitigation = target.defense * 0.45;
  const rawDamage = attackPower - mitigation;
  return Math.max(1, Math.round(rawDamage));
};
