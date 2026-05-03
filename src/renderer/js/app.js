// VortyMC Launcher - Renderer Application
(function () {
  'use strict';

  // State
  let currentPage = 'home';
  let selectedVersion = null;
  let versionFilter = 'release';
  let versionsPageFilter = 'release';
  let versionManifest = null;
  let installedVersions = [];
  let instances = [];
  let accounts = [];
  let activeAccount = null;

  // DOM Ready
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    setupTitlebar();
    setupNavigation();
    setupCreatePage();
    setupAccountsPage();
    setupSettingsPage();
    await refreshData();
  }

  // ─── Title Bar ──────────────────────────────────────────────────────────────
  function setupTitlebar() {
    document.getElementById('btn-minimize').addEventListener('click', () => window.vortyAPI.minimize());
    document.getElementById('btn-maximize').addEventListener('click', () => window.vortyAPI.maximize());
    document.getElementById('btn-close').addEventListener('click', () => window.vortyAPI.close());
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────
  function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    document.getElementById('active-account-display').addEventListener('click', () => {
      navigateTo('accounts');
    });
  }

  window.navigateTo = function (page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (page === 'create' && !versionManifest) loadVersionManifest();
    if (page === 'versions') renderVersionsPage();
    if (page === 'accounts') renderAccountsList();
    if (page === 'settings') loadSettings();
  };

  // ─── Data ───────────────────────────────────────────────────────────────────
  async function refreshData() {
    try {
      [instances, accounts, activeAccount, installedVersions] = await Promise.all([
        window.vortyAPI.getInstances(),
        window.vortyAPI.getAccounts(),
        window.vortyAPI.getActiveAccount(),
        window.vortyAPI.getInstalledVersions(),
      ]);
    } catch (e) {
      instances = [];
      accounts = [];
      activeAccount = null;
      installedVersions = [];
    }
    renderHome();
    updateAccountDisplay();
    loadVersionManifest();
  }

  // ─── Home Page ──────────────────────────────────────────────────────────────
  function renderHome() {
    const grid = document.getElementById('instances-grid');
    const empty = document.getElementById('home-empty');

    if (!instances || instances.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(createEmptyState());
      return;
    }

    grid.innerHTML = instances.map((inst, i) => `
      <div class="instance-card" style="animation-delay: ${i * 0.05}s" data-id="${inst.id}">
        <div class="card-header">
          <div class="card-icon">
            <i class="fas fa-cube"></i>
          </div>
          <div>
            <div class="card-title">${escapeHtml(inst.name)}</div>
            <div class="card-version">${escapeHtml(inst.version)}</div>
          </div>
        </div>
        <div class="card-meta">
          <span><i class="fas fa-tag"></i> ${inst.type}</span>
          <span><i class="fas fa-clock"></i> ${inst.lastPlayed ? timeAgo(inst.lastPlayed) : 'Never played'}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-glow btn-play" onclick="playInstance('${inst.id}')">
            <i class="fas fa-play"></i> Play
          </button>
          <button class="btn btn-secondary btn-icon" onclick="deleteInstance('${inst.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = 'home-empty';
    div.innerHTML = `
      <div class="empty-icon"><i class="fas fa-cube"></i></div>
      <h3>No Instances Yet</h3>
      <p>Create your first Minecraft instance to get started</p>
      <button class="btn btn-primary btn-glow" onclick="navigateTo('create')">
        <i class="fas fa-plus"></i> Create Instance
      </button>
    `;
    return div;
  }

  window.playInstance = async function (id) {
    if (!activeAccount) {
      showToast('Please select an account first', 'error');
      navigateTo('accounts');
      return;
    }

    const inst = instances.find(i => i.id === id);
    if (!inst) return;

    // Check if version is installed
    if (!installedVersions.includes(inst.version)) {
      showToast(`Installing ${inst.version}...`, 'info');
      showLaunchOverlay(`Installing ${inst.version}...`, 'Downloading game files');
      try {
        await window.vortyAPI.installVersion(inst.version);
        installedVersions = await window.vortyAPI.getInstalledVersions();
      } catch (err) {
        hideLaunchOverlay();
        showToast('Failed to install version: ' + err.message, 'error');
        return;
      }
    }

    showLaunchOverlay(`Launching ${inst.name}`, `Minecraft ${inst.version}`);
    const result = await window.vortyAPI.play(id);
    if (!result.success) {
      hideLaunchOverlay();
      showToast('Launch failed: ' + result.error, 'error');
    } else {
      setTimeout(hideLaunchOverlay, 3000);
      showToast('Minecraft launched!', 'success');
      instances = await window.vortyAPI.getInstances();
      renderHome();
    }
  };

  window.deleteInstance = async function (id) {
    const inst = instances.find(i => i.id === id);
    if (!inst) return;
    if (!confirm(`Delete instance "${inst.name}"?`)) return;
    await window.vortyAPI.deleteInstance(id);
    instances = await window.vortyAPI.getInstances();
    renderHome();
    showToast('Instance deleted', 'info');
  };

  // ─── Create Page ────────────────────────────────────────────────────────────
  function setupCreatePage() {
    // Version filter buttons
    document.querySelectorAll('.version-selector .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.version-selector .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        versionFilter = btn.dataset.filter;
        renderVersionList();
      });
    });

    // Version search
    document.getElementById('version-search').addEventListener('input', (e) => {
      renderVersionList();
    });

    // Create button
    document.getElementById('btn-create-instance').addEventListener('click', createInstance);
  }

  async function loadVersionManifest() {
    try {
      versionManifest = await window.vortyAPI.getVersionManifest();
      renderVersionList();
    } catch (e) {
      document.getElementById('version-list').innerHTML =
        '<div class="loading-spinner"><i class="fas fa-exclamation-triangle"></i> Failed to load versions</div>';
    }
  }

  function renderVersionList() {
    const container = document.getElementById('version-list');
    if (!versionManifest) return;

    const search = (document.getElementById('version-search').value || '').toLowerCase();
    const filtered = versionManifest.versions.filter(v => {
      if (v.type !== versionFilter) return false;
      if (search && !v.id.toLowerCase().includes(search)) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="loading-spinner">No versions found</div>';
      return;
    }

    container.innerHTML = filtered.slice(0, 100).map(v => `
      <div class="version-item ${selectedVersion === v.id ? 'selected' : ''}"
           onclick="selectVersion('${v.id}')">
        <span class="version-id">${v.id}</span>
        <span class="version-type ${v.type}">${formatType(v.type)}</span>
      </div>
    `).join('');
  }

  window.selectVersion = function (id) {
    selectedVersion = id;
    renderVersionList();
  };

  async function createInstance() {
    const name = document.getElementById('create-name').value.trim();
    const jvmArgs = document.getElementById('create-jvmargs').value.trim();

    if (!name) {
      showToast('Please enter an instance name', 'error');
      return;
    }
    if (!selectedVersion) {
      showToast('Please select a Minecraft version', 'error');
      return;
    }

    try {
      await window.vortyAPI.createInstance({
        name,
        version: selectedVersion,
        jvmArgs: jvmArgs || '-Xmx2G -Xms512M',
      });
      instances = await window.vortyAPI.getInstances();
      showToast(`Instance "${name}" created!`, 'success');
      document.getElementById('create-name').value = '';
      selectedVersion = null;
      renderVersionList();
      navigateTo('home');
      renderHome();
    } catch (e) {
      showToast('Failed to create instance: ' + e.message, 'error');
    }
  }

  // ─── Versions Page ──────────────────────────────────────────────────────────
  function renderVersionsPage() {
    if (!versionManifest) {
      loadVersionManifest().then(renderVersionsPage);
      return;
    }

    // Setup filters
    document.querySelectorAll('#versions-page-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#versions-page-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        versionsPageFilter = btn.dataset.filter;
        renderVersionsGrid();
      });
    });

    document.getElementById('versions-search').addEventListener('input', renderVersionsGrid);
    renderVersionsGrid();
  }

  function renderVersionsGrid() {
    const container = document.getElementById('versions-grid');
    if (!versionManifest) return;

    const search = (document.getElementById('versions-search').value || '').toLowerCase();
    const filtered = versionManifest.versions.filter(v => {
      if (v.type !== versionsPageFilter) return false;
      if (search && !v.id.toLowerCase().includes(search)) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="loading-spinner">No versions found</div>';
      return;
    }

    container.innerHTML = filtered.slice(0, 200).map((v, i) => {
      const isInstalled = installedVersions.includes(v.id);
      const date = new Date(v.releaseTime).toLocaleDateString();
      return `
        <div class="version-row" style="animation-delay: ${Math.min(i * 0.02, 0.5)}s">
          <span class="version-id">${v.id}</span>
          <span class="version-type ${v.type}">${formatType(v.type)}</span>
          <span class="version-date">${date}</span>
          <div class="version-actions">
            ${isInstalled
              ? '<span class="btn btn-sm btn-secondary" style="pointer-events:none;opacity:0.6"><i class="fas fa-check"></i> Installed</span>'
              : `<button class="btn btn-sm btn-primary" onclick="installVersion('${v.id}')"><i class="fas fa-download"></i> Install</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  window.installVersion = async function (id) {
    showToast(`Installing ${id}...`, 'info');
    try {
      await window.vortyAPI.installVersion(id);
      installedVersions = await window.vortyAPI.getInstalledVersions();
      showToast(`${id} installed!`, 'success');
      renderVersionsGrid();
    } catch (e) {
      showToast('Install failed: ' + e.message, 'error');
    }
  };

  // Version progress listener
  window.vortyAPI.onVersionProgress((data) => {
    const overlay = document.getElementById('launch-overlay');
    if (!overlay.classList.contains('hidden')) {
      const bar = document.getElementById('launch-progress-bar');
      const detail = document.getElementById('launch-status-detail');
      bar.style.width = data.progress.percent + '%';
      detail.textContent = formatStage(data.progress.stage);
    }
  });

  // ─── Accounts Page ──────────────────────────────────────────────────────────
  function setupAccountsPage() {
    document.getElementById('btn-add-offline').addEventListener('click', () => {
      document.getElementById('modal-offline').classList.remove('hidden');
      document.getElementById('offline-username').focus();
    });

    document.getElementById('btn-confirm-offline').addEventListener('click', async () => {
      const username = document.getElementById('offline-username').value.trim();
      if (!username || username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
      }
      try {
        await window.vortyAPI.addOfflineAccount(username);
        accounts = await window.vortyAPI.getAccounts();
        activeAccount = await window.vortyAPI.getActiveAccount();
        closeModal('modal-offline');
        document.getElementById('offline-username').value = '';
        renderAccountsList();
        updateAccountDisplay();
        showToast(`Account "${username}" added!`, 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    document.getElementById('btn-add-microsoft').addEventListener('click', async () => {
      showToast('Opening Microsoft login...', 'info');
      const result = await window.vortyAPI.loginMicrosoft();
      if (result.success) {
        accounts = await window.vortyAPI.getAccounts();
        activeAccount = await window.vortyAPI.getActiveAccount();
        renderAccountsList();
        updateAccountDisplay();
        showToast(`Signed in as ${result.account.username}!`, 'success');
      } else {
        showToast('Microsoft login failed: ' + result.error, 'error');
      }
    });

    // Enter key on offline username
    document.getElementById('offline-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-confirm-offline').click();
    });
  }

  function renderAccountsList() {
    const list = document.getElementById('accounts-list');

    if (!accounts || accounts.length === 0) {
      list.innerHTML = `
        <div class="empty-state" id="accounts-empty">
          <div class="empty-icon"><i class="fas fa-user-slash"></i></div>
          <h3>No Accounts</h3>
          <p>Add an offline account or sign in with Microsoft</p>
        </div>
      `;
      return;
    }

    list.innerHTML = accounts.map((acc, i) => {
      const isActive = activeAccount && activeAccount.id === acc.id;
      const avatar = acc.skinUrl
        ? `<img src="${acc.skinUrl}" alt="${escapeHtml(acc.username)}">`
        : `<i class="fas fa-user"></i>`;

      return `
        <div class="account-card ${isActive ? 'active' : ''}" style="animation-delay: ${i * 0.05}s">
          <div class="account-avatar">${avatar}</div>
          <div class="account-details">
            <div class="account-username">${escapeHtml(acc.username)}</div>
            <div class="account-label">${isActive ? 'Active Account' : 'Click to select'}</div>
          </div>
          <span class="account-badge ${acc.type}">${acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
          <div class="account-card-actions">
            ${!isActive ? `<button class="btn btn-sm btn-secondary" onclick="selectAccount('${acc.id}')"><i class="fas fa-check"></i> Select</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="removeAccount('${acc.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectAccount = async function (id) {
    await window.vortyAPI.setActiveAccount(id);
    activeAccount = await window.vortyAPI.getActiveAccount();
    renderAccountsList();
    updateAccountDisplay();
    showToast('Account selected', 'success');
  };

  window.removeAccount = async function (id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!confirm(`Remove account "${acc.username}"?`)) return;
    await window.vortyAPI.removeAccount(id);
    accounts = await window.vortyAPI.getAccounts();
    activeAccount = await window.vortyAPI.getActiveAccount();
    renderAccountsList();
    updateAccountDisplay();
    showToast('Account removed', 'info');
  };

  function updateAccountDisplay() {
    const pill = document.getElementById('active-account-display');
    const nameEl = pill.querySelector('.account-name');
    const typeEl = pill.querySelector('.account-type');
    const avatarEl = pill.querySelector('.account-avatar');

    if (activeAccount) {
      nameEl.textContent = activeAccount.username;
      typeEl.textContent = activeAccount.type === 'microsoft' ? 'Microsoft' : 'Offline';
      if (activeAccount.skinUrl) {
        avatarEl.innerHTML = `<img src="${activeAccount.skinUrl}" alt="">`;
      } else {
        avatarEl.innerHTML = '<i class="fas fa-user"></i>';
      }
    } else {
      nameEl.textContent = 'No Account';
      typeEl.textContent = 'Select an account';
      avatarEl.innerHTML = '<i class="fas fa-user"></i>';
    }
  }

  // ─── Settings ───────────────────────────────────────────────────────────────
  async function setupSettingsPage() {
    document.getElementById('btn-browse-java').addEventListener('click', async () => {
      const path = await window.vortyAPI.selectJava();
      if (path) document.getElementById('settings-java').value = path;
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
      const settings = {
        javaPath: document.getElementById('settings-java').value || 'java',
        ramMin: document.getElementById('settings-ram-min').value,
        ramMax: document.getElementById('settings-ram-max').value,
      };
      await window.vortyAPI.saveSettings(settings);
      showToast('Settings saved!', 'success');
    });
  }

  async function loadSettings() {
    try {
      const settings = await window.vortyAPI.getSettings();
      document.getElementById('settings-java').value = settings.javaPath || 'java';
      document.getElementById('settings-ram-min').value = settings.ramMin || '512M';
      document.getElementById('settings-ram-max').value = settings.ramMax || '2G';
    } catch (e) {
      // defaults are fine
    }
  }

  // ─── Launch Overlay ─────────────────────────────────────────────────────────
  function showLaunchOverlay(title, detail) {
    document.getElementById('launch-status-text').textContent = title;
    document.getElementById('launch-status-detail').textContent = detail;
    document.getElementById('launch-progress-bar').style.width = '0%';
    document.getElementById('launch-overlay').classList.remove('hidden');
  }

  function hideLaunchOverlay() {
    document.getElementById('launch-overlay').classList.add('hidden');
  }

  document.getElementById('btn-cancel-launch')?.addEventListener('click', hideLaunchOverlay);

  // Launch event listener
  window.vortyAPI.onLaunchEvent((event) => {
    if (event.type === 'status') {
      document.getElementById('launch-status-detail').textContent = event.message;
    } else if (event.type === 'exit') {
      hideLaunchOverlay();
      if (event.code !== 0) {
        showToast('Minecraft exited with code ' + event.code, 'error');
      }
    } else if (event.type === 'error') {
      console.error('[MC]', event.message);
    }
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────
  window.closeModal = function (id) {
    document.getElementById(id).classList.add('hidden');
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function formatType(type) {
    const map = { release: 'Release', snapshot: 'Snapshot', old_beta: 'Beta', old_alpha: 'Alpha' };
    return map[type] || type;
  }

  function formatStage(stage) {
    const map = {
      downloading_metadata: 'Downloading metadata...',
      downloading_client: 'Downloading client JAR...',
      downloading_libraries: 'Downloading libraries...',
      downloading_assets: 'Downloading assets...',
      complete: 'Complete!',
    };
    return map[stage] || stage;
  }
})();
