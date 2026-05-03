import React, { useState, useEffect } from 'react';
import { FiPlay, FiPlusSquare, FiUsers, FiBox, FiPackage, FiExternalLink } from 'react-icons/fi';
import VortyLogo from '../components/VortyLogo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface Props {
  onNavigate: (page: 'home' | 'play' | 'builds' | 'mods' | 'create' | 'accounts' | 'settings') => void;
  accountCount: number;
}

interface NewsItem {
  id: string;
  title: string;
  tag: string;
  date: string;
  imageUrl: string;
  url: string;
}

const FALLBACK_NEWS: NewsItem[] = [
  { id: '1', title: 'Minecraft 1.21.5 - The Garden Awakens Update', tag: 'Java', date: '2025-03-25', imageUrl: '', url: 'https://www.minecraft.net' },
  { id: '2', title: 'Mob Vote 2025 Results Are In!', tag: 'News', date: '2025-03-15', imageUrl: '', url: 'https://www.minecraft.net' },
  { id: '3', title: 'Snapshot 25w14a - New Biome Features', tag: 'Snapshot', date: '2025-04-02', imageUrl: '', url: 'https://www.minecraft.net' },
  { id: '4', title: 'Minecraft Live 2025 Recap', tag: 'Event', date: '2025-02-20', imageUrl: '', url: 'https://www.minecraft.net' },
  { id: '5', title: 'Community Spotlight: Best Builds of March', tag: 'Community', date: '2025-03-30', imageUrl: '', url: 'https://www.minecraft.net' },
  { id: '6', title: 'New Marketplace Content: Spring Collection', tag: 'Marketplace', date: '2025-03-10', imageUrl: '', url: 'https://www.minecraft.net' },
];

export default function HomePage({ onNavigate, accountCount }: Props) {
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS);

  useEffect(() => {
    if (!ipcRenderer) return;
    ipcRenderer.invoke('news:fetch').then((items: NewsItem[]) => {
      if (items && items.length > 0) setNews(items);
    }).catch(() => {});
  }, []);

  const tagColor = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'java': return 'var(--success)';
      case 'snapshot': return 'var(--warning)';
      case 'event': return 'var(--purple-neon)';
      case 'news': return 'var(--neon-cyan)';
      case 'community': return 'var(--neon-pink)';
      default: return 'var(--purple-light)';
    }
  };

  return (
    <div className="fade-in">
      <div className="home-hero">
        <VortyLogo size={64} glow className="home-hero__logo" />
        <h1 className="minecraft-title">VortyMC</h1>
        <p className="home-hero__tagline">
          Your gateway to Minecraft &mdash; from Alpha to the latest release
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
        <div className="home-stat" onClick={() => onNavigate('builds')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value"><FiBox /></div>
          <div className="home-stat__label">All Builds</div>
        </div>
        <div className="home-stat" onClick={() => onNavigate('mods')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value"><FiPackage /></div>
          <div className="home-stat__label">Browse Mods</div>
        </div>
        <div className="home-stat" onClick={() => onNavigate('create')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value"><FiPlusSquare /></div>
          <div className="home-stat__label">Create Profile</div>
        </div>
        <div className="home-stat" onClick={() => onNavigate('accounts')} style={{ cursor: 'pointer' }}>
          <div className="home-stat__value">{accountCount}</div>
          <div className="home-stat__label">Accounts</div>
        </div>
      </div>

      <div className="news-section">
        <h2 className="news-section__title">
          <VortyLogo size={20} glow />
          LATEST NEWS
        </h2>
        <div className="news-grid">
          {news.map(item => (
            <div
              key={item.id}
              className="news-card"
              onClick={() => {
                if (ipcRenderer) ipcRenderer.invoke('shell:openExternal', item.url);
                else window.open(item.url, '_blank');
              }}
            >
              <div className="news-card__image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} />
                ) : (
                  <div className="news-card__placeholder">
                    <VortyLogo size={32} glow />
                  </div>
                )}
              </div>
              <div className="news-card__content">
                <div className="news-card__tag" style={{ color: tagColor(item.tag) }}>
                  {item.tag}
                </div>
                <h3 className="news-card__title">{item.title}</h3>
                <div className="news-card__date">{item.date}</div>
              </div>
              <FiExternalLink className="news-card__link" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
