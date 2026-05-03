const fs = require('fs');
const path = require('path');
const axios = require('axios');

const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

class VersionManager {
  constructor(versionsDir, assetsDir) {
    this.versionsDir = versionsDir;
    this.assetsDir = assetsDir;
    this.manifestCache = null;
    this.manifestCacheTime = 0;
  }

  async getVersionManifest() {
    const now = Date.now();
    if (this.manifestCache && now - this.manifestCacheTime < 300000) {
      return this.manifestCache;
    }
    try {
      const resp = await axios.get(VERSION_MANIFEST_URL, { timeout: 15000 });
      const manifest = resp.data;
      // Filter to include old_beta, old_alpha, release, snapshot
      const versions = manifest.versions.map(v => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
        url: v.url,
      }));
      this.manifestCache = {
        latest: manifest.latest,
        versions,
      };
      this.manifestCacheTime = now;
      return this.manifestCache;
    } catch (err) {
      if (this.manifestCache) return this.manifestCache;
      throw new Error('Failed to fetch version manifest: ' + err.message);
    }
  }

  getInstalledVersions() {
    if (!fs.existsSync(this.versionsDir)) return [];
    return fs.readdirSync(this.versionsDir).filter(dir => {
      const jsonPath = path.join(this.versionsDir, dir, `${dir}.json`);
      return fs.existsSync(jsonPath);
    });
  }

  async installVersion(versionId, onProgress) {
    const manifest = await this.getVersionManifest();
    const versionInfo = manifest.versions.find(v => v.id === versionId);
    if (!versionInfo) throw new Error(`Version ${versionId} not found`);

    onProgress?.({ stage: 'downloading_metadata', percent: 0 });

    const versionDir = path.join(this.versionsDir, versionId);
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

    // Download version JSON
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) {
      const resp = await axios.get(versionInfo.url, { timeout: 30000 });
      fs.writeFileSync(versionJsonPath, JSON.stringify(resp.data, null, 2));
    }

    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    onProgress?.({ stage: 'downloading_client', percent: 10 });

    // Download client JAR
    const clientJarPath = path.join(versionDir, `${versionId}.jar`);
    if (!fs.existsSync(clientJarPath) && versionData.downloads?.client) {
      const resp = await axios.get(versionData.downloads.client.url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        onDownloadProgress: (p) => {
          if (p.total) {
            const pct = 10 + Math.round((p.loaded / p.total) * 40);
            onProgress?.({ stage: 'downloading_client', percent: pct });
          }
        },
      });
      fs.writeFileSync(clientJarPath, Buffer.from(resp.data));
    }

    onProgress?.({ stage: 'downloading_libraries', percent: 50 });

    // Download libraries
    const libsDir = path.join(this.versionsDir, '..', 'libraries');
    if (!fs.existsSync(libsDir)) fs.mkdirSync(libsDir, { recursive: true });

    const libraries = versionData.libraries || [];
    let libsDone = 0;
    for (const lib of libraries) {
      if (!this._shouldIncludeLibrary(lib)) continue;
      const artifact = lib.downloads?.artifact;
      if (!artifact) continue;

      const libPath = path.join(libsDir, artifact.path);
      if (!fs.existsSync(libPath)) {
        const libDir = path.dirname(libPath);
        if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
        try {
          const resp = await axios.get(artifact.url, {
            responseType: 'arraybuffer',
            timeout: 60000,
          });
          fs.writeFileSync(libPath, Buffer.from(resp.data));
        } catch (err) {
          console.error(`Failed to download library ${lib.name}: ${err.message}`);
        }
      }
      libsDone++;
      const pct = 50 + Math.round((libsDone / libraries.length) * 30);
      onProgress?.({ stage: 'downloading_libraries', percent: pct });
    }

    onProgress?.({ stage: 'downloading_assets', percent: 80 });

    // Download asset index
    if (versionData.assetIndex) {
      const assetIndexDir = path.join(this.assetsDir, 'indexes');
      if (!fs.existsSync(assetIndexDir)) fs.mkdirSync(assetIndexDir, { recursive: true });
      const indexPath = path.join(assetIndexDir, `${versionData.assetIndex.id}.json`);
      if (!fs.existsSync(indexPath)) {
        try {
          const resp = await axios.get(versionData.assetIndex.url, { timeout: 30000 });
          fs.writeFileSync(indexPath, JSON.stringify(resp.data, null, 2));
        } catch (err) {
          console.error('Failed to download asset index:', err.message);
        }
      }
    }

    onProgress?.({ stage: 'complete', percent: 100 });
    return { success: true, versionId };
  }

  _shouldIncludeLibrary(lib) {
    if (!lib.rules) return true;
    let dominated = false;
    for (const rule of lib.rules) {
      if (rule.os) {
        const osName = process.platform === 'win32' ? 'windows'
          : process.platform === 'darwin' ? 'osx' : 'linux';
        if (rule.action === 'allow' && rule.os.name === osName) return true;
        if (rule.action === 'disallow' && rule.os.name === osName) return false;
        dominated = true;
      } else {
        if (rule.action === 'allow') dominated = false;
      }
    }
    return !dominated;
  }
}

module.exports = VersionManager;
