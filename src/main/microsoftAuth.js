const { BrowserWindow } = require('electron');
const axios = require('axios');

const AZURE_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
const REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const SCOPES = 'XboxLive.signin offline_access';

class MicrosoftAuth {
  async authenticate(parentWindow) {
    const authCode = await this._getAuthCode(parentWindow);
    if (!authCode) return null;

    // Exchange code for Microsoft token
    const msToken = await this._exchangeCodeForToken(authCode);

    // Authenticate with Xbox Live
    const xblToken = await this._authenticateXboxLive(msToken.access_token);

    // Get XSTS token
    const xstsToken = await this._getXSTSToken(xblToken.Token);

    // Authenticate with Minecraft
    const mcToken = await this._authenticateMinecraft(
      xstsToken.DisplayClaims.xui[0].uhs,
      xstsToken.Token
    );

    // Get Minecraft profile
    const profile = await this._getMinecraftProfile(mcToken.access_token);

    return {
      username: profile.name,
      uuid: profile.id,
      accessToken: mcToken.access_token,
      refreshToken: msToken.refresh_token,
      skinUrl: profile.skins?.[0]?.url || null,
    };
  }

  _getAuthCode(parentWindow) {
    return new Promise((resolve) => {
      const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?`
        + `client_id=${AZURE_CLIENT_ID}`
        + `&response_type=code`
        + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
        + `&scope=${encodeURIComponent(SCOPES)}`
        + `&response_mode=query`;

      const authWindow = new BrowserWindow({
        width: 520,
        height: 680,
        parent: parentWindow,
        modal: true,
        show: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      authWindow.loadURL(authUrl);

      authWindow.webContents.on('will-redirect', (event, url) => {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const error = parsed.searchParams.get('error');
        if (code || error) {
          authWindow.close();
          resolve(code || null);
        }
      });

      authWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(REDIRECT_URI)) {
          const parsed = new URL(url);
          const code = parsed.searchParams.get('code');
          authWindow.close();
          resolve(code || null);
        }
      });

      authWindow.on('closed', () => resolve(null));
    });
  }

  async _exchangeCodeForToken(code) {
    const resp = await axios.post(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return resp.data;
  }

  async _authenticateXboxLive(accessToken) {
    const resp = await axios.post(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
    return resp.data;
  }

  async _getXSTSToken(xblToken) {
    const resp = await axios.post(
      'https://xsts.auth.xboxlive.com/xsts/authorize',
      {
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [xblToken],
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
    return resp.data;
  }

  async _authenticateMinecraft(userHash, xstsToken) {
    const resp = await axios.post(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return resp.data;
  }

  async _getMinecraftProfile(accessToken) {
    const resp = await axios.get(
      'https://api.minecraftservices.com/minecraft/profile',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return resp.data;
  }
}

module.exports = MicrosoftAuth;
