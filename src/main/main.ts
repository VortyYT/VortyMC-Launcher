import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  username: string;
  type: 'offline' | 'microsoft';
  uuid: string;
  accessToken?: string;
  refreshToken?: string;
  skinUrl?: string;
}

interface VersionManifestEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionManifestEntry[];
}

interface CustomBuild {
  id: string;
  name: string;
  baseVersion: string;
  jvmArgs: string;
  gameArgs: string;
  createdAt: string;
}

// ── Globals ────────────────────────────────────────────────────────────────────
const LAUNCHER_DIR = path.join(app.getPath('userData'), 'VortyMC');
const VERSIONS_DIR = path.join(LAUNCHER_DIR, 'versions');
const LIBRARIES_DIR = path.join(LAUNCHER_DIR, 'libraries');
const ASSETS_DIR = path.join(LAUNCHER_DIR, 'assets');
const GAME_DIR = path.join(LAUNCHER_DIR, 'game');
const ACCOUNTS_FILE = path.join(LAUNCHER_DIR, 'accounts.json');
const BUILDS_FILE = path.join(LAUNCHER_DIR, 'builds.json');
const SETTINGS_FILE = path.join(LAUNCHER_DIR, 'settings.json');

let mainWindow: BrowserWindow | null = null;
let gameProcess: ChildProcess | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────
function ensureDirs(): void {
  for (const dir of [LAUNCHER_DIR, VERSIONS_DIR, LIBRARIES_DIR, ASSETS_DIR, GAME_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const loc = response.headers.location;
        if (loc) {
          file.close();
          fs.unlinkSync(dest);
          download(loc, dest).then(resolve).catch(reject);
          return;
        }
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function fetchJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) {
          fetchJSON(loc).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function offlineUUID(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '3' + hash.slice(13, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ── Window ─────────────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
  });

  const isDev = !app.isPackaged;
  if (isDev && fs.existsSync(path.join(__dirname, '..', 'renderer', 'index.html'))) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
});

app.on('window-all-closed', () => { app.quit(); });

// ── IPC: Window Controls ───────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// ── IPC: Accounts ──────────────────────────────────────────────────────────────
ipcMain.handle('accounts:list', () => {
  return readJSON<Account[]>(ACCOUNTS_FILE, []);
});

ipcMain.handle('accounts:addOffline', (_e, username: string) => {
  const accounts = readJSON<Account[]>(ACCOUNTS_FILE, []);
  const account: Account = {
    id: Date.now().toString(),
    username,
    type: 'offline',
    uuid: offlineUUID(username),
  };
  accounts.push(account);
  writeJSON(ACCOUNTS_FILE, accounts);
  return account;
});

ipcMain.handle('accounts:remove', (_e, id: string) => {
  let accounts = readJSON<Account[]>(ACCOUNTS_FILE, []);
  accounts = accounts.filter(a => a.id !== id);
  writeJSON(ACCOUNTS_FILE, accounts);
  return accounts;
});

ipcMain.handle('accounts:microsoftLogin', async () => {
  // Microsoft OAuth flow using device code or auth code
  // We'll use the auth code flow with a local redirect
  const CLIENT_ID = 'd6a8e9a6-7e3a-4e5c-b2f0-1a2b3c4d5e6f'; // placeholder; users can set their own Azure app
  const REDIRECT_URI = 'http://localhost:8921/auth/callback';

  // For now we return a placeholder - full MS auth requires an Azure App registration
  // The user would need to register an app at https://portal.azure.com
  return {
    success: false,
    message: 'Microsoft login requires an Azure App ID. Please set one in Settings, or use an offline account.',
  };
});

// ── IPC: Version Management ────────────────────────────────────────────────────
let cachedManifest: VersionManifest | null = null;

ipcMain.handle('versions:list', async () => {
  try {
    if (!cachedManifest) {
      cachedManifest = await fetchJSON(
        'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
      ) as VersionManifest;
    }
    // Filter versions from b1.7.3 onwards (include old_beta, old_alpha, release, snapshot)
    return cachedManifest.versions.map(v => ({
      id: v.id,
      type: v.type,
      releaseTime: v.releaseTime,
      url: v.url,
    }));
  } catch (err) {
    console.error('Failed to fetch version manifest:', err);
    return [];
  }
});

ipcMain.handle('versions:installed', () => {
  try {
    const dirs = fs.readdirSync(VERSIONS_DIR);
    return dirs.filter(d => {
      const jsonPath = path.join(VERSIONS_DIR, d, `${d}.json`);
      return fs.existsSync(jsonPath);
    });
  } catch {
    return [];
  }
});

ipcMain.handle('versions:install', async (_e, versionId: string, versionUrl: string) => {
  const versionDir = path.join(VERSIONS_DIR, versionId);
  fs.mkdirSync(versionDir, { recursive: true });

  const versionJsonPath = path.join(versionDir, `${versionId}.json`);

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading version metadata...', progress: 5 });

  // Download version JSON
  const versionData = await fetchJSON(versionUrl) as Record<string, unknown>;
  writeJSON(versionJsonPath, versionData);

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading client jar...', progress: 15 });

  // Download client jar
  const downloads = versionData.downloads as Record<string, { url: string; sha1: string; size: number }>;
  if (downloads?.client) {
    const clientJarPath = path.join(versionDir, `${versionId}.jar`);
    if (!fs.existsSync(clientJarPath)) {
      await download(downloads.client.url, clientJarPath);
    }
  }

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading libraries...', progress: 30 });

  // Download libraries
  const libraries = versionData.libraries as Array<{
    name: string;
    downloads?: {
      artifact?: { url: string; path: string; sha1: string; size: number };
      classifiers?: Record<string, { url: string; path: string }>;
    };
    rules?: Array<{ action: string; os?: { name: string } }>;
  }>;

  if (libraries) {
    let libsDone = 0;
    for (const lib of libraries) {
      // Check rules
      if (lib.rules) {
        const dominated = lib.rules.some(r => {
          if (r.action === 'allow' && r.os && r.os.name !== 'linux') return true;
          if (r.action === 'disallow' && r.os && r.os.name === 'linux') return true;
          return false;
        });
        if (dominated) continue;
      }

      if (lib.downloads?.artifact) {
        const libPath = path.join(LIBRARIES_DIR, lib.downloads.artifact.path);
        if (!fs.existsSync(libPath)) {
          try {
            await download(lib.downloads.artifact.url, libPath);
          } catch (e) {
            console.error(`Failed to download library: ${lib.name}`, e);
          }
        }
      }
      libsDone++;
      const libProgress = 30 + Math.floor((libsDone / libraries.length) * 40);
      mainWindow?.webContents.send('install:progress', { versionId, status: `Downloading libraries (${libsDone}/${libraries.length})...`, progress: libProgress });
    }
  }

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading assets...', progress: 75 });

  // Download asset index
  const assetIndex = versionData.assetIndex as { id: string; url: string } | undefined;
  if (assetIndex) {
    const indexDir = path.join(ASSETS_DIR, 'indexes');
    fs.mkdirSync(indexDir, { recursive: true });
    const indexPath = path.join(indexDir, `${assetIndex.id}.json`);
    if (!fs.existsSync(indexPath)) {
      await download(assetIndex.url, indexPath);
    }

    // Download individual assets (only a subset to keep install fast)
    try {
      const indexData = readJSON<{ objects: Record<string, { hash: string; size: number }> }>(indexPath, { objects: {} });
      const objectKeys = Object.keys(indexData.objects);
      let assetsDone = 0;
      const totalAssets = objectKeys.length;

      for (const key of objectKeys) {
        const obj = indexData.objects[key];
        const hashPrefix = obj.hash.substring(0, 2);
        const assetPath = path.join(ASSETS_DIR, 'objects', hashPrefix, obj.hash);
        if (!fs.existsSync(assetPath)) {
          try {
            await download(
              `https://resources.download.minecraft.net/${hashPrefix}/${obj.hash}`,
              assetPath
            );
          } catch {
            // Non-critical, continue
          }
        }
        assetsDone++;
        if (assetsDone % 50 === 0 || assetsDone === totalAssets) {
          const assetProgress = 75 + Math.floor((assetsDone / totalAssets) * 20);
          mainWindow?.webContents.send('install:progress', { versionId, status: `Downloading assets (${assetsDone}/${totalAssets})...`, progress: Math.min(assetProgress, 95) });
        }
      }
    } catch (e) {
      console.error('Failed to download assets:', e);
    }
  }

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Installation complete!', progress: 100 });
  return { success: true };
});

// ── IPC: Launch Game ───────────────────────────────────────────────────────────
ipcMain.handle('game:launch', async (_e, opts: {
  versionId: string;
  account: Account;
  jvmArgs?: string;
  gameArgs?: string;
  memory?: number;
}) => {
  const { versionId, account, jvmArgs, gameArgs, memory } = opts;
  const versionDir = path.join(VERSIONS_DIR, versionId);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);

  if (!fs.existsSync(versionJsonPath)) {
    return { success: false, error: 'Version not installed' };
  }

  const versionData = readJSON<Record<string, unknown>>(versionJsonPath, {});

  // Build classpath
  const libs: string[] = [];
  const libraries = versionData.libraries as Array<{
    downloads?: { artifact?: { path: string } };
    rules?: Array<{ action: string; os?: { name: string } }>;
  }>;

  if (libraries) {
    for (const lib of libraries) {
      if (lib.rules) {
        const dominated = lib.rules.some(r => {
          if (r.action === 'allow' && r.os && r.os.name !== 'linux') return true;
          if (r.action === 'disallow' && r.os && r.os.name === 'linux') return true;
          return false;
        });
        if (dominated) continue;
      }
      if (lib.downloads?.artifact?.path) {
        const libPath = path.join(LIBRARIES_DIR, lib.downloads.artifact.path);
        if (fs.existsSync(libPath)) {
          libs.push(libPath);
        }
      }
    }
  }

  const clientJar = path.join(versionDir, `${versionId}.jar`);
  libs.push(clientJar);
  const classpath = libs.join(':');

  const mainClass = versionData.mainClass as string || 'net.minecraft.client.main.Minecraft';
  const assetIndex = versionData.assetIndex as { id: string } | undefined;
  const assetsId = assetIndex?.id || versionId;

  const memoryMb = memory || 2048;
  const jvmArgsList = [
    `-Xmx${memoryMb}M`,
    `-Xms${Math.floor(memoryMb / 2)}M`,
    '-XX:+UseG1GC',
    '-Djava.library.path=' + path.join(versionDir, 'natives'),
    ...(jvmArgs ? jvmArgs.split(' ').filter(Boolean) : []),
    '-cp', classpath,
    mainClass,
  ];

  const gameArgsList = [
    '--username', account.username,
    '--version', versionId,
    '--gameDir', GAME_DIR,
    '--assetsDir', ASSETS_DIR,
    '--assetIndex', assetsId,
    '--uuid', account.uuid,
    '--accessToken', account.accessToken || '0',
    '--userType', account.type === 'microsoft' ? 'msa' : 'legacy',
    ...(gameArgs ? gameArgs.split(' ').filter(Boolean) : []),
  ];

  const args = [...jvmArgsList, ...gameArgsList];

  try {
    gameProcess = spawn('java', args, {
      cwd: GAME_DIR,
      detached: true,
      stdio: 'pipe',
    });

    gameProcess.stdout?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('game:log', data.toString());
    });

    gameProcess.stderr?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('game:log', data.toString());
    });

    gameProcess.on('exit', (code) => {
      mainWindow?.webContents.send('game:exit', code);
      gameProcess = null;
    });

    return { success: true, pid: gameProcess.pid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('game:kill', () => {
  if (gameProcess) {
    gameProcess.kill();
    gameProcess = null;
    return true;
  }
  return false;
});

// ── IPC: Custom Builds ─────────────────────────────────────────────────────────
ipcMain.handle('builds:list', () => {
  return readJSON<CustomBuild[]>(BUILDS_FILE, []);
});

ipcMain.handle('builds:create', (_e, build: Omit<CustomBuild, 'id' | 'createdAt'>) => {
  const builds = readJSON<CustomBuild[]>(BUILDS_FILE, []);
  const newBuild: CustomBuild = {
    ...build,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  builds.push(newBuild);
  writeJSON(BUILDS_FILE, builds);
  return newBuild;
});

ipcMain.handle('builds:delete', (_e, id: string) => {
  let builds = readJSON<CustomBuild[]>(BUILDS_FILE, []);
  builds = builds.filter(b => b.id !== id);
  writeJSON(BUILDS_FILE, builds);
  return builds;
});

// ── IPC: Settings ──────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => {
  return readJSON(SETTINGS_FILE, {
    memory: 2048,
    javaPath: 'java',
    showSnapshots: false,
    showBeta: true,
    showAlpha: false,
    closeOnLaunch: false,
  });
});

ipcMain.handle('settings:save', (_e, settings: Record<string, unknown>) => {
  writeJSON(SETTINGS_FILE, settings);
  return true;
});

// ── IPC: Utility ───────────────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (_e, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('app:getPath', () => {
  return LAUNCHER_DIR;
});
