import { RegularUnitName } from '../../types/UnitType';
import { simulateBattle } from '../../domain/battle/simulateBattle';

test('simulates a warrior vs dwarf pack battle', () => {
  const result = simulateBattle({
    attackerType: RegularUnitName.WARRIOR,
    defenderType: RegularUnitName.DWARF,
    packSize: 20,
    maxDurationMs: 90_000,
    timeStepMs: 50,
    startDistance: 320,
  });

  expect(result.winner).toBe('defender');
  expect(result.remaining.defender).toBeGreaterThan(10);
  expect(result.remaining.defender).toBeLessThan(20);
  expect(result.remaining.attacker).toBe(0);
});
