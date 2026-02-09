import Phaser from 'phaser';
import { HeroUnitName, RegularUnitName, WarMachineName } from '../types/UnitType';
import { unitCombatStats } from '../domain/army/unitRepository';
import { calculateDamage, deriveBattleStats } from '../domain/battle/combatRules';
import { simulateBattle } from '../domain/battle/simulateBattle';
import type { UnitType, HeroUnitType, RegularUnitType, WarMachineType } from '../types/UnitType';
import { isHeroType, isWarMachine, isRegularUnit } from '../domain/army/unitTypeChecks';
import { calculateArmedWarMachineStats } from '../types/WarMachineArming';
import type { ArmedWarMachine } from '../types/WarMachineArming';
import type { SimulationResult } from '../domain/battle/simulateBattle';

export type Phase = 'deploy' | 'battle';
export type Team = 'attacker' | 'defender';

export interface BattleStats {
  phase: Phase;
  attacker: number;
  defender: number;
}

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

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;
const ZONE_ATTACKER = { x: 0, width: MAP_WIDTH * 0.3 };
const ZONE_NEUTRAL = { x: MAP_WIDTH * 0.3, width: MAP_WIDTH * 0.1 };
const ZONE_DEFENDER = { x: MAP_WIDTH * 0.4, width: MAP_WIDTH * 0.6 };

const PACK_SIZE = 20;
const PACK_ROWS = 4;
const PACK_COLS = 5;
const PACK_SPACING = 12;
const MAX_UNITS = 500;

const TEAM_COLORS: Record<Team, number> = {
  attacker: 0x4bb3fd,
  defender: 0xfb4d46,
};

