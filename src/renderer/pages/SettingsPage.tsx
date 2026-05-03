import React, { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import type { Settings } from '../App';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface Props {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export default function SettingsPage({ settings, onSave }: Props) {
  const [local, setLocal] = useState<Settings>({ ...settings });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof Settings, value: unknown) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (ipcRenderer) {
      await ipcRenderer.invoke('settings:save', local);
    }
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">SETTINGS</h1>
        <p className="page-header__subtitle">Configure launcher preferences</p>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Memory */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, marginBottom: 16, letterSpacing: 1 }}>
            JAVA & PERFORMANCE
          </h3>
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-group__label">Java Path</label>
            <input
              className="input"
              value={local.javaPath}
              onChange={e => update('javaPath', e.target.value)}
              placeholder="java"
            />
          </div>
          <div className="input-group">
            <label className="input-group__label">Memory Allocation (MB)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input
                type="range"
                min={512}
                max={16384}
                step={256}
                value={local.memory}
                onChange={e => update('memory', parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--purple-main)' }}
              />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--purple-light)', minWidth: 80, textAlign: 'right' }}>
                {local.memory} MB
              </span>
            </div>
          </div>
        </div>

        {/* Version Filters */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, marginBottom: 16, letterSpacing: 1 }}>
            VERSION FILTERS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={local.showSnapshots}
                onChange={e => update('showSnapshots', e.target.checked)}
              />
              Show Snapshots
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={local.showBeta}
                onChange={e => update('showBeta', e.target.checked)}
              />
              Show Beta Versions
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={local.showAlpha}
                onChange={e => update('showAlpha', e.target.checked)}
              />
              Show Alpha Versions
            </label>
          </div>
        </div>

        {/* Launch Behavior */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, marginBottom: 16, letterSpacing: 1 }}>
            LAUNCH BEHAVIOR
          </h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={local.closeOnLaunch}
              onChange={e => update('closeOnLaunch', e.target.checked)}
            />
            Close launcher when game starts
          </label>
        </div>

        <button className="btn btn--primary btn--lg" onClick={handleSave}>
          <FiSave />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
