import { RegularsState } from './RegularsState';
import { HeroState } from './HeroState';
import { WarMachineState } from './WarMachineState';

export const BattleSide = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
} as const;

export type BattleSideType = (typeof BattleSide)[keyof typeof BattleSide];

export interface BattleArmy {
  /** player id **/
  controlledBy: string;
  battleSide: BattleSideType;
  regulars: RegularsState[];
  heroes: HeroState[];
  warMachines: WarMachineState[];
}