// Unit type colors for visual differentiation
const UNIT_TYPE_COLORS: Partial<Record<UnitType, number>> = {
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

export default class BattleScene extends Phaser.Scene {
  private phase: Phase = 'deploy';
  private deployTeam: Team = 'attacker';
  private deployUnitType: RegularUnitType | HeroUnitType | WarMachineType = RegularUnitName.WARRIOR;
  private units = new Map<number, Unit>();
  private attackers: Unit[] = [];
  private defenders: Unit[] = [];
  private nextUnitId = 1;
  private statsTimer?: Phaser.Time.TimerEvent;
  private onStats?: (stats: BattleStats) => void;
  // Arming mode state
  private armingMode: boolean = false;
  private warMachineToArm?: Unit;

  constructor() {
    super('BattleScene');
  }

  create() {
    this.drawZones();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase !== 'deploy') {
        return;
      }

      // Check if clicking on an existing unit (for arming war machines)
      const clickedUnit = this.findUnitAtPosition(pointer.x, pointer.y);
      if (clickedUnit) {
        this.handleUnitClick(pointer.x, pointer.y);
        return;
      }

      // If in arming mode but didn't click a unit, exit arming mode
      if (this.armingMode && this.warMachineToArm) {
        this.armingMode = false;
        this.restoreWarMachineColor(this.warMachineToArm);
        this.warMachineToArm = undefined;
        return;
      }

      const zone = this.getZoneForTeam(this.deployTeam);
      if (!this.pointInZone(pointer.x, pointer.y, zone)) {
        return;
      }
      const teamUnits = this.getUnitsForTeam(this.deployTeam);

      // Determine how many units will be spawned
      const isSingleUnit = isHeroType(this.deployUnitType) || isWarMachine(this.deployUnitType);
      const unitsToSpawn = isSingleUnit ? 1 : PACK_SIZE;

      if (teamUnits.length + unitsToSpawn > MAX_UNITS) {
        return;
      }
      this.spawnPack(pointer.x, pointer.y, this.deployTeam, this.deployUnitType);
      this.emitStats();
    });

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
    this.emitStats();
  }

  autoResolveBattle(): SimulationResult | null {
    if (this.phase !== 'deploy') {
      return null;
    }

    if (this.attackers.length === 0 || this.defenders.length === 0) {
      return null;
    }

    const attackerTypes = new Set(this.attackers.map((unit) => unit.type));
    const defenderTypes = new Set(this.defenders.map((unit) => unit.type));

    if (attackerTypes.size !== 1 || defenderTypes.size !== 1) {
      console.warn('Auto-resolve requires exactly one unit type per team.');
      return null;
    }

    const [attackerType] = attackerTypes;
    const [defenderType] = defenderTypes;

    if (
      this.attackers.some((unit) => isWarMachine(unit.type) && unit.armedWarMachine) ||
      this.defenders.some((unit) => isWarMachine(unit.type) && unit.armedWarMachine)
    ) {
      console.warn('Auto-resolve does not support armed war machines yet.');
      return null;
    }

    const result = simulateBattle({
      attackerType,
      defenderType,
      attackerCount: this.attackers.length,
      defenderCount: this.defenders.length,
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
    this.armingMode = false;
    this.warMachineToArm = undefined;
    this.emitStats();
  }

  setDeployTeam(team: Team) {
    this.deployTeam = team;
    this.emitStats();
  }

  setDeployUnitType(type: RegularUnitType | HeroUnitType | WarMachineType) {
    this.deployUnitType = type;
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
    this.onStats({
      phase: this.phase,
      attacker: this.attackers.length,
      defender: this.defenders.length,
    });
  }

  private getZoneForTeam(team: Team) {
    return team === 'attacker' ? ZONE_ATTACKER : ZONE_DEFENDER;
  }

  private pointInZone(x: number, y: number, zone: { x: number; width: number }) {
    return x >= zone.x && x <= zone.x + zone.width && y >= 0 && y <= MAP_HEIGHT;
  }

  private spawnPack(x: number, y: number, team: Team, type: RegularUnitType | HeroUnitType | WarMachineType) {
    const zone = this.getZoneForTeam(team);
    const minX = zone.x + 8;
    const maxX = zone.x + zone.width - 8;

    // Check if this is a Hero or WarMachine - they spawn as single units
    const heroUnits = Object.values(HeroUnitName);
    const warMachines = ['Ballista', 'Catapult', 'Battering Ram', 'Siege Tower'];
    const isSingleUnit = heroUnits.includes(type as HeroUnitType) || warMachines.includes(type);

    if (isSingleUnit) {
      // Spawn only 1 unit at the clicked position
      const unitX = Phaser.Math.Clamp(x, minX, maxX);
      const unitY = Phaser.Math.Clamp(y, 10, MAP_HEIGHT - 10);
      this.createUnit(unitX, unitY, team, type);
    } else {
      // Spawn a pack of regular units in a grid formation
      const startX = x - ((PACK_COLS - 1) * PACK_SPACING) / 2;
      const startY = y - ((PACK_ROWS - 1) * PACK_SPACING) / 2;

      for (let row = 0; row < PACK_ROWS; row += 1) {
        for (let col = 0; col < PACK_COLS; col += 1) {
          const unitX = Phaser.Math.Clamp(startX + col * PACK_SPACING, minX, maxX);
          const unitY = Phaser.Math.Clamp(startY + row * PACK_SPACING, 10, MAP_HEIGHT - 10);
          this.createUnit(unitX, unitY, team, type);
        }
      }
    }
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

  private createUnit(x: number, y: number, team: Team, type: RegularUnitType | HeroUnitType | WarMachineType) {
    // Get combat stats from the data
    const combatData = unitCombatStats[type as RegularUnitType | HeroUnitType];

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
    const heroUnits = Object.values(HeroUnitName);
    let unitSize = 5.4; // Default regular unit size
    if (heroUnits.includes(type as HeroUnitType)) {
      unitSize = 7; // Heroes are larger
    } else if (['Ballista', 'Catapult', 'Battering Ram', 'Siege Tower'].includes(type)) {
      unitSize = 9; // War machines are even larger
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
    };

    this.units.set(id, unit);
    if (team === 'attacker') {
      this.attackers.push(unit);
    } else {
      this.defenders.push(unit);
    }
  }

  private getUnitsForTeam(team: Team) {
    return team === 'attacker' ? this.attackers : this.defenders;
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

  /**
   * Find a unit at the given position (with larger click radius for easier selection)
   */
  private findUnitAtPosition(x: number, y: number): Unit | undefined {
    const units = Array.from(this.units.values());
    // Check larger units first (war machines, then heroes, then regular)
    const sortedUnits = units.sort((a, b) => {
      const aIsWarMachine = isWarMachine(a.type);
      const bIsWarMachine = isWarMachine(b.type);
      if (aIsWarMachine && !bIsWarMachine) return -1;
      if (!aIsWarMachine && bIsWarMachine) return 1;

      const aIsHero = isHeroType(a.type);
      const bIsHero = isHeroType(b.type);
      if (aIsHero && !bIsHero) return -1;
      if (!aIsHero && bIsHero) return 1;

      return 0;
    });

    for (const unit of sortedUnits) {
      const distance = Phaser.Math.Distance.Between(x, y, unit.sprite.x, unit.sprite.y);
      // Use a larger click radius for easier selection (2x the visual radius)
      const clickRadius = unit.sprite.radius * 2;
      if (distance <= clickRadius) {
        return unit;
      }
    }

    return undefined;
  }

  /**
   * Find all units in a pack (units of the same type and team within close proximity)
   */
  private findPackAtPosition(x: number, y: number): Unit[] {
    const clickedUnit = this.findUnitAtPosition(x, y);
    if (!clickedUnit) {
      return [];
    }

    // If it's a hero or war machine (single unit), return just that unit
    if (isHeroType(clickedUnit.type) || isWarMachine(clickedUnit.type)) {
      return [clickedUnit];
    }

    // Find all units of the same type and team within a pack radius
    const packRadius = 100; // Units within this radius are considered part of the same pack
    const pack: Unit[] = [];

    this.units.forEach((unit) => {
      if (unit.type === clickedUnit.type && unit.team === clickedUnit.team) {
        const distance = Phaser.Math.Distance.Between(
          clickedUnit.sprite.x,
          clickedUnit.sprite.y,
          unit.sprite.x,
          unit.sprite.y,
        );
        if (distance <= packRadius) {
          pack.push(unit);
        }
      }
    });

    return pack;
  }

  /**
   * Handle clicking on a unit/pack (for arming war machines)
   */
  private handleUnitClick(x: number, y: number) {
    const unit = this.findUnitAtPosition(x, y);
    if (!unit) {
      return;
    }

    // If in arming mode, try to arm the war machine with a pack
    if (this.armingMode && this.warMachineToArm) {
      const pack = this.findPackAtPosition(x, y);
      this.armWarMachine(this.warMachineToArm, pack);
      this.armingMode = false;
      this.warMachineToArm = undefined;
      return;
    }

    // If clicking on an unarmed war machine, enter arming mode
    if (isWarMachine(unit.type) && !unit.armedWarMachine) {
      this.armingMode = true;
      this.warMachineToArm = unit;
      // Highlight the war machine with a pulsing effect
      this.highlightWarMachineForArming(unit);
      console.log(`War machine selected for arming. Click on a melee unit pack to arm it.`);
    }
  }

  /**
   * Arm a war machine with a pack of regular melee units
   */
  private armWarMachine(warMachine: Unit, armingPack: Unit[]) {
    if (armingPack.length === 0) {
      console.log('No units found to arm the war machine');
      this.restoreWarMachineColor(warMachine);
      return;
    }

    const firstUnit = armingPack[0];

    // Validate: only regular melee units can arm war machines
    if (!isRegularUnit(firstUnit.type)) {
      console.log('Only regular units can arm war machines');
      this.restoreWarMachineColor(warMachine);
      return;
    }

    // Check if the unit is ranged (has range stat)
    const armingUnitStats = unitCombatStats[firstUnit.type];
    if (armingUnitStats.range && armingUnitStats.range > 0) {
      console.log('Ranged units cannot arm war machines. Only melee units are allowed.');
      this.restoreWarMachineColor(warMachine);
      return;
    }

    // Validate pack size - must have at least PACK_SIZE units
    if (armingPack.length < PACK_SIZE) {
      console.log(`Not enough units! Need ${PACK_SIZE} units to arm a war machine, found ${armingPack.length}`);
      this.restoreWarMachineColor(warMachine);
      return;
    }

    // Calculate armed stats based on the unit type
    const armedStats = calculateArmedWarMachineStats(armingUnitStats);

    // Update the war machine
    warMachine.armedWarMachine = {
      armedWith: firstUnit.type,
      combatStats: armedStats,
    };

    // Apply the new stats
    warMachine.attack = armedStats.attack;
    warMachine.defense = armedStats.defense;
    warMachine.maxHp = armedStats.health;
    warMachine.hp = armedStats.health;
    warMachine.speed = armedStats.speed * 20; // Convert to pixels per second
    warMachine.range = (armedStats.range ?? 18) * 5;
    warMachine.rangeDamage = armedStats.rangeDamage; // Store the range damage!
    warMachine.cooldownMs = 700; // Ranged cooldown

    // Update visual to show it's armed (use a golden border effect)
    this.updateArmedWarMachineVisual(warMachine);

    // Remove all units in the pack (up to PACK_SIZE)
    const unitsToRemove = armingPack.slice(0, PACK_SIZE);
    for (const unit of unitsToRemove) {
      unit.sprite.destroy();
      this.units.delete(unit.id);
      if (unit.team === 'attacker') {
        this.attackers = this.attackers.filter((u) => u.id !== unit.id);
      } else {
        this.defenders = this.defenders.filter((u) => u.id !== unit.id);
      }
    }

    console.log(`War machine armed with ${PACK_SIZE} ${firstUnit.type} units!`);
    this.emitStats();
  }

  /**
   * Highlight a war machine when entering arming mode
   */
  private highlightWarMachineForArming(warMachine: Unit) {
    // Add a yellow tint to indicate selection
    warMachine.sprite.setStrokeStyle(3, 0xffff00, 1);
  }

  /**
   * Restore the war machine's original color
   */
  private restoreWarMachineColor(warMachine: Unit) {
    warMachine.sprite.setStrokeStyle(0);
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
