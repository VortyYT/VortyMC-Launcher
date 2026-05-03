import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiSearch, FiPlay } from 'react-icons/fi';
import type { Account, Settings } from '../App';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface VersionEntry {
  id: string;
  type: string;
  releaseTime: string;
  url: string;
}

interface InstallProgress {
  versionId: string;
  status: string;
  progress: number;
}

interface Props {
  account: Account | null;
  settings: Settings;
}

export default function PlayPage({ account, settings }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [launching, setLaunching] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const loadVersions = useCallback(async () => {
    if (!ipcRenderer) {
      setVersions([
        { id: '1.21', type: 'release', releaseTime: '2024-06-13', url: '' },
        { id: '1.20.6', type: 'release', releaseTime: '2024-04-29', url: '' },
        { id: '1.20.4', type: 'release', releaseTime: '2024-01-24', url: '' },
        { id: '1.20.2', type: 'release', releaseTime: '2023-09-21', url: '' },
        { id: '1.20.1', type: 'release', releaseTime: '2023-06-12', url: '' },
        { id: '1.19.4', type: 'release', releaseTime: '2023-03-14', url: '' },
        { id: '1.18.2', type: 'release', releaseTime: '2022-02-28', url: '' },
        { id: '1.16.5', type: 'release', releaseTime: '2021-01-15', url: '' },
        { id: '1.12.2', type: 'release', releaseTime: '2017-09-18', url: '' },
        { id: '1.8.9', type: 'release', releaseTime: '2015-12-09', url: '' },
        { id: '1.7.10', type: 'release', releaseTime: '2014-06-26', url: '' },
        { id: 'b1.7.3', type: 'old_beta', releaseTime: '2011-07-08', url: '' },
      ]);
      return;
    }
    const v = await ipcRenderer.invoke('versions:list');
    const inst = await ipcRenderer.invoke('versions:installed');
    setVersions(v);
    setInstalled(inst);
    if (v.length > 0 && !selected) {
      const firstRelease = v.find((ver: VersionEntry) => ver.type === 'release');
      setSelected(firstRelease?.id || v[0].id);
    }
  }, [selected]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    if (!ipcRenderer) return;
    const onProgress = (_e: unknown, data: InstallProgress) => setInstallProgress(data);
    const onLog = (_e: unknown, log: string) => setLogs(prev => [...prev.slice(-200), log]);
    const onExit = (_e: unknown, code: number) => {
      setGameRunning(false);
      setLogs(prev => [...prev, `\nGame exited with code ${code}`]);
    };

    ipcRenderer.on('install:progress', onProgress);
    ipcRenderer.on('game:log', onLog);
    ipcRenderer.on('game:exit', onExit);

    return () => {
      ipcRenderer.removeListener('install:progress', onProgress);
      ipcRenderer.removeListener('game:log', onLog);
      ipcRenderer.removeListener('game:exit', onExit);
    };
  }, []);

  const filteredVersions = versions.filter(v => {
    if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'release' && v.type !== 'release') return false;
    if (filter === 'snapshot' && v.type !== 'snapshot') return false;
    if (filter === 'beta' && v.type !== 'old_beta') return false;
    if (filter === 'alpha' && v.type !== 'old_alpha') return false;
    if (filter === 'installed' && !installed.includes(v.id)) return false;

    if (!settings.showSnapshots && v.type === 'snapshot') return false;
    if (!settings.showBeta && v.type === 'old_beta') return false;
    if (!settings.showAlpha && v.type === 'old_alpha') return false;

    return true;
  });

  const handleInstall = async () => {
    if (!ipcRenderer || !selected) return;
    const version = versions.find(v => v.id === selected);
    if (!version) return;
    setInstalling(selected);
    try {
      await ipcRenderer.invoke('versions:install', selected, version.url);
      const inst = await ipcRenderer.invoke('versions:installed');
      setInstalled(inst);
    } catch (err) {
      console.error('Install failed:', err);
    }
    setInstalling(null);
    setInstallProgress(null);
  };

  const handleLaunch = async () => {
    if (!ipcRenderer || !selected || !account) return;
    setLaunching(true);
    setLogs([]);
    try {
      const result = await ipcRenderer.invoke('game:launch', {
        versionId: selected,
        account,
        memory: settings.memory,
      });
      if (result.success) {
        setGameRunning(true);
      } else {
        setLogs(prev => [...prev, `Launch failed: ${result.error}`]);
      }
    } catch (err) {
      setLogs(prev => [...prev, `Launch error: ${err}`]);
    }
    setLaunching(false);
  };

  const handleKill = async () => {
    if (!ipcRenderer) return;
    await ipcRenderer.invoke('game:kill');
    setGameRunning(false);
  };

  const isInstalled = installed.includes(selected);
  const badgeType = (type: string) => {
    switch (type) {
      case 'release': return 'release';
      case 'snapshot': return 'snapshot';
      case 'old_beta': return 'beta';
      case 'old_alpha': return 'alpha';
      default: return 'release';
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">PLAY</h1>
        <p className="page-header__subtitle">Select a version and launch Minecraft</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Version list */}
        <div>
          <div className="search-bar">
            <FiSearch className="search-bar__icon" />
            <input
              className="search-bar__input"
              placeholder="Search versions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-bar">
            {['all', 'release', 'snapshot', 'beta', 'alpha', 'installed'].map(f => (
              <button
                key={f}
                className={`tab ${filter === f ? 'tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="version-list">
            {filteredVersions.map(v => (
              <div
                key={v.id}
                className={`version-item ${selected === v.id ? 'version-item--selected' : ''} ${installed.includes(v.id) ? 'version-item--installed' : ''}`}
                onClick={() => setSelected(v.id)}
              >
                <div className="version-item__name">{v.id}</div>
                <div className="version-item__meta">
                  <span className={`badge badge--${badgeType(v.type)}`}>
                    {v.type === 'old_beta' ? 'beta' : v.type === 'old_alpha' ? 'alpha' : v.type}
                  </span>
                  {installed.includes(v.id) && (
                    <span className="badge badge--installed">installed</span>
                  )}
                </div>
              </div>
            ))}
            {filteredVersions.length === 0 && (
              <div className="empty-state">
                <div className="empty-state__title">No versions found</div>
                <div className="empty-state__text">Try adjusting your search or filters</div>
              </div>
            )}
          </div>
        </div>

        {/* Action panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>
              SELECTED VERSION
            </h3>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple-light)', marginBottom: 4 }}>
              {selected || 'None'}
            </div>
            {selected && (
              <span className={`badge badge--${badgeType(versions.find(v => v.id === selected)?.type || 'release')}`}>
                {versions.find(v => v.id === selected)?.type === 'old_beta' ? 'beta' :
                 versions.find(v => v.id === selected)?.type === 'old_alpha' ? 'alpha' :
                 versions.find(v => v.id === selected)?.type || ''}
              </span>
            )}

            {installing && installProgress && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {installProgress.status}
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${installProgress.progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!isInstalled && (
              <button
                className="btn btn--secondary"
                onClick={handleInstall}
                disabled={!selected || !!installing}
              >
                <FiDownload />
                {installing === selected ? 'Installing...' : 'Install Version'}
              </button>
            )}

            {gameRunning ? (
              <button className="btn btn--danger btn--lg" onClick={handleKill}>
                KILL GAME
              </button>
            ) : (
              <button
                className="btn btn--launch"
                onClick={handleLaunch}
                disabled={!selected || !isInstalled || !account || launching}
              >
                <FiPlay />
                {launching ? 'LAUNCHING...' : 'PLAY'}
              </button>
            )}

            {!account && (
              <div style={{ fontSize: 12, color: 'var(--warning)', textAlign: 'center' }}>
                Add an account first to play
              </div>
            )}
          </div>

          {logs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Game Console
              </h4>
              <div className="console">
                {logs.join('')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
