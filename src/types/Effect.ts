import type { SpellType } from './Spell';
import type { TreasureType } from './Treasures';

export const EffectTarget = {
  PLAYER: 'player',
  ARMY: 'army',
  LAND: 'land',
} as const;

export type EffectTargetType = (typeof EffectTarget)[keyof typeof EffectTarget];

export const EffectKind = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  PERMANENT: 'permanent',
} as const;

export type EffectType = (typeof EffectKind)[keyof typeof EffectKind];

export type EffectSourceId = SpellType | TreasureType;

export type Effect = {
  /** UUID **/
  id: string;
  sourceId: EffectSourceId;
  appliedBy: string; // who use spell or treasure item (some effects are related only to owner)
  rules: EffectRules;
};

export type EffectRules = {
  type: EffectType;
  target: EffectTargetType;
  duration: number;
};
