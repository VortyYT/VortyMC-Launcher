import React from 'react';
import { FiPlay, FiPlusSquare, FiUsers } from 'react-icons/fi';

interface Props {
  onNavigate: (page: 'home' | 'play' | 'create' | 'accounts' | 'settings') => void;
  accountCount: number;
}

export default function HomePage({ onNavigate, accountCount }: Props) {
  return (
    <div className="fade-in">
      <div className="home-hero">
        <h1 className="home-hero__title">VORTYMC</h1>
        <p className="home-hero__tagline">
          Your gateway to Minecraft &mdash; from Beta 1.7.3 to the latest release
        </p>
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
    </div>
  );
}
