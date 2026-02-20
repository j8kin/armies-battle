import Phaser from 'phaser';
import { deriveBattleStats, rangeToPixels } from '../domain/battle/combatRules';
import { isHeroType, isRegularUnit, isWarMachine } from '../domain/army/unitTypeChecks';
import { calculateArmedWarMachineStats } from '../types/WarMachineArming';
import {
  MAP_HEIGHT,
  MAX_UNITS,
  PACK_COLS,
  PACK_ROWS,
  PACK_SIZE,
  PACK_SPACING,
  ZONE_ATTACKER,
  ZONE_DEFENDER,
} from './battleConfig';
import { RegularUnitName } from '../types/UnitType';
import { unitCombatStats } from '../domain/army/unitRepository';
import { TEAM_COLORS, UNIT_TYPE_COLORS } from './unitVisuals';
import type { Phase, Team } from './battleTypes';
import type { HeroUnitType, RegularUnitType, UnitType, WarMachineType } from '../types/UnitType';
import type { ArmedWarMachine } from '../types/WarMachineArming';
import type { BattleArmy } from '../state/army/BattleArmy';

export interface DeployPack {
  id: number;
  team: Team;
  type: UnitType;
  size: number;
  sprite: Phaser.GameObjects.Arc;
  range: number;
  isRanged: boolean;
  armedWarMachine?: ArmedWarMachine;
  hidden?: boolean;
}

type Zone = { x: number; width: number };

export default class DeployManager {
  private scene: Phaser.Scene;
  private packs = new Map<number, DeployPack>();
  private nextPackId = 1;
  private deployTeam: Team = 'attacker';
  private deployUnitType: UnitType = RegularUnitName.WARRIOR;
  private armingMode = false;
  private warMachineToArm?: DeployPack;
  private selectedPackId?: number;
  private rangeIndicator?: Phaser.GameObjects.Graphics;
  private onChange?: () => void;
  private getPhase: () => Phase;
  private humanArmy?: BattleArmy;
  private computerArmy?: BattleArmy;
  private availableUnits = new Map<UnitType, number>();

  constructor(scene: Phaser.Scene, getPhase: () => Phase, onChange?: () => void) {
    this.scene = scene;
    this.getPhase = getPhase;
    this.onChange = onChange;
  }

  setArmies(humanArmy: BattleArmy, computerArmy: BattleArmy) {
    this.humanArmy = humanArmy;
    this.computerArmy = computerArmy;
    this.resetAvailability();
    this.autoDeployComputer();
  }

  private resetAvailability() {
    this.availableUnits.clear();
    if (this.humanArmy) {
      this.humanArmy.regulars.forEach((r) => {
        this.availableUnits.set(r.type, (this.availableUnits.get(r.type) ?? 0) + r.count);
      });
      this.humanArmy.heroes.forEach((h) => {
        this.availableUnits.set(h.type, (this.availableUnits.get(h.type) ?? 0) + 1);
      });
      this.humanArmy.warMachines.forEach((wm) => {
        this.availableUnits.set(wm.type, (this.availableUnits.get(wm.type) ?? 0) + wm.count);
      });
    }
  }

  getAvailableUnits(): Map<UnitType, number> {
    return new Map(this.availableUnits);
  }

  initialize() {
    this.rangeIndicator = this.scene.add.graphics();
    this.scene.input.mouse?.disableContextMenu();

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.getPhase() !== 'deploy') {
        return;
      }

      if (!pointer.leftButtonDown()) {
        return;
      }

      if (this.isPointerHandledByPack(pointer)) {
        return;
      }

      this.clearSelection();

      if (this.armingMode && this.warMachineToArm) {
        this.exitArmingMode();
        return;
      }

      // Human can only place their units on their area
      const team = this.deployTeam;
      if (this.humanArmy?.battleSide !== team) {
        return;
      }

      const zone = this.getZoneForTeam(team);
      if (!this.pointInZone(pointer.x, pointer.y, zone)) {
        return;
      }

