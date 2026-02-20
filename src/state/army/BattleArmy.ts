import { RegularsState } from './RegularsState';
import { HeroState } from './HeroState';
import { WarMachineState } from './WarMachineState';

export interface BattleArmy {
  /** player id **/
  controlledBy: string;
  regulars: RegularsState[];
  heroes: HeroState[];
  warMachines: WarMachineState[];
}
