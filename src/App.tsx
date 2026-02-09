import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './App.css';
import BattleScene from './game/BattleScene';
import { HeroUnitName, RegularUnitName, WarMachineName } from './types/UnitType';
import type { BattleStats, Team } from './game/battleTypes';
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
  const [deployTeam, setDeployTeam] = useState<Team>('attacker');
  const [deployUnitType, setDeployUnitType] = useState<UnitType>(RegularUnitName.WARRIOR);
  const [autoResolveResult, setAutoResolveResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new BattleScene();
    sceneRef.current = scene;

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

    const onStats = (nextStats: BattleStats) => setStats(nextStats);
    scene.setStatsCallback(onStats);

    return () => {
      scene.setStatsCallback(undefined);
      game.destroy(true);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setDeployTeam(deployTeam);
  }, [deployTeam]);

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
    setDeployTeam('attacker');
    setDeployUnitType(RegularUnitName.WARRIOR);
    setAutoResolveResult(null);
  };

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
            <span>Attacker</span>
            <strong>{stats.attacker}</strong>
          </div>
          <div>
            <span>Defender</span>
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
            <button
              type="button"
              className={deployTeam === 'attacker' ? 'is-active' : ''}
              onClick={() => setDeployTeam('attacker')}
            >
              Attacker
            </button>
            <button
              type="button"
              className={deployTeam === 'defender' ? 'is-active' : ''}
              onClick={() => setDeployTeam('defender')}
            >
              Defender
            </button>
          </div>
        </div>
        <div className="control-group">
          <span>Regular Units</span>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
            {Object.values(RegularUnitName).map((unitName) => (
              <button
                key={unitName}
                type="button"
                className={deployUnitType === unitName ? 'is-active' : ''}
                onClick={() => setDeployUnitType(unitName)}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {unitName}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span>Hero Units</span>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
            {Object.values(HeroUnitName).map((unitName) => (
              <button
                key={unitName}
                type="button"
                className={deployUnitType === unitName ? 'is-active' : ''}
                onClick={() => setDeployUnitType(unitName)}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {unitName}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span>War Machines</span>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
            {Object.values(WarMachineName).map((unitName) => (
              <button
                key={unitName}
                type="button"
                className={deployUnitType === unitName ? 'is-active' : ''}
                onClick={() => setDeployUnitType(unitName)}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {unitName}
              </button>
            ))}
          </div>
        </div>
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
            <li>Attacker controls the left 30% of the map.</li>
            <li>Neutral ground spans the middle 10%.</li>
            <li>Defender controls the right 60% of the map.</li>
            <li>Click to drop a 20-unit pack at once.</li>
            <li>Click a pack to preview its attack range (armed war machines only).</li>
            <li>Drag a pack to reposition it.</li>
            <li>Right-click a pack to remove it.</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}

export default App;
