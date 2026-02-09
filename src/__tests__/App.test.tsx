import { render, screen } from '@testing-library/react';
import App from '../App';

jest.mock('phaser', () => {
  class GameMock {
    destroy = jest.fn();
    constructor(_: any) {}
  }
  return {
    __esModule: true,
    default: {
      Game: GameMock,
      AUTO: 'AUTO',
      Scale: {
        FIT: 'FIT',
        CENTER_BOTH: 'CENTER_BOTH',
      },
    },
  };
});

jest.mock('../game/BattleScene', () => {
  class BattleSceneMock {
    setStatsCallback = jest.fn();
    setDeployTeam = jest.fn();
    setDeployUnitType = jest.fn();
    startBattle = jest.fn();
    autoResolveBattle = jest.fn();
    resetBattle = jest.fn();
  }
  return {
    __esModule: true,
    default: BattleSceneMock,
  };
});

test('renders the armies battle title', () => {
  render(<App />);
  const title = screen.getByText(/armies battle/i);
  expect(title).toBeInTheDocument();
});
