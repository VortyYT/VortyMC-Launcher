import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import PlayPage from './pages/PlayPage';
import CreatePage from './pages/CreatePage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

export interface Account {
  id: string;
  username: string;
  type: 'offline' | 'microsoft';
  uuid: string;
  accessToken?: string;
  skinUrl?: string;
}

export interface Settings {
  memory: number;
  javaPath: string;
  showSnapshots: boolean;
  showBeta: boolean;
  showAlpha: boolean;
  closeOnLaunch: boolean;
}

type Page = 'home' | 'play' | 'create' | 'accounts' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<Settings>({
    memory: 2048,
    javaPath: 'java',
    showSnapshots: false,
    showBeta: true,
    showAlpha: false,
    closeOnLaunch: false,
  });

  const loadAccounts = useCallback(async () => {
    if (!ipcRenderer) return;
    const accs = await ipcRenderer.invoke('accounts:list');
    setAccounts(accs);
    if (accs.length > 0 && !activeAccount) {
      setActiveAccount(accs[0]);
    }
  }, [activeAccount]);

  const loadSettings = useCallback(async () => {
    if (!ipcRenderer) return;
    const s = await ipcRenderer.invoke('settings:get');
    setSettings(s);
  }, []);

  useEffect(() => {
    loadAccounts();
    loadSettings();
  }, [loadAccounts, loadSettings]);

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage onNavigate={setPage} accountCount={accounts.length} />;
      case 'play':
        return <PlayPage account={activeAccount} settings={settings} />;
      case 'create':
        return <CreatePage />;
      case 'accounts':
        return (
          <AccountsPage
            accounts={accounts}
            activeAccount={activeAccount}
            onRefresh={loadAccounts}
            onSetActive={setActiveAccount}
          />
        );
      case 'settings':
        return <SettingsPage settings={settings} onSave={setSettings} />;
      default:
        return <HomePage onNavigate={setPage} accountCount={accounts.length} />;
    }
  };

  return (
    <>
      <TitleBar />
      <div className="app-layout">
        <Sidebar page={page} onNavigate={setPage} activeAccount={activeAccount} />
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </>
  );
}
