import type { HeroUnitType } from './UnitType';
import type { LandType } from './Land';

export const MAX_MANA = 200;

export const Mana = {
  WHITE: 'white',
  BLACK: 'black',
  GREEN: 'green',
  BLUE: 'blue',
  RED: 'red',
} as const;

export type ManaType = (typeof Mana)[keyof typeof Mana];

export interface ManaSource {
  type: ManaType;
  heroTypes: HeroUnitType[];
  landTypes: LandType[];
}
