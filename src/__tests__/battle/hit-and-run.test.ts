import { HeroUnitName, RegularUnitName } from '../../types/UnitType';
import { simulateBattle } from '../../domain/battle/simulateBattle';

describe('Hit and Run strategy', () => {
  test('Hammerlord vs Warriors pack', () => {
    const result = simulateBattle({
      attackerType: HeroUnitName.HAMMER_LORD,
      defenderType: RegularUnitName.WARRIOR,
      attackerCount: 1,
      defenderCount: 20,
      maxDurationMs: 60_000,
      startDistance: 100,
    });

    console.log('Hammerlord vs Warriors Result:', result);
    // After fix, Hammerlord should win with hit-and-run
    expect(result.winner).toBe('attacker');
  });
});
