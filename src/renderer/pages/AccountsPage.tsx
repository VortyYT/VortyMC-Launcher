import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiUser, FiCheck, FiLogIn, FiCopy, FiExternalLink } from 'react-icons/fi';
import type { Account } from '../App';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface Props {
  accounts: Account[];
  activeAccount: Account | null;
  onRefresh: () => void;
  onSetActive: (account: Account) => void;
}

interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  message: string;
}

export default function AccountsPage({ accounts, activeAccount, onRefresh, onSetActive }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [msMessage, setMsMessage] = useState('');
  const [msLoading, setMsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ipcRenderer) return;
    const onDeviceCode = (_e: unknown, data: DeviceCodeInfo) => {
      setDeviceCode(data);
    };
    ipcRenderer.on('ms:deviceCode', onDeviceCode);
    return () => {
      ipcRenderer.removeListener('ms:deviceCode', onDeviceCode);
    };
  }, []);

  const addOffline = async () => {
    if (!username.trim()) return;
    if (ipcRenderer) {
      const acc = await ipcRenderer.invoke('accounts:addOffline', username.trim());
      onRefresh();
      if (!activeAccount) {
        onSetActive(acc);
      }
    }
    setUsername('');
    setShowModal(false);
  };

  const removeAccount = async (id: string) => {
    if (ipcRenderer) {
      await ipcRenderer.invoke('accounts:remove', id);
      onRefresh();
    }
  };

  const loginMicrosoft = async () => {
    if (!ipcRenderer) {
      setMsMessage('Microsoft login is only available in the desktop app.');
      return;
    }
    setMsLoading(true);
    setMsMessage('');
    setDeviceCode(null);
    const result = await ipcRenderer.invoke('accounts:microsoftLogin');
    setMsLoading(false);
    setDeviceCode(null);
    if (!result.success) {
      setMsMessage(result.message);
    } else {
      setMsMessage('');
      onRefresh();
      if (result.account) {
        onSetActive(result.account);
      }
    }
  };

  const copyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-header__title">ACCOUNTS</h1>
        <p className="page-header__subtitle">Manage your Minecraft accounts</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <FiPlus />
          Add Offline Account
        </button>
        <button className="btn btn--secondary" onClick={loginMicrosoft} disabled={msLoading}>
          <FiLogIn />
          {msLoading ? 'Authenticating...' : 'Microsoft Login'}
        </button>
      </div>

      {/* Microsoft Device Code Flow UI */}
      {deviceCode && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--purple-main)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, marginBottom: 12, letterSpacing: 1, color: 'var(--purple-light)' }}>
            MICROSOFT LOGIN
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            A browser window has been opened. Enter this code to sign in:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 6,
              color: 'var(--purple-light)',
              padding: '12px 24px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--purple-main)',
              boxShadow: 'var(--shadow-neon)',
            }}>
              {deviceCode.userCode}
            </div>
            <button className="btn btn--secondary btn--sm" onClick={copyCode}>
              <FiCopy />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Go to{' '}
            <span
              style={{ color: 'var(--neon-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => ipcRenderer?.invoke('shell:openExternal', deviceCode.verificationUri)}
            >
              {deviceCode.verificationUri} <FiExternalLink style={{ verticalAlign: 'middle', fontSize: 11 }} />
            </span>
            {' '}and enter the code above.
          </p>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="ms-spinner" />
            Waiting for you to sign in...
          </div>
        </div>
      )}

      {msMessage && !deviceCode && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)' }}>
          <div style={{ fontSize: 13, color: 'var(--warning)' }}>{msMessage}</div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><FiUser /></div>
          <div className="empty-state__title">No Accounts</div>
          <div className="empty-state__text">
            Add an offline account to play locally, or sign in with your Microsoft account for skins and online play.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(acc => {
            const isActive = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                className={`card ${isActive ? 'card--selected' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSetActive(acc)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="sidebar__avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                    {acc.skinUrl ? (
                      <img src={acc.skinUrl} alt={acc.username} />
                    ) : (
                      acc.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
                      {acc.username}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${acc.type === 'microsoft' ? 'badge--release' : 'badge--beta'}`}>
                        {acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiCheck /> Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      UUID: {acc.uuid}
                    </div>
                  </div>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={e => { e.stopPropagation(); removeAccount(acc.id); }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal__title">ADD OFFLINE ACCOUNT</h2>
            <div className="input-group">
              <label className="input-group__label">Username</label>
              <input
                className="input"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOffline()}
                autoFocus
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Offline accounts let you play singleplayer and LAN without a Microsoft account.
            </div>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={addOffline} disabled={!username.trim()}>
                <FiPlus /> Add Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
