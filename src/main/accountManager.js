const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class AccountManager {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, 'accounts.json');
    this.accounts = this._load();
  }

  _load() {
    if (fs.existsSync(this.filePath)) {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    }
    return { accounts: [], activeId: null };
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.accounts, null, 2));
  }

  getAccounts() {
    return this.accounts.accounts;
  }

  getActiveAccount() {
    return this.accounts.accounts.find(a => a.id === this.accounts.activeId) || null;
  }

  addOfflineAccount(username) {
    if (!username || username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    const account = {
      id: uuidv4(),
      type: 'offline',
      username: username.trim(),
      uuid: uuidv4().replace(/-/g, ''),
      accessToken: 'offline',
      skinUrl: null,
      created: new Date().toISOString(),
    };
    this.accounts.accounts.push(account);
    if (!this.accounts.activeId) {
      this.accounts.activeId = account.id;
    }
    this._save();
    return account;
  }

  addMicrosoftAccount(authResult) {
    const existing = this.accounts.accounts.findIndex(
      a => a.type === 'microsoft' && a.uuid === authResult.uuid
    );
    const account = {
      id: existing >= 0 ? this.accounts.accounts[existing].id : uuidv4(),
      type: 'microsoft',
      username: authResult.username,
      uuid: authResult.uuid,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken || null,
      skinUrl: authResult.skinUrl || null,
      created: new Date().toISOString(),
    };
    if (existing >= 0) {
      this.accounts.accounts[existing] = account;
    } else {
      this.accounts.accounts.push(account);
    }
    if (!this.accounts.activeId) {
      this.accounts.activeId = account.id;
    }
    this._save();
    return account;
  }

  removeAccount(id) {
    this.accounts.accounts = this.accounts.accounts.filter(a => a.id !== id);
    if (this.accounts.activeId === id) {
      this.accounts.activeId = this.accounts.accounts[0]?.id || null;
    }
    this._save();
  }

  setActiveAccount(id) {
    const exists = this.accounts.accounts.find(a => a.id === id);
    if (exists) {
      this.accounts.activeId = id;
      this._save();
    }
    return exists || null;
  }
}

module.exports = AccountManager;
