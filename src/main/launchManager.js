const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LaunchManager {
  constructor(dataDir, versionsDir, assetsDir) {
    this.dataDir = dataDir;
    this.versionsDir = versionsDir;
    this.assetsDir = assetsDir;
    this.libsDir = path.join(dataDir, 'libraries');
  }

  async launch(instance, account, onEvent) {
    const versionJsonPath = path.join(this.versionsDir, instance.version, `${instance.version}.json`);
    if (!fs.existsSync(versionJsonPath)) {
      throw new Error(`Version ${instance.version} is not installed. Please install it first.`);
    }

    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    const clientJar = path.join(this.versionsDir, instance.version, `${instance.version}.jar`);

    if (!fs.existsSync(clientJar)) {
      throw new Error(`Client JAR not found for ${instance.version}`);
    }

    onEvent?.({ type: 'status', message: 'Building classpath...' });

    // Build classpath
    const cpSep = process.platform === 'win32' ? ';' : ':';
    const classpath = this._buildClasspath(versionData, clientJar, cpSep);

    // Build game arguments
    const gameDir = instance.gameDir || path.join(this.dataDir, 'instances', 'default');
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

    const mainClass = versionData.mainClass;
    const jvmArgs = (instance.jvmArgs || '-Xmx2G -Xms512M').split(' ').filter(Boolean);

    // Build game args
    const gameArgs = this._buildGameArgs(versionData, {
      username: account.username,
      uuid: account.uuid,
      accessToken: account.accessToken,
      userType: account.type === 'microsoft' ? 'msa' : 'legacy',
      versionName: instance.version,
      gameDir: gameDir,
      assetsDir: this.assetsDir,
      assetIndex: versionData.assetIndex?.id || versionData.assets || 'legacy',
      versionType: versionData.type || 'release',
    });

    const nativesDir = path.join(this.versionsDir, instance.version, 'natives');
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

    const fullArgs = [
      ...jvmArgs,
      `-Djava.library.path=${nativesDir}`,
      '-cp', classpath,
      mainClass,
      ...gameArgs,
    ];

    onEvent?.({ type: 'status', message: `Launching Minecraft ${instance.version}...` });

    const settingsFile = path.join(this.dataDir, 'settings.json');
    let javaPath = 'java';
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      javaPath = settings.javaPath || 'java';
    }

    const proc = spawn(javaPath, fullArgs, {
      cwd: gameDir,
      detached: true,
    });

    proc.stdout?.on('data', (data) => {
      onEvent?.({ type: 'log', message: data.toString() });
    });

    proc.stderr?.on('data', (data) => {
      onEvent?.({ type: 'error', message: data.toString() });
    });

    proc.on('close', (code) => {
      onEvent?.({ type: 'exit', code });
    });

    proc.on('error', (err) => {
      onEvent?.({ type: 'error', message: err.message });
    });

    proc.unref();
  }

  _buildClasspath(versionData, clientJar, sep) {
    const paths = [];
    for (const lib of (versionData.libraries || [])) {
      if (!this._shouldInclude(lib)) continue;
      const artifact = lib.downloads?.artifact;
      if (!artifact) continue;
      const libPath = path.join(this.libsDir, artifact.path);
      if (fs.existsSync(libPath)) paths.push(libPath);
    }
    paths.push(clientJar);
    return paths.join(sep);
  }

  _shouldInclude(lib) {
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

  _buildGameArgs(versionData, opts) {
    // Modern versions use arguments.game array
    if (versionData.arguments?.game) {
      const args = [];
      for (const arg of versionData.arguments.game) {
        if (typeof arg === 'string') {
          args.push(this._replaceArg(arg, opts));
        }
      }
      return args;
    }
    // Legacy versions use minecraftArguments string
    if (versionData.minecraftArguments) {
      return versionData.minecraftArguments.split(' ').map(a => this._replaceArg(a, opts));
    }
    return [];
  }

  _replaceArg(arg, opts) {
    return arg
      .replace('${auth_player_name}', opts.username)
      .replace('${version_name}', opts.versionName)
      .replace('${game_directory}', opts.gameDir)
      .replace('${assets_root}', opts.assetsDir)
      .replace('${assets_index_name}', opts.assetIndex)
      .replace('${auth_uuid}', opts.uuid)
      .replace('${auth_access_token}', opts.accessToken)
      .replace('${user_type}', opts.userType)
      .replace('${version_type}', opts.versionType)
      .replace('${auth_session}', opts.accessToken)
      .replace('${game_assets}', path.join(opts.assetsDir, 'virtual', 'legacy'))
      .replace('${user_properties}', '{}');
  }
}

module.exports = LaunchManager;
