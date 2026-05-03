import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { spawn, execSync, ChildProcess } from 'child_process';
import { createHash } from 'crypto';

// ── Global Error Handling ──────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  if (err.message?.includes('ESRCH') || err.message?.includes('kill')) {
    // Process already exited — safe to ignore
    return;
  }
  dialog.showErrorBox('VortyMC Error', `An unexpected error occurred:\n${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

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

function httpsPost(url: string, body: string, contentType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
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

// ── Microsoft OAuth Device Code Flow ───────────────────────────────────────────
const MS_CLIENT_ID = '1ce16a5a-a4ed-4269-a0db-3e498e3d3075';

ipcMain.handle('accounts:microsoftLogin', async () => {
  try {
    // Step 1: Request device code
    const deviceCodeBody = `client_id=${MS_CLIENT_ID}&scope=XboxLive.signin%20offline_access`;
    const deviceCodeRes = await httpsPost(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
      deviceCodeBody,
      'application/x-www-form-urlencoded'
    );
    const deviceCode = JSON.parse(deviceCodeRes) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
      message: string;
    };

    if (!deviceCode.user_code) {
      return { success: false, message: 'Failed to get device code from Microsoft.' };
    }

    // Send the code to the renderer for the user to see
    mainWindow?.webContents.send('ms:deviceCode', {
      userCode: deviceCode.user_code,
      verificationUri: deviceCode.verification_uri,
      message: deviceCode.message,
    });

    // Open the browser for the user
    shell.openExternal(deviceCode.verification_uri);

    // Step 2: Poll for token
    const interval = (deviceCode.interval || 5) * 1000;
    const expiresAt = Date.now() + deviceCode.expires_in * 1000;

    let msToken: { access_token: string; refresh_token: string } | null = null;

    while (Date.now() < expiresAt) {
      await new Promise(r => setTimeout(r, interval));

      const tokenBody = `client_id=${MS_CLIENT_ID}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${deviceCode.device_code}`;
      const tokenRes = await httpsPost(
        'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        tokenBody,
        'application/x-www-form-urlencoded'
      );
      const tokenData = JSON.parse(tokenRes) as Record<string, unknown>;

      if (tokenData.error === 'authorization_pending') {
        continue;
      }
      if (tokenData.error) {
        return { success: false, message: `Microsoft auth error: ${tokenData.error_description || tokenData.error}` };
      }
      if (tokenData.access_token) {
        msToken = {
          access_token: tokenData.access_token as string,
          refresh_token: tokenData.refresh_token as string,
        };
        break;
      }
    }

    if (!msToken) {
      return { success: false, message: 'Microsoft login timed out. Please try again.' };
    }

    // Step 3: Authenticate with Xbox Live
    const xblBody = JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msToken.access_token}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    });
    const xblRes = await httpsPost(
      'https://user.auth.xboxlive.com/user/authenticate',
      xblBody,
      'application/json'
    );
    const xblData = JSON.parse(xblRes) as { Token: string; DisplayClaims: { xui: Array<{ uhs: string }> } };

    if (!xblData.Token) {
      return { success: false, message: 'Failed to authenticate with Xbox Live.' };
    }

    const xblToken = xblData.Token;
    const userHash = xblData.DisplayClaims?.xui?.[0]?.uhs;

    // Step 4: Get XSTS token
    const xstsBody = JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    });
    const xstsRes = await httpsPost(
      'https://xsts.auth.xboxlive.com/xsts/authorize',
      xstsBody,
      'application/json'
    );
    const xstsData = JSON.parse(xstsRes) as { Token: string; XErr?: number };

    if (xstsData.XErr) {
      const errMessages: Record<number, string> = {
        2148916233: 'This Microsoft account does not have an Xbox account.',
        2148916235: 'Xbox Live is not available in your country.',
        2148916236: 'Adult verification needed.',
        2148916237: 'Adult verification needed.',
        2148916238: 'This account is a child account. Please add it to a Family.',
      };
      return { success: false, message: errMessages[xstsData.XErr] || `Xbox auth error: ${xstsData.XErr}` };
    }

    if (!xstsData.Token) {
      return { success: false, message: 'Failed to get XSTS token.' };
    }

    // Step 5: Authenticate with Minecraft
    const mcBody = JSON.stringify({
      identityToken: `XBL3.0 x=${userHash};${xstsData.Token}`,
    });
    const mcRes = await httpsPost(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      mcBody,
      'application/json'
    );
    const mcData = JSON.parse(mcRes) as { access_token: string };

    if (!mcData.access_token) {
      return { success: false, message: 'Failed to authenticate with Minecraft services.' };
    }

    // Step 6: Check game ownership
    const ownershipRes = await new Promise<string>((resolve, reject) => {
      https.get('https://api.minecraftservices.com/entitlements/mcstore', {
        headers: { Authorization: `Bearer ${mcData.access_token}` },
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const ownership = JSON.parse(ownershipRes) as { items: Array<{ name: string }> };
    const ownsGame = ownership.items && ownership.items.length > 0;

    // Step 7: Get profile (username, UUID, skin)
    const profileRes = await new Promise<string>((resolve, reject) => {
      https.get('https://api.minecraftservices.com/minecraft/profile', {
        headers: { Authorization: `Bearer ${mcData.access_token}` },
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const profile = JSON.parse(profileRes) as { id: string; name: string; skins?: Array<{ url: string; state: string }> };

    if (!profile.name) {
      return {
        success: false,
        message: ownsGame
          ? 'Could not retrieve Minecraft profile.'
          : 'This Microsoft account does not own Minecraft Java Edition.',
      };
    }

    // Format UUID
    const rawUuid = profile.id;
    const uuid = [
      rawUuid.slice(0, 8),
      rawUuid.slice(8, 12),
      rawUuid.slice(12, 16),
      rawUuid.slice(16, 20),
      rawUuid.slice(20),
    ].join('-');

    // Get skin URL
    const activeSkin = profile.skins?.find(s => s.state === 'ACTIVE');
    const skinUrl = activeSkin ? activeSkin.url : undefined;

    // Save account
    const accounts = readJSON<Account[]>(ACCOUNTS_FILE, []);
    const existingIdx = accounts.findIndex(a => a.type === 'microsoft' && a.uuid === uuid);
    const account: Account = {
      id: existingIdx >= 0 ? accounts[existingIdx].id : Date.now().toString(),
      username: profile.name,
      type: 'microsoft',
      uuid,
      accessToken: mcData.access_token,
      refreshToken: msToken.refresh_token,
      skinUrl,
    };

    if (existingIdx >= 0) {
      accounts[existingIdx] = account;
    } else {
      accounts.push(account);
    }
    writeJSON(ACCOUNTS_FILE, accounts);

    return { success: true, account };
  } catch (err) {
    console.error('Microsoft login error:', err);
    return { success: false, message: `Login failed: ${err}` };
  }
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

  const versionData = await fetchJSON(versionUrl) as Record<string, unknown>;
  writeJSON(versionJsonPath, versionData);

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading client jar...', progress: 15 });

  const downloads = versionData.downloads as Record<string, { url: string; sha1: string; size: number }>;
  if (downloads?.client) {
    const clientJarPath = path.join(versionDir, `${versionId}.jar`);
    if (!fs.existsSync(clientJarPath)) {
      await download(downloads.client.url, clientJarPath);
    }
  }

  mainWindow?.webContents.send('install:progress', { versionId, status: 'Downloading libraries...', progress: 30 });

  const libraries = versionData.libraries as Array<{
    name: string;
    downloads?: {
      artifact?: { url: string; path: string; sha1: string; size: number };
      classifiers?: Record<string, { url: string; path: string }>;
    };
    rules?: Array<{ action: string; os?: { name: string } }>;
  }>;

  const installOs = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

  if (libraries) {
    let libsDone = 0;
    for (const lib of libraries) {
      if (lib.rules) {
        let dominated = false;
        for (const r of lib.rules) {
          if (r.action === 'allow' && r.os && r.os.name !== installOs) dominated = true;
          if (r.action === 'disallow' && r.os && r.os.name === installOs) dominated = true;
        }
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

  const assetIndex = versionData.assetIndex as { id: string; url: string } | undefined;
  if (assetIndex) {
    const indexDir = path.join(ASSETS_DIR, 'indexes');
    fs.mkdirSync(indexDir, { recursive: true });
    const indexPath = path.join(indexDir, `${assetIndex.id}.json`);
    if (!fs.existsSync(indexPath)) {
      await download(assetIndex.url, indexPath);
    }

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

  const libs: string[] = [];
  const libraries = versionData.libraries as Array<{
    downloads?: { artifact?: { path: string } };
    rules?: Array<{ action: string; os?: { name: string } }>;
  }>;

  const currentOs = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

  if (libraries) {
    for (const lib of libraries) {
      if (lib.rules) {
        let dominated = false;
        for (const r of lib.rules) {
          if (r.action === 'allow' && r.os && r.os.name !== currentOs) dominated = true;
          if (r.action === 'disallow' && r.os && r.os.name === currentOs) dominated = true;
        }
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
  const cpSeparator = process.platform === 'win32' ? ';' : ':';
  const classpath = libs.join(cpSeparator);

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

  // Check if Java is available before spawning
  let javaCmd = process.platform === 'win32' ? 'javaw' : 'java';
  try {
    execSync(`${javaCmd} -version`, { stdio: 'pipe' });
  } catch {
    // Try fallback to 'java' on Windows too
    javaCmd = 'java';
    try {
      execSync(`${javaCmd} -version`, { stdio: 'pipe' });
    } catch {
      return { success: false, error: 'Java not found. Please install Java 17+ and make sure it is in your PATH.' };
    }
  }

  try {
    gameProcess = spawn(javaCmd, args, {
      cwd: GAME_DIR,
      stdio: 'pipe',
    });

    gameProcess.on('error', (err) => {
      mainWindow?.webContents.send('game:log', `Failed to start Java: ${err.message}\nMake sure Java 17+ is installed and in your PATH.`);
      mainWindow?.webContents.send('game:exit', -1);
      gameProcess = null;
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
    try {
      gameProcess.kill();
    } catch {
      // Process may have already exited
    }
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
