// https://github.com/j8kin/fantasy-empires-wars/wiki/Lands

export const LandName = {
  NONE: 'None',
  // Regular lands
  PLAINS: 'Plains',
  MOUNTAINS: 'Mountains',
  GREEN_FOREST: 'Green Forest',
  DARK_FOREST: 'Dark Forest',
  HILLS: 'Hills',
  SWAMP: 'Swamp',
  DESERT: 'Desert',
  // special lands
  VOLCANO: 'Volcano',
  LAVA: 'Lava',
  SUN_SPIRE_PEAKS: 'Sunspire Peaks',
  GOLDEN_PLAINS: 'Golden Plains',
  HEARTWOOD_GROVE: 'Heartwood Grove',
  VERDANT_GLADE: 'Verdant Glade',
  CRISTAL_BASIN: 'Crystal Basin',
  MISTY_GLADES: 'Misty Glades',
  SHADOW_MIRE: 'Shadow Mire',
  BLIGHTED_FEN: 'Blighted Fen',
} as const;

export type LandType = (typeof LandName)[keyof typeof LandName];
