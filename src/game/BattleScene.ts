import Phaser from 'phaser';
import DeployManager from './DeployManager';
import { calculateDamage, deriveBattleStats } from '../domain/battle/combatRules';
import { simulateBattle } from '../domain/battle/simulateBattle';
import { isHeroType, isWarMachine } from '../domain/army/unitTypeChecks';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  PACK_COLS,
  PACK_SPACING,
  ZONE_ATTACKER,
  ZONE_DEFENDER,
  ZONE_NEUTRAL,
} from './battleConfig';
import { unitCombatStats } from '../domain/army/unitRepository';
import { TEAM_COLORS, UNIT_TYPE_COLORS } from './unitVisuals';
import type { BattleStats, Phase, Team } from './battleTypes';
import type { BattleArmy } from '../state/army/BattleArmy';
import type { UnitType, HeroUnitType, RegularUnitType, WarMachineType } from '../types/UnitType';
import type { ArmedWarMachine } from '../types/WarMachineArming';
import type { SimulationResult } from '../domain/battle/simulateBattle';

interface Unit {
  id: number;
  team: Team;
  type: RegularUnitType | HeroUnitType | WarMachineType;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  rangeDamage?: number; // Damage dealt at range (for ranged units)
  isRanged: boolean;
  cooldownMs: number;
  lastAttackAt: number;
  sprite: Phaser.GameObjects.Arc;
  targetId?: number;
  armedWarMachine?: ArmedWarMachine; // If this is a war machine, stores arming info
}

export default class BattleScene extends Phaser.Scene {
  private phase: Phase = 'deploy';
  private deployManager?: DeployManager;
  private units = new Map<number, Unit>();
  private attackers: Unit[] = [];
  private defenders: Unit[] = [];
  private nextUnitId = 1;
  private statsTimer?: Phaser.Time.TimerEvent;
  private onStats?: (stats: BattleStats) => void;
  private humanArmy?: BattleArmy;
  private computerArmy?: BattleArmy;

  constructor() {
    super('BattleScene');
  }

  setArmies(humanArmy: BattleArmy, computerArmy: BattleArmy) {
    this.humanArmy = humanArmy;
    this.computerArmy = computerArmy;
    this.deployManager?.setArmies(humanArmy, computerArmy);
  }

