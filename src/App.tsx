import './App.css';
import Phaser from 'phaser';
import BattleScene from './game/BattleScene';
import { useEffect, useRef, useState } from 'react';
import { RegularUnitName } from './types/UnitType';
import { HUMAN_ARMY, COMPUTER_ARMY } from './game/defaultArmies';
import type { BattleStats } from './game/battleTypes';
import type { UnitType } from './types/UnitType';
import type { SimulationResult } from './domain/battle/simulateBattle';

const PHASER_WIDTH = 1200;
const PHASER_HEIGHT = 700;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const [stats, setStats] = useState<BattleStats>({
    phase: 'deploy',
    attacker: 0,
    defender: 0,
  });

  // Set default deployment unit to first one in human army
  const firstUnit =
    HUMAN_ARMY.regulars[0]?.type ||
    HUMAN_ARMY.heroes[0]?.type ||
    HUMAN_ARMY.warMachines[0]?.type ||
    RegularUnitName.WARRIOR;
  const [deployUnitType, setDeployUnitType] = useState<UnitType>(firstUnit);
  const [autoResolveResult, setAutoResolveResult] = useState<SimulationResult | null>(null);
  const [availableUnits, setAvailableUnits] = useState<Map<UnitType, number>>(new Map());

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new BattleScene();
    sceneRef.current = scene;

    // Set armies before game creation if possible, or via method
    scene.setArmies(HUMAN_ARMY, COMPUTER_ARMY);

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#0b0f1a',
      width: PHASER_WIDTH,
      height: PHASER_HEIGHT,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: PHASER_WIDTH,
        height: PHASER_HEIGHT,
      },
      scene: [scene],
    });

    const onStats = (nextStats: BattleStats) => {
      setStats(nextStats);
      if (sceneRef.current) {
        setAvailableUnits(sceneRef.current.getAvailableUnits());
      }
    };
    scene.setStatsCallback(onStats);

    return () => {
      scene.setStatsCallback(undefined);
      game.destroy(true);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Human is always their side (usually attacker in this setup)
    sceneRef.current?.setDeployTeam(HUMAN_ARMY.battleSide);
  }, []);

  useEffect(() => {
    sceneRef.current?.setDeployUnitType(deployUnitType);
  }, [deployUnitType]);

  const startBattle = () => {
    sceneRef.current?.startBattle();
    setAutoResolveResult(null);
  };

  const autoResolve = () => {
    const result = sceneRef.current?.autoResolveBattle() ?? null;
    setAutoResolveResult(result);
  };

  const resetBattle = () => {
    sceneRef.current?.resetBattle();
    setDeployUnitType(firstUnit);
    setAutoResolveResult(null);
  };

  const humanRegulars = HUMAN_ARMY.regulars.map((r) => r.type);
  const humanHeroes = HUMAN_ARMY.heroes.map((h) => h.type);
  const humanWarMachines = HUMAN_ARMY.warMachines.map((wm) => wm.type);

  const getAvailableCount = (type: UnitType) => availableUnits.get(type) ?? 0;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>Armies Battle</h1>
          <p>Deploy packs of 20 units, then watch the real-time clash.</p>
        </div>
        <div className="app__stats">
          <div>
            <span>Phase</span>
            <strong>{stats.phase === 'deploy' ? 'Deploy' : 'Battle'}</strong>
          </div>
          <div>
            <span>Attacker (You)</span>
            <strong>{stats.attacker}</strong>
          </div>
          <div>
            <span>Defender (CPU)</span>
            <strong>{stats.defender}</strong>
          </div>
          <div>
            <span>Auto-resolve</span>
            <strong>{autoResolveResult ? autoResolveResult.winner : '—'}</strong>
          </div>
        </div>
      </header>

      <section className="app__controls">
        <div className="control-group">
          <span>Deploy team</span>
          <div className="button-row">
            <button type="button" className="is-active" disabled>
              {HUMAN_ARMY.battleSide === 'attacker' ? 'Attacker' : 'Defender'}
            </button>
          </div>
        </div>
        {humanRegulars.length > 0 && (
          <div className="control-group">
            <span>Your Regular Units</span>
            <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {humanRegulars.map((unitName) => {
                const count = getAvailableCount(unitName);
                return (
                  <button
                    key={unitName}
                    type="button"
                    className={deployUnitType === unitName ? 'is-active' : ''}
                    onClick={() => setDeployUnitType(unitName)}
                    disabled={count < 20}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    {unitName} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {humanHeroes.length > 0 && (
          <div className="control-group">
            <span>Your Hero Units</span>
            <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {humanHeroes.map((unitName) => {
                const count = getAvailableCount(unitName);
                return (
                  <button
                    key={unitName}
                    type="button"
                    className={deployUnitType === unitName ? 'is-active' : ''}
                    onClick={() => setDeployUnitType(unitName)}
                    disabled={count < 1}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    {unitName} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {humanWarMachines.length > 0 && (
          <div className="control-group">
            <span>Your War Machines</span>
            <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {humanWarMachines.map((unitName) => {
                const count = getAvailableCount(unitName);
                return (
                  <button
                    key={unitName}
                    type="button"
                    className={deployUnitType === unitName ? 'is-active' : ''}
                    onClick={() => setDeployUnitType(unitName)}
                    disabled={count < 1}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    {unitName} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="control-group">
          <span>Actions</span>
          <div className="button-row">
            <button type="button" onClick={startBattle}>
              Start battle
            </button>
            <button type="button" onClick={autoResolve}>
              Auto-resolve
            </button>
            <button type="button" onClick={resetBattle}>
              Reset field
            </button>
          </div>
        </div>
      </section>

      <main className="app__arena">
        <div className="phaser-container" ref={containerRef} />
        <aside className="app__tips">
          <h2>Deployment rules</h2>
          <ul>
            <li>You control the {HUMAN_ARMY.battleSide === 'attacker' ? 'left 30%' : 'right 60%'} of the map.</li>
            <li>Click to drop a pack from your army.</li>
            <li>Computer units are hidden until the battle starts.</li>
            <li>Right-click a pack to remove it.</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}

export default App;
