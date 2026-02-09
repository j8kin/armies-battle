import { unitCombatStats } from '../army/unitRepository';
import { RegularUnitName } from '../../types/UnitType';
import type { UnitType } from '../../types/UnitType';
import { calculateDamage, deriveBattleStats } from './combatRules';

export type Team = 'attacker' | 'defender';

interface SimUnit {
  id: number;
  team: Team;
  type: UnitType;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  rangeDamage?: number;
  isRanged: boolean;
  cooldownMs: number;
  lastAttackAt: number;
  x: number;
}

export interface SimulationConfig {
  attackerType: UnitType;
  defenderType: UnitType;
  packSize?: number;
  attackerCount?: number;
  defenderCount?: number;
  maxDurationMs?: number;
  timeStepMs?: number;
  startDistance?: number;
}

export interface SimulationResult {
  winner: Team | 'draw';
  remaining: { attacker: number; defender: number };
  durationMs: number;
}

const DEFAULT_PACK_SIZE = 20;
const DEFAULT_MAX_DURATION_MS = 60_000;
const DEFAULT_TIME_STEP_MS = 50;
const DEFAULT_START_DISTANCE = 300;
const buildUnit = (type: UnitType, team: Team, id: number, x: number): SimUnit => {
  const stats = unitCombatStats[type];
  if (!stats) {
    throw new Error(`Missing combat stats for unit type: ${type}`);
  }

  const derived = deriveBattleStats(stats);

  return {
    id,
    team,
    type,
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.health,
    maxHp: stats.health,
    speed: derived.speed,
    range: derived.range,
    rangeDamage: stats.rangeDamage,
    isRanged: derived.isRanged,
    cooldownMs: derived.cooldownMs,
    lastAttackAt: 0,
    x,
  };
};

const findNearestEnemy = (unit: SimUnit, enemies: SimUnit[]) => {
  let nearest: SimUnit | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const distance = Math.abs(enemy.x - unit.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = enemy;
    }
  }

  return nearest;
};

const applyAttack = (attacker: SimUnit, target: SimUnit, time: number) => {
  attacker.lastAttackAt = time;
  const damage = calculateDamage(attacker, target);
  target.hp -= damage;
};

const stepUnit = (unit: SimUnit, enemies: SimUnit[], time: number, deltaMs: number) => {
  if (unit.hp <= 0) {
    return;
  }

  const target = findNearestEnemy(unit, enemies);
  if (!target) {
    return;
  }

  const distance = Math.abs(target.x - unit.x);

  if (distance <= unit.range) {
    if (time - unit.lastAttackAt >= unit.cooldownMs) {
      applyAttack(unit, target, time);
    }
    return;
  }

  const moveDistance = (unit.speed * deltaMs) / 1000;
  const direction = Math.sign(target.x - unit.x);
  unit.x += direction * moveDistance;
};

const createPack = (type: UnitType, team: Team, packSize: number, startX: number, startId: number) => {
  const units: SimUnit[] = [];
  for (let i = 0; i < packSize; i += 1) {
    units.push(buildUnit(type, team, startId + i, startX));
  }
  return units;
};

export const simulateBattle = (config: SimulationConfig): SimulationResult => {
  const {
    attackerType = RegularUnitName.WARRIOR,
    defenderType = RegularUnitName.DWARF,
    packSize = DEFAULT_PACK_SIZE,
    attackerCount = packSize,
    defenderCount = packSize,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    timeStepMs = DEFAULT_TIME_STEP_MS,
    startDistance = DEFAULT_START_DISTANCE,
  } = config;

  let nextId = 1;
  let attackers = createPack(attackerType, 'attacker', attackerCount, 0, nextId);
  nextId += attackers.length;
  let defenders = createPack(defenderType, 'defender', defenderCount, startDistance, nextId);

  let time = 0;
  while (time <= maxDurationMs && attackers.length > 0 && defenders.length > 0) {
    const orderedUnits = [...attackers, ...defenders].sort((a, b) => a.id - b.id);

    for (const unit of orderedUnits) {
      if (unit.team === 'attacker') {
        stepUnit(unit, defenders, time, timeStepMs);
      } else {
        stepUnit(unit, attackers, time, timeStepMs);
      }
    }

    attackers = attackers.filter((unit) => unit.hp > 0);
    defenders = defenders.filter((unit) => unit.hp > 0);
    time += timeStepMs;
  }

  const winner =
    attackers.length > 0 && defenders.length === 0
      ? 'attacker'
      : defenders.length > 0 && attackers.length === 0
        ? 'defender'
        : 'draw';

  return {
    winner,
    remaining: { attacker: attackers.length, defender: defenders.length },
    durationMs: time,
  };
};
