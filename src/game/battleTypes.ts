export type Phase = 'deploy' | 'battle';
export type Team = 'attacker' | 'defender';

export interface BattleStats {
  phase: Phase;
  attacker: number;
  defender: number;
}
