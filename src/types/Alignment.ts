export const Alignment = {
  LAWFUL: 'lawful',
  NEUTRAL: 'neutral',
  CHAOTIC: 'chaotic',
  NONE: 'none', // used when any alignment is valid
} as const;

export type AlignmentType = (typeof Alignment)[keyof typeof Alignment];
