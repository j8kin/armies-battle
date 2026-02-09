import Phaser from 'phaser';
import { unitCombatStats } from '../domain/army/unitRepository';
import { calculateDamage, deriveBattleStats } from '../domain/battle/combatRules';
import { simulateBattle } from '../domain/battle/simulateBattle';
import type { UnitType, HeroUnitType, RegularUnitType, WarMachineType } from '../types/UnitType';
import type { ArmedWarMachine } from '../types/WarMachineArming';
import type { SimulationResult } from '../domain/battle/simulateBattle';
import { isHeroType, isWarMachine } from '../domain/army/unitTypeChecks';
import DeployManager from './DeployManager';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  PACK_COLS,
  PACK_SPACING,
  ZONE_ATTACKER,
  ZONE_DEFENDER,
  ZONE_NEUTRAL,
} from './battleConfig';
import type { BattleStats, Phase, Team } from './battleTypes';
import { TEAM_COLORS, UNIT_TYPE_COLORS } from './unitVisuals';

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

  constructor() {
    super('BattleScene');
  }

  create() {
    this.drawZones();
    this.deployManager = new DeployManager(
      this,
      () => this.phase,
      () => this.emitStats(),
    );
    this.deployManager.initialize();

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
    armedWarMachine?: ArmedWarMachine,
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
        continue;
      }

      const moveDistance = (unit.speed * delta) / 1000;
      let moveX = dx / distance;
      let moveY = dy / distance;

      const avoidance = this.getMeleeAvoidance(unit);
      const steerX = moveX + avoidance.x;
      const steerY = moveY + avoidance.y;
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
    unit.cooldownMs = derived.cooldownMs;
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
      0.35,
    );
    this.add.rectangle(
      ZONE_NEUTRAL.x + ZONE_NEUTRAL.width / 2,
      MAP_HEIGHT / 2,
      ZONE_NEUTRAL.width,
      MAP_HEIGHT,
      0x2f3640,
      0.2,
    );
    this.add.rectangle(
      ZONE_DEFENDER.x + ZONE_DEFENDER.width / 2,
      MAP_HEIGHT / 2,
      ZONE_DEFENDER.width,
      MAP_HEIGHT,
      0x4a1e21,
      0.35,
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
