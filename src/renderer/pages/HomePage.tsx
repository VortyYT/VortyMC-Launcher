import React, { useState, useEffect } from 'react';
import { FiPlay, FiPlusSquare, FiUsers, FiBox, FiCpu } from 'react-icons/fi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface Props {
  onNavigate: (page: 'home' | 'play' | 'create' | 'accounts' | 'settings') => void;
  accountCount: number;
}

export default function HomePage({ onNavigate, accountCount }: Props) {
  const [installedCount, setInstalledCount] = useState(0);

  useEffect(() => {
    if (!ipcRenderer) return;
    ipcRenderer.invoke('versions:installed').then((inst: string[]) => {
      setInstalledCount(inst.length);
    });
  }, []);

  return (
    <div className="fade-in">
      <div className="home-hero">
        <div className="home-hero__glow" />
        <h1 className="home-hero__title">VORTYMC</h1>
        <p className="home-hero__tagline">
          Your gateway to Minecraft &mdash; from Beta 1.7.3 to the latest release
        </p>
        <div className="home-hero__version">LAUNCHER v1.0.0</div>
        <button className="btn btn--launch" onClick={() => onNavigate('play')}>
          PLAY NOW
        </button>
      </div>

      <div className="home-stats">
        <div className="home-stat" onClick={() => onNavigate('play')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value"><FiPlay /></div>
          <div className="home-stat__label">Launch Game</div>
        </div>
        <div className="home-stat" onClick={() => onNavigate('create')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value"><FiPlusSquare /></div>
          <div className="home-stat__label">Create Build</div>
        </div>
        <div className="home-stat" onClick={() => onNavigate('accounts')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value">{accountCount}</div>
          <div className="home-stat__label">Accounts</div>
        </div>
      </div>

      <div className="home-features">
        <div className="home-feature">
          <div className="home-feature__icon"><FiBox /></div>
          <div className="home-feature__content">
            <div className="home-feature__title">Version Manager</div>
            <div className="home-feature__desc">
              {installedCount > 0
                ? `${installedCount} version${installedCount > 1 ? 's' : ''} installed`
                : 'Download and manage any Minecraft version'}
            </div>
          </div>
        </div>
        <div className="home-feature">
          <div className="home-feature__icon"><FiCpu /></div>
          <div className="home-feature__content">
            <div className="home-feature__title">Custom Builds</div>
            <div className="home-feature__desc">Create profiles with custom JVM & game arguments</div>
          </div>
        </div>
        <div className="home-feature">
          <div className="home-feature__icon"><FiUsers /></div>
          <div className="home-feature__content">
            <div className="home-feature__title">Account Support</div>
            <div className="home-feature__desc">Offline play or Microsoft login for skins & online</div>
          </div>
        </div>
      </div>
    </div>
  );
}
