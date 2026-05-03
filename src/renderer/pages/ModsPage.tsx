import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiDownload, FiCheck, FiPackage, FiExternalLink, FiRefreshCw } from 'react-icons/fi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  downloads: number;
  icon_url: string;
  project_type: string;
  versions: string[];
  author: string;
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: { url: string; filename: string; size: number }[];
}

interface InstalledMod {
  slug: string;
  filename: string;
  versionId: string;
}

const MOCK_MODS: ModrinthProject[] = [
  { slug: 'sodium', title: 'Sodium', description: 'A modern rendering engine for Minecraft which greatly improves performance', categories: ['optimization'], downloads: 45000000, icon_url: '', project_type: 'mod', versions: ['1.21', '1.20.4'], author: 'CaffeineMC' },
  { slug: 'lithium', title: 'Lithium', description: 'No-compromises game logic/server optimization mod', categories: ['optimization'], downloads: 22000000, icon_url: '', project_type: 'mod', versions: ['1.21', '1.20.4'], author: 'CaffeineMC' },
  { slug: 'iris', title: 'Iris Shaders', description: 'A modern shaders mod for Minecraft intended to be compatible with existing OptiFine shader packs', categories: ['decoration'], downloads: 18000000, icon_url: '', project_type: 'mod', versions: ['1.21', '1.20.4'], author: 'IrisShaders' },
  { slug: 'fabric-api', title: 'Fabric API', description: 'Lightweight and modular API providing common hooks and intercompatibility measures', categories: ['library'], downloads: 65000000, icon_url: '', project_type: 'mod', versions: ['1.21', '1.20.4'], author: 'FabricMC' },
  { slug: 'create', title: 'Create', description: 'Building Tools and Aesthetic Technology', categories: ['technology'], downloads: 15000000, icon_url: '', project_type: 'mod', versions: ['1.20.1', '1.19.2'], author: 'simibubi' },
  { slug: 'jei', title: 'Just Enough Items (JEI)', description: 'JEI - View Items and Recipes', categories: ['utility'], downloads: 35000000, icon_url: '', project_type: 'mod', versions: ['1.21', '1.20.4'], author: 'mezz' },
];

