import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiSearch, FiFolder, FiCheck, FiRefreshCw } from 'react-icons/fi';

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

const MOCK_VERSIONS: VersionEntry[] = [
  { id: '1.21.5', type: 'release', releaseTime: '2025-03-25', url: '' },
  { id: '1.21.4', type: 'release', releaseTime: '2024-12-03', url: '' },
  { id: '1.21.3', type: 'release', releaseTime: '2024-10-23', url: '' },
  { id: '1.21.2', type: 'release', releaseTime: '2024-09-18', url: '' },
  { id: '1.21.1', type: 'release', releaseTime: '2024-08-08', url: '' },
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
  { id: 'b1.8.1', type: 'old_beta', releaseTime: '2011-09-14', url: '' },
  { id: 'b1.7.3', type: 'old_beta', releaseTime: '2011-07-08', url: '' },
  { id: 'a1.2.6', type: 'old_alpha', releaseTime: '2010-12-03', url: '' },
  { id: 'a1.0.15', type: 'old_alpha', releaseTime: '2010-08-04', url: '' },
];

export default function BuildsPage() {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    if (!ipcRenderer) {
      setVersions(MOCK_VERSIONS);
      setInstalled(['1.21', '1.20.4']);
      setLoading(false);
      return;
    }
    try {
      const v = await ipcRenderer.invoke('versions:list');
      const inst = await ipcRenderer.invoke('versions:installed');
      setVersions(v);
      setInstalled(inst);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    if (!ipcRenderer) return;
    const onProgress = (_e: unknown, data: InstallProgress) => setInstallProgress(data);
    ipcRenderer.on('install:progress', onProgress);
    return () => {
      ipcRenderer.removeListener('install:progress', onProgress);
    };
  }, []);

  const filteredVersions = versions.filter(v => {
    if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'release' && v.type !== 'release') return false;
    if (filter === 'snapshot' && v.type !== 'snapshot') return false;
    if (filter === 'beta' && v.type !== 'old_beta') return false;
    if (filter === 'alpha' && v.type !== 'old_alpha') return false;
    if (filter === 'installed' && !installed.includes(v.id)) return false;
    return true;
  });

  const handleInstall = async (versionId: string, url: string) => {
    if (!ipcRenderer) return;
    setInstalling(versionId);
    try {
      await ipcRenderer.invoke('versions:install', versionId, url);
      const inst = await ipcRenderer.invoke('versions:installed');
      setInstalled(inst);
    } catch (err) {
      console.error('Install failed:', err);
    }
    setInstalling(null);
    setInstallProgress(null);
  };

  const handleOpenFolder = async (versionId: string) => {
    if (!ipcRenderer) return;
    await ipcRenderer.invoke('versions:openFolder', versionId);
  };

  const badgeClass = (type: string) => {
    switch (type) {
      case 'release': return 'badge--release';
      case 'snapshot': return 'badge--snapshot';
      case 'old_beta': return 'badge--beta';
      case 'old_alpha': return 'badge--alpha';
      default: return 'badge--release';
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'old_beta': return 'beta';
      case 'old_alpha': return 'alpha';
      default: return type;
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">BUILDS</h1>
        <p className="page-header__subtitle">
          Download and manage all Minecraft versions &mdash; from Alpha to the latest release
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <FiSearch className="search-bar__icon" />
          <input
            className="search-bar__input"
            placeholder="Search versions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn--secondary btn--sm" onClick={loadVersions}>
          <FiRefreshCw /> Refresh
        </button>
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filteredVersions.length} versions
        </span>
      </div>

      {installing && installProgress && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Installing {installing}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {installProgress.progress}%
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {installProgress.status}
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${installProgress.progress}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="empty-state__icon"><FiRefreshCw /></div>
          <div className="empty-state__title">Loading versions...</div>
        </div>
      ) : (
        <div className="builds-grid">
          {filteredVersions.map(v => {
            const isInstalled = installed.includes(v.id);
            const isInstalling = installing === v.id;
            return (
              <div key={v.id} className={`builds-card ${isInstalled ? 'builds-card--installed' : ''}`}>
                <div className="builds-card__header">
                  <div className="builds-card__version">{v.id}</div>
                  <span className={`badge ${badgeClass(v.type)}`}>
                    {typeLabel(v.type)}
                  </span>
                </div>
                <div className="builds-card__date">
                  {new Date(v.releaseTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div className="builds-card__actions">
                  {isInstalled ? (
                    <>
                      <span className="builds-card__status">
                        <FiCheck /> Installed
                      </span>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleOpenFolder(v.id)}
                        title="Open version folder"
                      >
                        <FiFolder />
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => handleInstall(v.id, v.url)}
                      disabled={!!installing}
                    >
                      <FiDownload />
                      {isInstalling ? 'Installing...' : 'Download'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredVersions.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state__title">No versions found</div>
              <div className="empty-state__text">Try adjusting your search or filter</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
