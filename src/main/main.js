const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AccountManager = require('./accountManager');
const VersionManager = require('./versionManager');
const LaunchManager = require('./launchManager');
const MicrosoftAuth = require('./microsoftAuth');

let mainWindow;
const DATA_DIR = path.join(app.getPath('userData'), 'VortyMC');
const INSTANCES_DIR = path.join(DATA_DIR, 'instances');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');

function ensureDirs() {
  for (const dir of [DATA_DIR, INSTANCES_DIR, VERSIONS_DIR, ASSETS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();

  const accountMgr = new AccountManager(DATA_DIR);
  const versionMgr = new VersionManager(VERSIONS_DIR, ASSETS_DIR);
  const launchMgr = new LaunchManager(DATA_DIR, VERSIONS_DIR, ASSETS_DIR);
  const msAuth = new MicrosoftAuth();

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Accounts
  ipcMain.handle('accounts:getAll', () => accountMgr.getAccounts());
  ipcMain.handle('accounts:getActive', () => accountMgr.getActiveAccount());
  ipcMain.handle('accounts:addOffline', (_, username) => accountMgr.addOfflineAccount(username));
  ipcMain.handle('accounts:remove', (_, id) => accountMgr.removeAccount(id));
  ipcMain.handle('accounts:setActive', (_, id) => accountMgr.setActiveAccount(id));

  // Microsoft Auth
  ipcMain.handle('auth:microsoft', async () => {
    try {
      const result = await msAuth.authenticate(mainWindow);
      if (result) {
        accountMgr.addMicrosoftAccount(result);
        return { success: true, account: result };
      }
      return { success: false, error: 'Authentication cancelled' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Versions
  ipcMain.handle('versions:getManifest', () => versionMgr.getVersionManifest());
  ipcMain.handle('versions:getInstalled', () => versionMgr.getInstalledVersions());
  ipcMain.handle('versions:install', async (_, versionId) => {
    return versionMgr.installVersion(versionId, (progress) => {
      mainWindow?.webContents.send('versions:progress', { versionId, progress });
    });
  });

  // Instances / Custom Builds
  ipcMain.handle('instances:getAll', () => {
    const instancesFile = path.join(INSTANCES_DIR, 'instances.json');
    if (!fs.existsSync(instancesFile)) return [];
    return JSON.parse(fs.readFileSync(instancesFile, 'utf-8'));
  });

  ipcMain.handle('instances:create', (_, config) => {
    const instancesFile = path.join(INSTANCES_DIR, 'instances.json');
    let instances = [];
    if (fs.existsSync(instancesFile)) {
      instances = JSON.parse(fs.readFileSync(instancesFile, 'utf-8'));
    }
    const instance = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: config.name,
      version: config.version,
      type: config.type || 'vanilla',
      jvmArgs: config.jvmArgs || '-Xmx2G -Xms512M',
      gameDir: path.join(INSTANCES_DIR, config.name.replace(/[^a-zA-Z0-9_-]/g, '_')),
      created: new Date().toISOString(),
      lastPlayed: null,
      icon: config.icon || 'default',
    };
    if (!fs.existsSync(instance.gameDir)) fs.mkdirSync(instance.gameDir, { recursive: true });
    instances.push(instance);
    fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));
    return instance;
  });

  ipcMain.handle('instances:delete', (_, id) => {
    const instancesFile = path.join(INSTANCES_DIR, 'instances.json');
    if (!fs.existsSync(instancesFile)) return;
    let instances = JSON.parse(fs.readFileSync(instancesFile, 'utf-8'));
    instances = instances.filter(i => i.id !== id);
    fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));
  });

  ipcMain.handle('instances:edit', (_, id, updates) => {
    const instancesFile = path.join(INSTANCES_DIR, 'instances.json');
    if (!fs.existsSync(instancesFile)) return null;
    let instances = JSON.parse(fs.readFileSync(instancesFile, 'utf-8'));
    const idx = instances.findIndex(i => i.id === id);
    if (idx === -1) return null;
    instances[idx] = { ...instances[idx], ...updates };
    fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));
    return instances[idx];
  });

  // Launch
  ipcMain.handle('launch:play', async (_, instanceId) => {
    try {
      const instancesFile = path.join(INSTANCES_DIR, 'instances.json');
      const instances = JSON.parse(fs.readFileSync(instancesFile, 'utf-8'));
      const instance = instances.find(i => i.id === instanceId);
      if (!instance) return { success: false, error: 'Instance not found' };

      const account = accountMgr.getActiveAccount();
      if (!account) return { success: false, error: 'No account selected' };

      // Update lastPlayed
      instance.lastPlayed = new Date().toISOString();
      fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));

      await launchMgr.launch(instance, account, (event) => {
        mainWindow?.webContents.send('launch:event', event);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    const settingsFile = path.join(DATA_DIR, 'settings.json');
    if (!fs.existsSync(settingsFile)) {
      return { javaPath: 'java', ramMin: '512M', ramMax: '2G', gameDir: DATA_DIR };
    }
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  });

  ipcMain.handle('settings:save', (_, settings) => {
    fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify(settings, null, 2));
    return true;
  });

  ipcMain.handle('settings:selectJava', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Java Executable',
      properties: ['openFile'],
      filters: [
        { name: 'Java', extensions: ['exe', ''] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
