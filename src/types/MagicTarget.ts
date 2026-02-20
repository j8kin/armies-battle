export const MagicTarget = {
  PLAYER: 'player',
  OPPONENT: 'opponent',
  ALL: 'all',
} as const;
export type MagicTargetType = (typeof MagicTarget)[keyof typeof MagicTarget];
