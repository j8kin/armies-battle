import Phaser from 'phaser';
import { HeroUnitName, RegularUnitName, WarMachineName } from '../types/UnitType';
import { unitCombatStats } from '../domain/army/unitRepository';
import type { UnitType, HeroUnitType, RegularUnitType, WarMachineType } from '../types/UnitType';
import { isHeroType, isWarMachine } from '../domain/army/unitTypeChecks';

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
  cooldownMs: number;
  lastAttackAt: number;
  sprite: Phaser.GameObjects.Arc;
  targetId?: number;
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

  constructor() {
    super('BattleScene');
  }

  create() {
    this.drawZones();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase !== 'deploy') {
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

  resetBattle() {
    this.phase = 'deploy';
    this.units.forEach((unit) => unit.sprite.destroy());
    this.units.clear();
    this.attackers = [];
    this.defenders = [];
    this.nextUnitId = 1;
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

  private createUnit(x: number, y: number, team: Team, type: RegularUnitType | HeroUnitType | WarMachineType) {
    // Get combat stats from the data
    const combatData = unitCombatStats[type as RegularUnitType | HeroUnitType];

    if (!combatData) {
      console.error(`No combat stats found for unit type: ${type}`);
      return;
    }

    // Convert game stats to battle mechanics
    // Speed: convert to pixels per second (multiply by scaling factor)
    const pixelsPerSecond = combatData.speed * 20;

    // Range: use rangeDamage range if available, otherwise melee range based on attack
    const battleRange = combatData.range ? combatData.range * 5 : 18;

    // Cooldown: ranged units are slower (based on range presence)
    const cooldown = combatData.range ? 700 : 450;

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
      speed: pixelsPerSecond,
      range: battleRange,
      cooldownMs: cooldown,
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
      if (!target || target.hp <= 0) {
        target = this.findNearestEnemy(unit, enemies);
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
        continue;
      }

      const moveDistance = (unit.speed * delta) / 1000;
      const nx = unit.sprite.x + (dx / distance) * moveDistance;
      const ny = unit.sprite.y + (dy / distance) * moveDistance;
      unit.sprite.setPosition(Phaser.Math.Clamp(nx, 6, MAP_WIDTH - 6), Phaser.Math.Clamp(ny, 6, MAP_HEIGHT - 6));
    }
  }

  private resolveAttack(attacker: Unit, target: Unit, time: number) {
    attacker.lastAttackAt = time;
    const mitigation = target.defense * 0.45;
    const rawDamage = attacker.attack - mitigation;
    const damage = Math.max(1, Math.round(rawDamage));
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
