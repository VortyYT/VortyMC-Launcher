import React from 'react';
import { FiHome, FiPlay, FiBox, FiPackage, FiPlusSquare, FiUsers, FiSettings } from 'react-icons/fi';
import VortyLogo from './VortyLogo';
import type { Account } from '../App';

interface Props {
  page: string;
  onNavigate: (page: 'home' | 'play' | 'builds' | 'mods' | 'create' | 'accounts' | 'settings') => void;
  activeAccount: Account | null;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: FiHome },
  { id: 'play', label: 'Play', icon: FiPlay },
  { id: 'builds', label: 'Builds', icon: FiBox },
  { id: 'mods', label: 'Mods', icon: FiPackage },
  { id: 'create', label: 'Create', icon: FiPlusSquare },
  { id: 'accounts', label: 'Accounts', icon: FiUsers },
  { id: 'settings', label: 'Settings', icon: FiSettings },
] as const;

export default function Sidebar({ page, onNavigate, activeAccount }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar__brand" onClick={() => onNavigate('home')}>
        <VortyLogo size={28} glow />
        <span className="sidebar__brand-text">VortyMC</span>
      </div>
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`sidebar__link ${page === item.id ? 'sidebar__link--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="sidebar__icon" />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__account" onClick={() => onNavigate('accounts')}>
          <div className="sidebar__avatar">
            {activeAccount ? activeAccount.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="sidebar__account-info">
            <div className="sidebar__account-name">
              {activeAccount ? activeAccount.username : 'No Account'}
            </div>
            <div className="sidebar__account-type">
              {activeAccount ? activeAccount.type : 'Click to add'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
