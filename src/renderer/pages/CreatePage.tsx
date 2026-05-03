import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiPlay, FiPackage, FiDownload } from 'react-icons/fi';
import type { Account, Settings } from '../App';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface CustomBuild {
  id: string;
  name: string;
  baseVersion: string;
  jvmArgs: string;
  gameArgs: string;
  createdAt: string;
}

interface VersionEntry {
  id: string;
  type: string;
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

export default function CreatePage({ account, settings }: Props) {
  const [builds, setBuilds] = useState<CustomBuild[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [baseVersion, setBaseVersion] = useState('');
  const [jvmArgs, setJvmArgs] = useState('-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions');
  const [gameArgs, setGameArgs] = useState('');
  const [launchingBuild, setLaunchingBuild] = useState<string | null>(null);
  const [installingBuild, setInstallingBuild] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [gameRunning, setGameRunning] = useState(false);

  const loadBuilds = useCallback(async () => {
    if (!ipcRenderer) return;
    const b = await ipcRenderer.invoke('builds:list');
    setBuilds(b);
  }, []);

  const loadVersions = useCallback(async () => {
    if (!ipcRenderer) {
      setVersions([
        { id: '1.21', type: 'release', url: '' },
        { id: '1.20.6', type: 'release', url: '' },
        { id: '1.20.4', type: 'release', url: '' },
        { id: '1.20.1', type: 'release', url: '' },
        { id: '1.19.4', type: 'release', url: '' },
        { id: '1.18.2', type: 'release', url: '' },
        { id: '1.16.5', type: 'release', url: '' },
        { id: '1.12.2', type: 'release', url: '' },
        { id: '1.8.9', type: 'release', url: '' },
        { id: '1.7.10', type: 'release', url: '' },
        { id: 'b1.7.3', type: 'old_beta', url: '' },
      ]);
      return;
    }
    const v = await ipcRenderer.invoke('versions:list');
    const inst = await ipcRenderer.invoke('versions:installed');
    setVersions(v);
    setInstalled(inst);
    if (v.length > 0 && !baseVersion) {
      const firstRelease = v.find((ver: VersionEntry) => ver.type === 'release');
      setBaseVersion(firstRelease?.id || v[0].id);
    }
  }, [baseVersion]);

  useEffect(() => {
    loadBuilds();
    loadVersions();
  }, [loadBuilds, loadVersions]);

  useEffect(() => {
    if (!ipcRenderer) return;
    const onProgress = (_e: unknown, data: InstallProgress) => setInstallProgress(data);
    const onExit = () => {
      setGameRunning(false);
      setLaunchingBuild(null);
    };
    ipcRenderer.on('install:progress', onProgress);
    ipcRenderer.on('game:exit', onExit);
    return () => {
      ipcRenderer.removeListener('install:progress', onProgress);
      ipcRenderer.removeListener('game:exit', onExit);
    };
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !baseVersion) return;
    if (ipcRenderer) {
      await ipcRenderer.invoke('builds:create', {
        name: name.trim(),
        baseVersion,
        jvmArgs,
        gameArgs,
      });
      await loadBuilds();
    } else {
      setBuilds(prev => [...prev, {
        id: Date.now().toString(),
        name: name.trim(),
        baseVersion,
        jvmArgs,
        gameArgs,
        createdAt: new Date().toISOString(),
      }]);
    }
    setName('');
    setJvmArgs('-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions');
    setGameArgs('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (ipcRenderer) {
      await ipcRenderer.invoke('builds:delete', id);
      await loadBuilds();
    } else {
      setBuilds(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleLaunchBuild = async (build: CustomBuild) => {
    if (!ipcRenderer || !account) return;

    const isInst = installed.includes(build.baseVersion);
    if (!isInst) {
      setInstallingBuild(build.id);
      const version = versions.find(v => v.id === build.baseVersion);
      if (version) {
        try {
          await ipcRenderer.invoke('versions:install', build.baseVersion, version.url);
          const inst = await ipcRenderer.invoke('versions:installed');
          setInstalled(inst);
        } catch (err) {
          console.error('Install failed:', err);
          setInstallingBuild(null);
          setInstallProgress(null);
          return;
        }
      }
      setInstallingBuild(null);
      setInstallProgress(null);
    }

    setLaunchingBuild(build.id);
    try {
      const result = await ipcRenderer.invoke('game:launch', {
        versionId: build.baseVersion,
        account,
        jvmArgs: build.jvmArgs,
        gameArgs: build.gameArgs,
        memory: settings.memory,
      });
      if (result.success) {
        setGameRunning(true);
      }
    } catch (err) {
      console.error('Launch failed:', err);
    }
    setLaunchingBuild(null);
  };

  const isBuildInstalled = (build: CustomBuild) => installed.includes(build.baseVersion);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">CREATE</h1>
        <p className="page-header__subtitle">Build custom Minecraft configurations and launch profiles</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          <FiPlus />
          New Build
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 20, letterSpacing: 1 }}>
            CREATE NEW BUILD
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label className="input-group__label">Build Name</label>
              <input
                className="input"
                placeholder="My Custom Build"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-group__label">Base Version</label>
              <select
                className="select"
                value={baseVersion}
                onChange={e => setBaseVersion(e.target.value)}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.id} ({v.type === 'old_beta' ? 'beta' : v.type === 'old_alpha' ? 'alpha' : v.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-group__label">JVM Arguments</label>
              <input
                className="input"
                placeholder="-XX:+UseG1GC"
                value={jvmArgs}
                onChange={e => setJvmArgs(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-group__label">Game Arguments (optional)</label>
              <input
                className="input"
                placeholder="--server mc.example.com --port 25565"
                value={gameArgs}
                onChange={e => setGameArgs(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={!name.trim()}>
              <FiPackage />
              Create Build
            </button>
            <button className="btn btn--ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {builds.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state__icon"><FiPackage /></div>
          <div className="empty-state__title">No Custom Builds</div>
          <div className="empty-state__text">
            Create your first custom Minecraft build with specific JVM arguments, game arguments, and version settings.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {builds.map(build => {
            const isLaunching = launchingBuild === build.id;
            const isInstalling = installingBuild === build.id;
            const buildInstalled = isBuildInstalled(build);
            return (
              <div key={build.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{build.name}</h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge--release">{build.baseVersion}</span>
                      {buildInstalled && <span className="badge badge--installed">installed</span>}
                    </div>
                  </div>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(build.id)}>
                    <FiTrash2 />
                  </button>
                </div>
                {build.jvmArgs && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <strong>JVM:</strong> {build.jvmArgs}
                  </div>
                )}
                {build.gameArgs && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <strong>Game:</strong> {build.gameArgs}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8 }}>
                  Created {new Date(build.createdAt).toLocaleDateString()}
                </div>

                {isInstalling && installProgress && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {installProgress.status}
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${installProgress.progress}%` }} />
                    </div>
                  </div>
                )}

                <button
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => handleLaunchBuild(build)}
                  disabled={!account || isLaunching || isInstalling || gameRunning}
                >
                  {isInstalling ? (
                    <><FiDownload /> Installing...</>
                  ) : isLaunching ? (
                    <><FiPlay /> Launching...</>
                  ) : !buildInstalled ? (
                    <><FiDownload /> Install & Launch</>
                  ) : (
                    <><FiPlay /> Launch</>
                  )}
                </button>
                {!account && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', textAlign: 'center', marginTop: 6 }}>
                    Add an account first
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
