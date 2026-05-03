import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiPlay, FiPackage } from 'react-icons/fi';

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
}

export default function CreatePage() {
  const [builds, setBuilds] = useState<CustomBuild[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [baseVersion, setBaseVersion] = useState('');
  const [jvmArgs, setJvmArgs] = useState('-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions');
  const [gameArgs, setGameArgs] = useState('');

  const loadBuilds = useCallback(async () => {
    if (!ipcRenderer) return;
    const b = await ipcRenderer.invoke('builds:list');
    setBuilds(b);
  }, []);

  const loadVersions = useCallback(async () => {
    if (!ipcRenderer) {
      setVersions([
        { id: '1.21', type: 'release' },
        { id: '1.20.6', type: 'release' },
        { id: '1.20.4', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '1.19.4', type: 'release' },
        { id: '1.18.2', type: 'release' },
        { id: '1.16.5', type: 'release' },
        { id: '1.12.2', type: 'release' },
        { id: '1.8.9', type: 'release' },
        { id: '1.7.10', type: 'release' },
        { id: 'b1.7.3', type: 'old_beta' },
      ]);
      return;
    }
    const v = await ipcRenderer.invoke('versions:list');
    setVersions(v);
    if (v.length > 0 && !baseVersion) {
      const firstRelease = v.find((ver: VersionEntry) => ver.type === 'release');
      setBaseVersion(firstRelease?.id || v[0].id);
    }
  }, [baseVersion]);

  useEffect(() => {
    loadBuilds();
    loadVersions();
  }, [loadBuilds, loadVersions]);

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
          {builds.map(build => (
            <div key={build.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{build.name}</h3>
                  <span className="badge badge--release">{build.baseVersion}</span>
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
              <button className="btn btn--primary btn--sm" style={{ marginTop: 12, width: '100%' }}>
                <FiPlay /> Launch
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
