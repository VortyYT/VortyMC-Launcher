# VortyMC Launcher

A sleek, professional Minecraft launcher with a purple/black neon aesthetic.

![VortyMC](https://img.shields.io/badge/VortyMC-Launcher-7c3aed?style=for-the-badge)

## Features

- **Play** — Launch any Minecraft version from Beta 1.7.3 to the latest release
- **Create** — Build custom Minecraft launch profiles with custom JVM & game arguments
- **Offline Accounts** — Play locally without a Microsoft account
- **Microsoft Login** — Connect your Microsoft account for skins and online play
- **Version Manager** — Download, install, and manage Minecraft versions
- **Neon UI** — Professional purple/black theme with glowing neon accents

## Tech Stack

- **Electron** — Cross-platform desktop app
- **React 18** — Modern UI framework
- **TypeScript** — Type-safe code
- **Vite** — Fast development and builds

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Java 17+ (for running Minecraft)

### Install

```bash
npm install
```

### Development

```bash
# Build and run
npm start

# Or run renderer dev server (for UI development)
npm run dev:renderer
```

### Build

```bash
npm run build
```

## Project Structure

```
VortyMC-Launcher/
├── src/
│   ├── main/           # Electron main process
│   │   └── main.ts     # App entry, IPC handlers, game launcher
│   └── renderer/       # React frontend
│       ├── components/ # Reusable UI components
│       ├── pages/      # Page components
│       ├── styles/     # Global CSS
│       ├── App.tsx     # Root component
│       └── main.tsx    # React entry point
├── package.json
├── tsconfig.json
├── tsconfig.main.json
└── vite.config.ts
```

## Accounts

### Offline
Create a local account with any username for singleplayer and LAN play.

### Microsoft
Sign in with your Microsoft account for online play, skins, and capes. Requires Azure App registration for OAuth flow.

## License

MIT