  create() {
    this.drawZones();
    this.deployManager = new DeployManager(
      this,
      () => this.phase,
      () => this.emitStats()
    );
    this.deployManager.initialize();

    if (this.humanArmy && this.computerArmy) {
      this.deployManager.setArmies(this.humanArmy, this.computerArmy);
    }

    this.statsTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => this.emitStats(),
    });

    this.emitStats();
  }

  update(time: number, delta: number) {
    if (this.phase !== 'battle') {
      return;
    }
    this.updateBattle(time, delta);
  }

  startBattle() {
    if (this.phase === 'battle') {
      return;
    }
    this.phase = 'battle';
    this.deployManager?.materialize((x, y, team, type, armedWarMachine) => {
      this.createUnit(x, y, team, type as RegularUnitType | HeroUnitType | WarMachineType, armedWarMachine);
    });
    this.emitStats();
  }

  autoResolveBattle(): SimulationResult | null {
    if (this.phase !== 'deploy') {
      return null;
    }

    const packs = this.deployManager?.getPacks() ?? [];
    const attackerPacks = packs.filter((pack) => pack.team === 'attacker');
    const defenderPacks = packs.filter((pack) => pack.team === 'defender');

    if (attackerPacks.length === 0 || defenderPacks.length === 0) {
      return null;
    }

    const attackerTypes = new Set(attackerPacks.map((pack) => pack.type));
    const defenderTypes = new Set(defenderPacks.map((pack) => pack.type));

    if (attackerTypes.size !== 1 || defenderTypes.size !== 1) {
      console.warn('Auto-resolve requires exactly one unit type per team.');
      return null;
    }

    const attackerType = Array.from(attackerTypes)[0];
    const defenderType = Array.from(defenderTypes)[0];

    if (packs.some((pack) => isWarMachine(pack.type) && pack.armedWarMachine)) {
      console.warn('Auto-resolve does not support armed war machines yet.');
      return null;
    }

    const attackerCount = attackerPacks.reduce((sum, pack) => sum + pack.size, 0);
    const defenderCount = defenderPacks.reduce((sum, pack) => sum + pack.size, 0);

    const result = simulateBattle({
      attackerType,
      defenderType,
      attackerCount,
      defenderCount,
      startDistance: 300,
      timeStepMs: 50,
      maxDurationMs: 90_000,
    });

    this.resetBattle();
    this.phase = 'battle';

    if (result.winner === 'attacker') {
      this.spawnUnitsForTeam('attacker', attackerType, result.remaining.attacker);
    } else if (result.winner === 'defender') {
      this.spawnUnitsForTeam('defender', defenderType, result.remaining.defender);
    }

    this.emitStats();
    return result;
  }

  resetBattle() {
    this.phase = 'deploy';
    this.units.forEach((unit) => unit.sprite.destroy());
    this.units.clear();
    this.attackers = [];
    this.defenders = [];
    this.nextUnitId = 1;
    this.deployManager?.reset();
    this.emitStats();
  }

  setDeployTeam(team: Team) {
    this.deployManager?.setDeployTeam(team);
    this.emitStats();
  }

  setDeployUnitType(type: RegularUnitType | HeroUnitType | WarMachineType) {
    this.deployManager?.setDeployUnitType(type);
    this.emitStats();
  }

  getAvailableUnits(): Map<UnitType, number> {
    return this.deployManager?.getAvailableUnits() ?? new Map();
  }

  setStatsCallback(callback?: (stats: BattleStats) => void) {
    this.onStats = callback;
    this.emitStats();
  }

  private emitStats() {
    if (!this.onStats) {
      return;
    }
    const deployManager = this.deployManager;
    const attacker =
      this.phase === 'deploy' ? (deployManager?.getTeamUnitCount('attacker') ?? 0) : this.attackers.length;
    const defender =
      this.phase === 'deploy' ? (deployManager?.getTeamUnitCount('defender') ?? 0) : this.defenders.length;
    this.onStats({
      phase: this.phase,
      attacker,
      defender,
    });
  }

  private getZoneForTeam(team: Team) {
    return team === 'attacker' ? ZONE_ATTACKER : ZONE_DEFENDER;
  }

  private spawnUnitsForTeam(team: Team, type: UnitType, count: number) {
    if (count <= 0) {
      return;
    }

    const zone = this.getZoneForTeam(team);
    const minX = zone.x + 18;
    const maxX = zone.x + zone.width - 18;
    const centerX = Phaser.Math.Clamp(zone.x + zone.width / 2, minX, maxX);
    const centerY = MAP_HEIGHT / 2;

    const isSingleUnit = isHeroType(type as HeroUnitType) || isWarMachine(type as WarMachineType);
    const spacing = isSingleUnit ? 24 : PACK_SPACING;
    const columns = isSingleUnit ? 1 : PACK_COLS;

    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const offsetX = (col - (columns - 1) / 2) * spacing;
      const offsetY = (row - 2) * spacing;
      const x = Phaser.Math.Clamp(centerX + offsetX, minX, maxX);
      const y = Phaser.Math.Clamp(centerY + offsetY, 10, MAP_HEIGHT - 10);
      this.createUnit(x, y, team, type as RegularUnitType | HeroUnitType | WarMachineType);
    }
  }

  private createUnit(
    x: number,
    y: number,
    team: Team,
    type: RegularUnitType | HeroUnitType | WarMachineType,
    armedWarMachine?: ArmedWarMachine
  ) {
    // Get combat stats from the data
    const combatData = unitCombatStats[type as RegularUnitType | HeroUnitType | WarMachineType];

    if (!combatData) {
      console.error(`No combat stats found for unit type: ${type}`);
      return;
    }

    // Convert game stats to battle mechanics
    const derived = deriveBattleStats(combatData);

    const id = this.nextUnitId;
    this.nextUnitId += 1;

    // Determine color: use unit type color if available, otherwise team color
    const unitColor = UNIT_TYPE_COLORS[type] ?? TEAM_COLORS[team];

    // Determine size: heroes are larger, war machines even larger
    let unitSize = 5.4; // Default regular unit size
    if (isHeroType(type as HeroUnitType)) {
      unitSize = 7;
    } else if (isWarMachine(type as WarMachineType)) {
      unitSize = 9;
    }

    const sprite = this.add.circle(x, y, unitSize, unitColor, 0.9);

    const unit: Unit = {
      id,
      team,
      type,
      attack: combatData.attack,
      defense: combatData.defense,
      hp: combatData.health,
      maxHp: combatData.health,
      speed: derived.speed,
      range: derived.range,
      rangeDamage: combatData.rangeDamage, // Store range damage for ranged units
      isRanged: derived.isRanged,
      cooldownMs: derived.cooldownMs,
      lastAttackAt: 0,
      sprite,
      armedWarMachine,
    };

    if (armedWarMachine) {
      this.applyArmedWarMachineStats(unit, armedWarMachine);
      this.updateArmedWarMachineVisual(unit);
    }

    this.units.set(id, unit);
    if (team === 'attacker') {
      this.attackers.push(unit);
    } else {
      this.defenders.push(unit);
    }
  }

  private updateBattle(time: number, delta: number) {
    const units = Array.from(this.units.values());

    for (const unit of units) {
      if (unit.hp <= 0) {
        continue;
      }
      const enemies = unit.team === 'attacker' ? this.defenders : this.attackers;
      if (enemies.length === 0) {
        continue;
      }

      let target = unit.targetId ? this.units.get(unit.targetId) : undefined;
      if (!target || target.hp <= 0 || (this.isMeleeUnit(unit) && !this.isEnemyInFront(unit, target))) {
        target = this.findPreferredEnemy(unit, enemies);
        unit.targetId = target?.id;
      }

      if (!target) {
        continue;
      }

      const dx = target.sprite.x - unit.sprite.x;
      const dy = target.sprite.y - unit.sprite.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= unit.range) {
        if (time - unit.lastAttackAt >= unit.cooldownMs) {
          this.resolveAttack(unit, target, time);
        }
        if (this.shouldHitAndRun(unit, target, distance)) {
          const retreatDistance = (unit.speed * delta) / 1000;
          const retreat = this.getHitAndRunDirection(unit, target, enemies);
          const avoidance = this.getMeleeAvoidance(unit);
          const steerX = retreat.x + avoidance.x;
          const steerY = retreat.y + avoidance.y;
          const steerLength = Math.hypot(steerX, steerY);
          const moveX = steerLength > 0.001 ? steerX / steerLength : retreat.x;
          const moveY = steerLength > 0.001 ? steerY / steerLength : retreat.y;
          const nx = unit.sprite.x + moveX * retreatDistance;
          const ny = unit.sprite.y + moveY * retreatDistance;
          unit.sprite.setPosition(Phaser.Math.Clamp(nx, 6, MAP_WIDTH - 6), Phaser.Math.Clamp(ny, 6, MAP_HEIGHT - 6));
        } else {
          const avoidance = this.getMeleeAvoidance(unit);
          const steerLength = Math.hypot(avoidance.x, avoidance.y);
          if (steerLength > 0.001) {
            const moveDistance = (unit.speed * delta * 0.35) / 1000;
            const moveX = avoidance.x / steerLength;
            const moveY = avoidance.y / steerLength;
            const nx = unit.sprite.x + moveX * moveDistance;
            const ny = unit.sprite.y + moveY * moveDistance;
            unit.sprite.setPosition(Phaser.Math.Clamp(nx, 6, MAP_WIDTH - 6), Phaser.Math.Clamp(ny, 6, MAP_HEIGHT - 6));
          }
        }
        continue;
      }

      const moveDistance = (unit.speed * delta) / 1000;
      let moveX = dx / distance;
      let moveY = dy / distance;

      const avoidance = this.getMeleeAvoidance(unit);
      const allies = unit.team === 'attacker' ? this.attackers : this.defenders;
      const bypass = this.getAllyBypassSteer(unit, target, allies);
      const steerX = moveX * bypass.forwardScale + avoidance.x + bypass.x;
      const steerY = moveY * bypass.forwardScale + avoidance.y + bypass.y;
      const steerLength = Math.hypot(steerX, steerY);
      if (steerLength > 0.001) {
        moveX = steerX / steerLength;
        moveY = steerY / steerLength;
      }

      const nx = unit.sprite.x + moveX * moveDistance;
      const ny = unit.sprite.y + moveY * moveDistance;
      unit.sprite.setPosition(Phaser.Math.Clamp(nx, 6, MAP_WIDTH - 6), Phaser.Math.Clamp(ny, 6, MAP_HEIGHT - 6));
    }
  }

  private resolveAttack(attacker: Unit, target: Unit, time: number) {
    attacker.lastAttackAt = time;

    const damage = calculateDamage(attacker, target);
    target.hp -= damage;
    target.sprite.setAlpha(Math.max(0.35, target.hp / target.maxHp));

    if (target.hp <= 0) {
      target.sprite.destroy();
      this.units.delete(target.id);
      if (target.team === 'attacker') {
        this.attackers = this.attackers.filter((unit) => unit.id !== target.id);
      } else {
        this.defenders = this.defenders.filter((unit) => unit.id !== target.id);
      }
    }
  }

  private findNearestEnemy(unit: Unit, enemies: Unit[]) {
    let nearest: Unit | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, enemy.sprite.x, enemy.sprite.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private isMeleeUnit(unit: Unit) {
    return !unit.isRanged;
  }

  private isEnemyInFront(unit: Unit, enemy: Unit) {
    const forward = unit.team === 'attacker' ? enemy.sprite.x - unit.sprite.x : unit.sprite.x - enemy.sprite.x;
    return forward >= -4;
  }

  private shouldHitAndRun(unit: Unit, target: Unit, distance: number) {
    if (!unit.isRanged) {
      return false;
    }
    const preferredDistance = unit.range * 0.85;
    if (distance >= preferredDistance) {
      return false;
    }
    return unit.speed > target.speed;
  }

  private getHitAndRunDirection(unit: Unit, target: Unit, enemies: Unit[]) {
    const dx = unit.sprite.x - target.sprite.x;
    const dy = unit.sprite.y - target.sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    const awayX = dx / distance;
    const awayY = dy / distance;
    const towardX = -awayX;
    const towardY = -awayY;
    const leftX = -awayY;
    const leftY = awayX;
    const rightX = awayY;
    const rightY = -awayX;
    const candidates = [
      { x: awayX, y: awayY },
      { x: towardX, y: towardY },
      { x: leftX, y: leftY },
      { x: rightX, y: rightY },
      { x: (awayX + leftX) * 0.7071, y: (awayY + leftY) * 0.7071 },
      { x: (awayX + rightX) * 0.7071, y: (awayY + rightY) * 0.7071 },
      { x: (towardX + leftX) * 0.7071, y: (towardY + leftY) * 0.7071 },
      { x: (towardX + rightX) * 0.7071, y: (towardY + rightY) * 0.7071 },
    ];
    const probeDistance = Math.max(18, unit.range * 0.6);
    let best = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const probeX = unit.sprite.x + candidate.x * probeDistance;
      const probeY = unit.sprite.y + candidate.y * probeDistance;
      let threat = 0;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) {
          continue;
        }
        const dist = Phaser.Math.Distance.Between(probeX, probeY, enemy.sprite.x, enemy.sprite.y);
        if (dist <= probeDistance) {
          threat += (probeDistance - dist) / probeDistance;
        }
      }
      const edgeMargin = 18;
      const edgePenaltyX =
        probeX < edgeMargin
          ? (edgeMargin - probeX) / edgeMargin
          : probeX > MAP_WIDTH - edgeMargin
            ? (probeX - (MAP_WIDTH - edgeMargin)) / edgeMargin
            : 0;
      const edgePenaltyY =
        probeY < edgeMargin
          ? (edgeMargin - probeY) / edgeMargin
          : probeY > MAP_HEIGHT - edgeMargin
            ? (probeY - (MAP_HEIGHT - edgeMargin)) / edgeMargin
            : 0;
      const score = threat + edgePenaltyX + edgePenaltyY;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  private findPreferredEnemy(unit: Unit, enemies: Unit[]) {
    if (!this.isMeleeUnit(unit)) {
      return this.findNearestEnemy(unit, enemies);
    }

    let best: Unit | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      const forward = unit.team === 'attacker' ? enemy.sprite.x - unit.sprite.x : unit.sprite.x - enemy.sprite.x;
      if (forward < 0) {
        continue;
      }
      const lateral = Math.abs(enemy.sprite.y - unit.sprite.y);
      const score = forward * 2 + lateral;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }

    return best ?? this.findNearestEnemy(unit, enemies);
  }

  private getMeleeAvoidance(unit: Unit) {
    const allies = unit.team === 'attacker' ? this.attackers : this.defenders;
    let steerX = 0;
    let steerY = 0;
    const unitX = unit.sprite.x;
    const unitY = unit.sprite.y;
    const minDistance = unit.sprite.radius * 4;

    for (const ally of allies) {
      if (ally.id === unit.id || ally.hp <= 0) {
        continue;
      }
      const dx = unitX - ally.sprite.x;
      const dy = unitY - ally.sprite.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.001 || distance >= minDistance) {
        continue;
      }
      const push = (minDistance - distance) / minDistance;
      steerX += (dx / distance) * push;
      steerY += (dy / distance) * push;
    }

    return { x: steerX, y: steerY };
  }

  private getAllyBypassSteer(unit: Unit, target: Unit, allies: Unit[]) {
    const dx = target.sprite.x - unit.sprite.x;
    const dy = target.sprite.y - unit.sprite.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      return { x: 0, y: 0, forwardScale: 1 };
    }

    const forwardX = dx / distance;
    const forwardY = dy / distance;
    const rightX = forwardY;
    const rightY = -forwardX;
    const blockDistance = Math.max(18, unit.sprite.radius * 6);
    const laneWidth = Math.max(10, unit.sprite.radius * 3);
    let blockers = 0;
    let leftScore = 0;
    let rightScore = 0;

    for (const ally of allies) {
      if (ally.id === unit.id || ally.hp <= 0) {
        continue;
      }
      const ax = ally.sprite.x - unit.sprite.x;
      const ay = ally.sprite.y - unit.sprite.y;
      const forwardDot = ax * forwardX + ay * forwardY;
      if (forwardDot <= 0 || forwardDot > blockDistance) {
        continue;
      }
      const lateral = ax * rightX + ay * rightY;
      if (Math.abs(lateral) > laneWidth) {
        continue;
      }
      blockers += 1;
      if (lateral >= 0) {
        rightScore += 1;
      } else {
        leftScore += 1;
      }
    }

    if (blockers === 0) {
      return { x: 0, y: 0, forwardScale: 1 };
    }

    let steerDir = leftScore <= rightScore ? -1 : 1;
    const probeDistance = Math.max(12, unit.sprite.radius * 5);
    const probeX = unit.sprite.x + rightX * steerDir * probeDistance;
    const probeY = unit.sprite.y + rightY * steerDir * probeDistance;
    const edgeMargin = 16;
    if (
      probeX < edgeMargin ||
      probeX > MAP_WIDTH - edgeMargin ||
      probeY < edgeMargin ||
      probeY > MAP_HEIGHT - edgeMargin
    ) {
      steerDir *= -1;
    }

    const congestion = Math.min(1, blockers / 3);
    const bypassStrength = 0.85 + congestion * 0.45;
    const forwardScale = 0.55 - congestion * 0.2;
    return { x: rightX * steerDir * bypassStrength, y: rightY * steerDir * bypassStrength, forwardScale };
  }

  private applyArmedWarMachineStats(unit: Unit, armedWarMachine: ArmedWarMachine) {
    const armedStats = armedWarMachine.combatStats;
    const derived = deriveBattleStats(armedStats);
    unit.attack = armedStats.attack;
    unit.defense = armedStats.defense;
    unit.maxHp = armedStats.health;
    unit.hp = armedStats.health;
    unit.speed = derived.speed;
    unit.range = derived.range;
    unit.rangeDamage = armedStats.rangeDamage;
    unit.isRanged = derived.isRanged;
    // Use cooldown from armed stats if available, otherwise from derived
    unit.cooldownMs = (armedStats as any).cooldownMs ?? derived.cooldownMs;
  }

  /**
   * Update visual appearance of an armed war machine
   */
  private updateArmedWarMachineVisual(warMachine: Unit) {
    // Remove selection highlight
    warMachine.sprite.setStrokeStyle(0);

    // Add a golden/orange border to show it's armed
    warMachine.sprite.setStrokeStyle(2, 0xffa500, 1);

    // Get the unit color for the armed unit type
    if (warMachine.armedWarMachine) {
      const armedUnitColor = UNIT_TYPE_COLORS[warMachine.armedWarMachine.armedWith];
      if (armedUnitColor) {
        // Blend the war machine color with the armed unit color
        warMachine.sprite.setFillStyle(armedUnitColor, 0.9);
      }
    }
  }

  private drawZones() {
    this.add.rectangle(
      ZONE_ATTACKER.x + ZONE_ATTACKER.width / 2,
      MAP_HEIGHT / 2,
      ZONE_ATTACKER.width,
      MAP_HEIGHT,
      0x132a4e,
      0.35
    );
    this.add.rectangle(
      ZONE_NEUTRAL.x + ZONE_NEUTRAL.width / 2,
      MAP_HEIGHT / 2,
      ZONE_NEUTRAL.width,
      MAP_HEIGHT,
      0x2f3640,
      0.2
    );
    this.add.rectangle(
      ZONE_DEFENDER.x + ZONE_DEFENDER.width / 2,
      MAP_HEIGHT / 2,
      ZONE_DEFENDER.width,
      MAP_HEIGHT,
      0x4a1e21,
      0.35
    );

    const labelStyle = {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '18px',
      color: '#f8f8ff',
    };

    this.add.text(24, 16, 'Attacker Zone (30%)', labelStyle);
    this.add.text(MAP_WIDTH * 0.32, 16, 'Neutral (10%)', labelStyle);
    this.add.text(MAP_WIDTH * 0.68, 16, 'Defender Zone (60%)', labelStyle);
  }
}
