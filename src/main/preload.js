const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortyAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('accounts:getAll'),
  getActiveAccount: () => ipcRenderer.invoke('accounts:getActive'),
  addOfflineAccount: (username) => ipcRenderer.invoke('accounts:addOffline', username),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  setActiveAccount: (id) => ipcRenderer.invoke('accounts:setActive', id),
  loginMicrosoft: () => ipcRenderer.invoke('auth:microsoft'),

  // Versions
  getVersionManifest: () => ipcRenderer.invoke('versions:getManifest'),
  getInstalledVersions: () => ipcRenderer.invoke('versions:getInstalled'),
  installVersion: (versionId) => ipcRenderer.invoke('versions:install', versionId),
  onVersionProgress: (cb) => ipcRenderer.on('versions:progress', (_, data) => cb(data)),

  // Instances
  getInstances: () => ipcRenderer.invoke('instances:getAll'),
  createInstance: (config) => ipcRenderer.invoke('instances:create', config),
  deleteInstance: (id) => ipcRenderer.invoke('instances:delete', id),
  editInstance: (id, updates) => ipcRenderer.invoke('instances:edit', id, updates),

  // Launch
  play: (instanceId) => ipcRenderer.invoke('launch:play', instanceId),
  onLaunchEvent: (cb) => ipcRenderer.on('launch:event', (_, event) => cb(event)),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  selectJava: () => ipcRenderer.invoke('settings:selectJava'),

  // Utils
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