export default function ModsPage() {
  const [query, setQuery] = useState('');
  const [mods, setMods] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('1.21');
  const [versions, setVersions] = useState<string[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [selectedMod, setSelectedMod] = useState<ModrinthProject | null>(null);
  const [modVersions, setModVersions] = useState<ModrinthVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadInstalledVersions = useCallback(async () => {
    if (!ipcRenderer) {
      setVersions(['1.21', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5']);
      return;
    }
    const inst = await ipcRenderer.invoke('versions:installed');
    setVersions(inst);
    if (inst.length > 0 && !inst.includes(selectedVersion)) {
      setSelectedVersion(inst[0]);
    }
  }, [selectedVersion]);

  const loadInstalledMods = useCallback(async () => {
    if (!ipcRenderer) return;
    const mods = await ipcRenderer.invoke('mods:installed', selectedVersion);
    setInstalledMods(mods);
  }, [selectedVersion]);

  useEffect(() => {
    loadInstalledVersions();
  }, [loadInstalledVersions]);

  useEffect(() => {
    loadInstalledMods();
  }, [loadInstalledMods]);

  const searchMods = async () => {
    setHasSearched(true);
    setLoading(true);
    setSelectedMod(null);
    if (!ipcRenderer) {
      const filtered = query
        ? MOCK_MODS.filter(m => m.title.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase()))
        : MOCK_MODS;
      setMods(filtered);
      setLoading(false);
      return;
    }
    try {
      const results = await ipcRenderer.invoke('mods:search', query, selectedVersion);
      setMods(results);
    } catch (err) {
      console.error('Mod search failed:', err);
    }
    setLoading(false);
  };

  const loadModVersions = async (mod: ModrinthProject) => {
    setSelectedMod(mod);
    setLoadingVersions(true);
    if (!ipcRenderer) {
      setModVersions([{
        id: 'mock-1',
        name: `${mod.title} for 1.21`,
        version_number: '1.0.0',
        game_versions: ['1.21'],
        loaders: ['fabric'],
        files: [{ url: '', filename: `${mod.slug}-1.0.0.jar`, size: 1024000 }],
      }]);
      setLoadingVersions(false);
      return;
    }
    try {
      const vers = await ipcRenderer.invoke('mods:versions', mod.slug, selectedVersion);
      setModVersions(vers);
    } catch (err) {
      console.error('Failed to load mod versions:', err);
    }
    setLoadingVersions(false);
  };

  const installMod = async (mod: ModrinthProject, modVersion: ModrinthVersion) => {
    setInstallingSlug(mod.slug);
    if (!ipcRenderer) {
      setInstalledMods(prev => [...prev, {
        slug: mod.slug,
        filename: modVersion.files[0]?.filename || `${mod.slug}.jar`,
        versionId: selectedVersion,
      }]);
      setInstallingSlug(null);
      return;
    }
    try {
      await ipcRenderer.invoke('mods:install', {
        slug: mod.slug,
        versionId: selectedVersion,
        fileUrl: modVersion.files[0]?.url,
        filename: modVersion.files[0]?.filename,
      });
      await loadInstalledMods();
    } catch (err) {
      console.error('Mod install failed:', err);
    }
    setInstallingSlug(null);
  };

  const isModInstalled = (slug: string) => {
    return installedMods.some(m => m.slug === slug && m.versionId === selectedVersion);
  };

  const formatDownloads = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">MODS</h1>
        <p className="page-header__subtitle">
          Browse and install mods from Modrinth &mdash; automatically added to your selected version
        </p>
      </div>

      <div className="mods-controls">
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <FiSearch className="search-bar__icon" />
          <input
            className="search-bar__input"
            placeholder="Search mods on Modrinth..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchMods()}
          />
        </div>
        <div className="input-group" style={{ width: 160 }}>
          <select
            className="select"
            value={selectedVersion}
            onChange={e => setSelectedVersion(e.target.value)}
          >
            {versions.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <button className="btn btn--primary" onClick={searchMods}>
          <FiSearch /> Search
        </button>
      </div>

      <div className="mods-layout">
        <div className="mods-list">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state__icon"><FiRefreshCw /></div>
              <div className="empty-state__title">Searching...</div>
            </div>
          ) : mods.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><FiPackage /></div>
              <div className="empty-state__title">
                {hasSearched ? 'No mods found' : 'Search for mods'}
              </div>
              <div className="empty-state__text">
                {hasSearched
                  ? 'Try a different search query or version'
                  : 'Search the Modrinth database to find and install mods for your Minecraft version'
                }
              </div>
            </div>
          ) : (
            mods.map(mod => (
              <div
                key={mod.slug}
                className={`mods-item ${selectedMod?.slug === mod.slug ? 'mods-item--selected' : ''} ${isModInstalled(mod.slug) ? 'mods-item--installed' : ''}`}
                onClick={() => loadModVersions(mod)}
              >
                <div className="mods-item__icon">
                  {mod.icon_url ? (
                    <img src={mod.icon_url} alt={mod.title} />
                  ) : (
                    <FiPackage />
                  )}
                </div>
                <div className="mods-item__info">
                  <div className="mods-item__title">
                    {mod.title}
                    {isModInstalled(mod.slug) && (
                      <span className="mods-item__installed-badge"><FiCheck /> Installed</span>
                    )}
                  </div>
                  <div className="mods-item__author">by {mod.author}</div>
                  <div className="mods-item__desc">{mod.description}</div>
                  <div className="mods-item__meta">
                    <span><FiDownload /> {formatDownloads(mod.downloads)}</span>
                    {mod.categories.slice(0, 3).map(c => (
                      <span key={c} className="badge badge--beta" style={{ fontSize: 9 }}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedMod && (
          <div className="mods-detail">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="mods-item__icon" style={{ width: 48, height: 48, fontSize: 24 }}>
                  {selectedMod.icon_url ? (
                    <img src={selectedMod.icon_url} alt={selectedMod.title} />
                  ) : (
                    <FiPackage />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{selectedMod.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {selectedMod.author}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                {selectedMod.description}
              </p>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  const url = `https://modrinth.com/mod/${selectedMod.slug}`;
                  if (ipcRenderer) ipcRenderer.invoke('shell:openExternal', url);
                  else window.open(url, '_blank');
                }}
              >
                <FiExternalLink /> View on Modrinth
              </button>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 12, marginBottom: 12, letterSpacing: 1 }}>
                AVAILABLE VERSIONS FOR {selectedVersion}
              </h4>
              {loadingVersions ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading versions...</div>
              ) : modVersions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No compatible versions found for {selectedVersion}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {modVersions.slice(0, 5).map(mv => (
                    <div key={mv.id} className="mods-version-item">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{mv.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, marginTop: 2 }}>
                          <span>{mv.version_number}</span>
                          {mv.loaders.map(l => (
                            <span key={l} className="badge badge--beta" style={{ fontSize: 9 }}>{l}</span>
                          ))}
                          {mv.files[0] && (
                            <span>{(mv.files[0].size / 1024).toFixed(0)} KB</span>
                          )}
                        </div>
                      </div>
                      {isModInstalled(selectedMod.slug) ? (
                        <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiCheck /> Added
                        </span>
                      ) : (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={(e) => { e.stopPropagation(); installMod(selectedMod, mv); }}
                          disabled={installingSlug === selectedMod.slug}
                        >
                          <FiDownload />
                          {installingSlug === selectedMod.slug ? 'Adding...' : 'Add'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