      this.spawnPack(pointer.x, pointer.y, team, this.deployUnitType);
      this.emitChange();
    });
    // ... existing initialization code ...

    this.scene.input.on(
      'gameobjectdown',
      (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        if (this.getPhase() !== 'deploy') {
          return;
        }

        const pack = this.getPackFromObject(gameObject);
        if (!pack) {
          return;
        }

        // Computer units are hidden and cannot be interacted with during deployment
        if (pack.hidden) {
          return;
        }

        const isRightClick = pointer.rightButtonDown() || pointer.button === 2;
        if (isRightClick) {
          this.removePack(pack);
          this.emitChange();
          return;
        }

        if (this.armingMode && this.warMachineToArm) {
          this.armWarMachine(this.warMachineToArm, pack);
          this.exitArmingMode();
          this.emitChange();
          return;
        }

        if (isWarMachine(pack.type) && !pack.armedWarMachine) {
          this.enterArmingMode(pack);
          return;
        }

        this.selectPack(pack);
      }
    );

    this.scene.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (this.getPhase() !== 'deploy') {
        return;
      }

      const pack = this.getPackFromObject(gameObject);
      if (!pack) {
        return;
      }

      if (pack.hidden) {
        return;
      }

      if (this.warMachineToArm?.id === pack.id) {
        this.exitArmingMode();
      }
      this.selectPack(pack);
    });

    this.scene.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        if (this.getPhase() !== 'deploy') {
          return;
        }

        const pack = this.getPackFromObject(gameObject);
        if (!pack || pack.hidden) {
          return;
        }

        const zone = this.getZoneForTeam(pack.team);
        const { x, y } = this.clampToZone(dragX, dragY, zone);
        pack.sprite.setPosition(x, y);
        if (this.selectedPackId === pack.id) {
          this.updateRangeIndicator(pack);
        }
      }
    );
  }

  autoDeployComputer() {
    if (!this.computerArmy) return;

    const team = this.computerArmy.battleSide;
    const zone = this.getZoneForTeam(team);

    // Template-based placement:
    // Melee in front
    // Ranged behind melee
    // Heroes behind everyone
    // War machines at the very back or flanks

    const meleeUnits = this.computerArmy.regulars.filter((r) => !unitCombatStats[r.type].range);
    const rangedUnits = this.computerArmy.regulars.filter((r) => (unitCombatStats[r.type].range ?? 0) > 0);
    const heroes = this.computerArmy.heroes;
    const warMachines = this.computerArmy.warMachines;

    let currentX: number;
    const isAttacker = team === 'attacker';

    // X-coordinates relative to zone
    // If attacker (left side), front is right side of zone
    // If defender (right side), front is left side of zone

    const stepX = 60;
    const centerX = zone.x + zone.width / 2;
    const startY = 100;
    const stepY = 80;

    if (isAttacker) {
      // Attacker: front is zone.x + zone.width, back is zone.x
      currentX = zone.x + zone.width - 50;
    } else {
      // Defender: front is zone.x, back is zone.x + zone.width
      currentX = zone.x + 50;
    }

    const nextX = () => {
      if (isAttacker) currentX -= stepX;
      else currentX += stepX;
    };

    // 1. Place Melee
    let y = startY;
    meleeUnits.forEach((u) => {
      const packsNeeded = Math.ceil(u.count / PACK_SIZE);
      for (let i = 0; i < packsNeeded; i++) {
        this.spawnPack(currentX, y, team, u.type, true);
        y += stepY;
        if (y > MAP_HEIGHT - 100) {
          y = startY;
          nextX();
        }
      }
    });
    if (y !== startY) nextX();

    // 2. Place Ranged
    y = startY;
    rangedUnits.forEach((u) => {
      const packsNeeded = Math.ceil(u.count / PACK_SIZE);
      for (let i = 0; i < packsNeeded; i++) {
        this.spawnPack(currentX, y, team, u.type, true);
        y += stepY;
        if (y > MAP_HEIGHT - 100) {
          y = startY;
          nextX();
        }
      }
    });
    if (y !== startY) nextX();

    // 3. Place Heroes
    y = startY;
    heroes.forEach((h) => {
      this.spawnPack(currentX, y, team, h.type, true);
      y += stepY;
      if (y > MAP_HEIGHT - 100) {
        y = startY;
        nextX();
      }
    });
    if (y !== startY) nextX();

    // 4. Place War Machines
    y = startY;
    const meleeType = meleeUnits[0]?.type;
    warMachines.forEach((wm) => {
      for (let i = 0; i < wm.count; i++) {
        const wmPack = this.spawnPack(currentX, y, team, wm.type, true);
        if (wmPack && meleeType) {
          // Auto-arm computer war machines with melee units
          const armingStats = unitCombatStats[meleeType];
          const armedStats = calculateArmedWarMachineStats(armingStats, PACK_SIZE);
          wmPack.armedWarMachine = {
            armedWith: meleeType,
            combatStats: armedStats as any,
          };
          wmPack.range = rangeToPixels(armedStats.range);
          wmPack.isRanged = true;
          wmPack.sprite.setStrokeStyle(2, 0xffa500, 1);
          const armedColor = UNIT_TYPE_COLORS[meleeType];
          if (armedColor) {
            wmPack.sprite.setFillStyle(armedColor, 0.95);
          }
        }
        y += stepY;
        if (y > MAP_HEIGHT - 100) {
          y = startY;
          nextX();
        }
      }
    });
  }

  destroy() {
    this.clearSelection();
    this.packs.forEach((pack) => pack.sprite.destroy());
    this.packs.clear();
  }

  setDeployTeam(team: Team) {
    this.deployTeam = team;
  }

  setDeployUnitType(type: UnitType) {
    this.deployUnitType = type;
  }

  reset() {
    this.exitArmingMode();
    this.clearSelection();
    this.packs.forEach((pack) => pack.sprite.destroy());
    this.packs.clear();
    this.nextPackId = 1;
    this.resetAvailability(); // Reset counts
    this.autoDeployComputer(); // Re-deploy computer after reset
    this.emitChange();
  }

  getTeamUnitCount(team: Team) {
    let count = 0;
    for (const pack of Array.from(this.packs.values())) {
      if (pack.team === team) {
        count += pack.size;
      }
    }
    return count;
  }

  getPacks() {
    return Array.from(this.packs.values());
  }

  materialize(createUnit: (x: number, y: number, team: Team, type: UnitType, armed?: ArmedWarMachine) => void) {
    for (const pack of Array.from(this.packs.values())) {
      if (pack.size === 1) {
        createUnit(pack.sprite.x, pack.sprite.y, pack.team, pack.type, pack.armedWarMachine);
        continue;
      }

      const zone = this.getZoneForTeam(pack.team);
      const minX = zone.x + 8;
      const maxX = zone.x + zone.width - 8;
      const startX = pack.sprite.x - ((PACK_COLS - 1) * PACK_SPACING) / 2;
      const startY = pack.sprite.y - ((PACK_ROWS - 1) * PACK_SPACING) / 2;

      for (let row = 0; row < PACK_ROWS; row += 1) {
        for (let col = 0; col < PACK_COLS; col += 1) {
          const unitX = Phaser.Math.Clamp(startX + col * PACK_SPACING, minX, maxX);
          const unitY = Phaser.Math.Clamp(startY + row * PACK_SPACING, 10, MAP_HEIGHT - 10);
          createUnit(unitX, unitY, pack.team, pack.type);
        }
      }
    }

    this.packs.forEach((pack) => pack.sprite.destroy());
    this.packs.clear();
    this.clearSelection();
  }

  private emitChange() {
    this.onChange?.();
  }

  private getZoneForTeam(team: Team): Zone {
    return team === 'attacker' ? ZONE_ATTACKER : ZONE_DEFENDER;
  }

  private pointInZone(x: number, y: number, zone: Zone) {
    return x >= zone.x && x <= zone.x + zone.width && y >= 0 && y <= MAP_HEIGHT;
  }

  private clampToZone(x: number, y: number, zone: Zone) {
    const minX = zone.x + 8;
    const maxX = zone.x + zone.width - 8;
    const clampedX = Phaser.Math.Clamp(x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(y, 10, MAP_HEIGHT - 10);
    return { x: clampedX, y: clampedY };
  }

  private spawnPack(x: number, y: number, team: Team, type: UnitType, hidden = false): DeployPack | undefined {
    const zone = this.getZoneForTeam(team);
    if (!this.pointInZone(x, y, zone)) {
      return;
    }

    const isSingleUnit = isHeroType(type as HeroUnitType) || isWarMachine(type as WarMachineType);
    const unitsToSpawn = isSingleUnit ? 1 : PACK_SIZE;

    // Check availability only for manual human deployment
    if (!hidden) {
      const availableCount = this.availableUnits.get(type) ?? 0;
      if (availableCount < unitsToSpawn) {
        console.warn(`Not enough units of type ${type} available.`);
        return;
      }
      // Consume units
      this.availableUnits.set(type, availableCount - unitsToSpawn);
    }

    const currentCount = this.getTeamUnitCount(team);

    if (currentCount + unitsToSpawn > MAX_UNITS) {
      // If we failed to spawn, we should return units to pool if it was human deployment
      if (!hidden) {
        this.availableUnits.set(type, (this.availableUnits.get(type) ?? 0) + unitsToSpawn);
      }
      return;
    }

    const { x: packX, y: packY } = this.clampToZone(x, y, zone);
    const pack = this.createPack(packX, packY, team, type, unitsToSpawn, hidden);
    this.packs.set(pack.id, pack);
    return pack;
  }

  private createPack(x: number, y: number, team: Team, type: UnitType, size: number, hidden = false): DeployPack {
    const combatData = unitCombatStats[type as RegularUnitType | HeroUnitType | WarMachineType];
    const derived = deriveBattleStats(combatData);
    const packColor = UNIT_TYPE_COLORS[type] ?? TEAM_COLORS[team];
    const radius = this.getPackRadius(type);
    const sprite = this.scene.add.circle(x, y, radius, packColor, 0.95);

    if (hidden) {
      sprite.setAlpha(0);
    } else {
      sprite.setInteractive({ useHandCursor: true });
      this.scene.input.setDraggable(sprite);
    }

    const pack: DeployPack = {
      id: this.nextPackId,
      team,
      type,
      size,
      sprite,
      range: derived.range,
      isRanged: derived.isRanged,
      hidden,
    };

    this.nextPackId += 1;
    sprite.setData('packId', pack.id);

    return pack;
  }

  private getPackRadius(type: UnitType) {
    if (isWarMachine(type as WarMachineType)) {
      return 13;
    }
    if (isHeroType(type as HeroUnitType)) {
      return 10;
    }
    return 11;
  }

  private getPackFromObject(gameObject: Phaser.GameObjects.GameObject) {
    const packId = gameObject.getData('packId');
    if (!packId) {
      return undefined;
    }
    return this.packs.get(packId as number);
  }

  private isPointerHandledByPack(pointer: Phaser.Input.Pointer) {
    for (const pack of Array.from(this.packs.values())) {
      // Don't block clicking through hidden packs
      if (pack.hidden) continue;

      const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, pack.sprite.x, pack.sprite.y);
      if (distance <= pack.sprite.radius) {
        return true;
      }
    }
    return false;
  }

  private selectPack(pack: DeployPack) {
    if (pack.hidden) return;
    this.selectedPackId = pack.id;
    this.updateRangeIndicator(pack);
  }

  private clearSelection() {
    this.selectedPackId = undefined;
    this.rangeIndicator?.clear();
  }

  private updateRangeIndicator(pack: DeployPack) {
    if (!this.rangeIndicator || pack.hidden) {
      return;
    }
    this.rangeIndicator.clear();

    if (isWarMachine(pack.type) && !pack.armedWarMachine) {
      return;
    }

    const color = UNIT_TYPE_COLORS[pack.type] ?? TEAM_COLORS[pack.team];
    this.rangeIndicator.lineStyle(2, color, 0.45);
    this.rangeIndicator.fillStyle(color, 0.08);
    this.rangeIndicator.strokeCircle(pack.sprite.x, pack.sprite.y, pack.range);
    this.rangeIndicator.fillCircle(pack.sprite.x, pack.sprite.y, pack.range);
  }

  private removePack(pack: DeployPack, skipReturnUnits = false) {
    if (pack.hidden) return; // Cannot remove computer units

    if (!skipReturnUnits) {
      // Return units to pool
      this.availableUnits.set(pack.type, (this.availableUnits.get(pack.type) ?? 0) + pack.size);

      // If it was an armed war machine, also return the units it was armed with
      if (pack.armedWarMachine) {
        const armedWithType = pack.armedWarMachine.armedWith;
        // Armed war machines are always armed with a full pack of units
        this.availableUnits.set(armedWithType, (this.availableUnits.get(armedWithType) ?? 0) + PACK_SIZE);
      }
    }

    if (this.selectedPackId === pack.id) {
      this.clearSelection();
    }
    if (this.warMachineToArm?.id === pack.id) {
      this.exitArmingMode();
    }
    pack.sprite.destroy();
    this.packs.delete(pack.id);
  }

  private enterArmingMode(pack: DeployPack) {
    if (pack.hidden) return;
    this.armingMode = true;
    this.warMachineToArm = pack;
    pack.sprite.setStrokeStyle(3, 0xffff00, 1);
  }

  private exitArmingMode() {
    if (this.warMachineToArm) {
      this.warMachineToArm.sprite.setStrokeStyle(0);
    }
    this.armingMode = false;
    this.warMachineToArm = undefined;
  }

  private armWarMachine(warMachine: DeployPack, armingPack: DeployPack) {
    if (warMachine.hidden || armingPack.hidden) return;
    if (!isRegularUnit(armingPack.type)) {
      return;
    }

    const armingStats = unitCombatStats[armingPack.type];
    if (armingStats.range && armingStats.range > 0) {
      return;
    }

    if (armingPack.size < PACK_SIZE) {
      return;
    }

    const armedStats = calculateArmedWarMachineStats(armingStats, armingPack.size);
    warMachine.armedWarMachine = {
      armedWith: armingPack.type as RegularUnitType,
      combatStats: armedStats as any, // Cast because of cooldownMs
    };

    warMachine.range = rangeToPixels(armedStats.range);
    warMachine.isRanged = true;

    warMachine.sprite.setStrokeStyle(2, 0xffa500, 1);
    const armedColor = UNIT_TYPE_COLORS[armingPack.type];
    if (armedColor) {
      warMachine.sprite.setFillStyle(armedColor, 0.95);
    }

    // This pack is now "inside" the war machine, so skip returning to pool
    this.removePack(armingPack, true);

    if (this.selectedPackId === warMachine.id) {
      this.updateRangeIndicator(warMachine);
    }
  }
}
