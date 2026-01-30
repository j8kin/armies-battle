import Phaser from 'phaser';

export type Phase = 'deploy' | 'battle';
export type Team = 'attacker' | 'defender';
export type UnitType = 'melee' | 'ranged';

export interface BattleStats {
  phase: Phase;
  attacker: number;
  defender: number;
}

interface Unit {
  id: number;
  team: Team;
  type: UnitType;
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

export default class BattleScene extends Phaser.Scene {
  private phase: Phase = 'deploy';
  private deployTeam: Team = 'attacker';
  private deployUnitType: UnitType = 'melee';
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
      if (teamUnits.length + PACK_SIZE > MAX_UNITS) {
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

  setDeployUnitType(type: UnitType) {
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

  private spawnPack(x: number, y: number, team: Team, type: UnitType) {
    const startX = x - ((PACK_COLS - 1) * PACK_SPACING) / 2;
    const startY = y - ((PACK_ROWS - 1) * PACK_SPACING) / 2;
    const zone = this.getZoneForTeam(team);
    const minX = zone.x + 8;
    const maxX = zone.x + zone.width - 8;

    for (let row = 0; row < PACK_ROWS; row += 1) {
      for (let col = 0; col < PACK_COLS; col += 1) {
        const unitX = Phaser.Math.Clamp(startX + col * PACK_SPACING, minX, maxX);
        const unitY = Phaser.Math.Clamp(startY + row * PACK_SPACING, 10, MAP_HEIGHT - 10);
        this.createUnit(unitX, unitY, team, type);
      }
    }
  }

  private createUnit(x: number, y: number, team: Team, type: UnitType) {
    const stats =
      type === 'melee'
        ? { attack: 8, defense: 4, hp: 34, speed: 45, range: 18, cooldown: 450 }
        : {
            attack: 6,
            defense: 2,
            hp: 26,
            speed: 36,
            range: 130,
            cooldown: 700,
          };

    const id = this.nextUnitId;
    this.nextUnitId += 1;
    const sprite = this.add.circle(x, y, type === 'melee' ? 5.4 : 5, TEAM_COLORS[team], 0.9);

    const unit: Unit = {
      id,
      team,
      type,
      attack: stats.attack,
      defense: stats.defense,
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      range: stats.range,
      cooldownMs: stats.cooldown,
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
