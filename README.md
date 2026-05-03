# VortyMC Launcher

A sleek, modern Minecraft launcher with a purple and black neon aesthetic.

![VortyMC Launcher](https://img.shields.io/badge/VortyMC-Launcher-purple?style=for-the-badge)

## Features

- **Neon Purple & Black UI** — Professional, modern design with smooth animations and glow effects
- **Offline / Local Accounts** — Play with an offline username without needing a Microsoft account
- **Microsoft Account Login** — Sign in with your Microsoft account to use your own skins and access online servers
- **Create Custom Instances** — Build your own Minecraft setups with any version from Beta 1.7.3 to the latest release
- **Version Manager** — Browse, search, and install any Minecraft version (releases, snapshots, beta, alpha)
- **One-Click Launch** — Select an instance and hit Play — the launcher handles downloading and launching
- **JVM Customization** — Configure Java path, memory allocation, and JVM arguments per instance
- **Multi-Instance Support** — Create and manage multiple Minecraft instances with different versions and configs

## Screenshots

The launcher features a dark theme with purple neon accents, glowing buttons, and smooth page transitions.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v8+
- Java 8+ (for running Minecraft)

### Installation

```bash
# Clone the repository
git clone https://github.com/VortyYT/VortyMC-Launcher.git
cd VortyMC-Launcher

# Install dependencies
npm install

# Run the launcher
npm start
```

### Building

```bash
# Build for your platform
npm run build
```

## Tech Stack

- **Electron** — Cross-platform desktop framework
- **Vanilla JS** — No heavy frameworks, fast and lightweight
- **CSS3** — Custom neon theme with animations and glassmorphism
- **Mojang API** — Version manifest and game downloads
- **Microsoft Auth (MSAL)** — Xbox Live / Minecraft authentication flow

## Project Structure

```
VortyMC-Launcher/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.js           # App entry, window, IPC
│   │   ├── preload.js        # Context bridge
│   │   ├── accountManager.js # Account CRUD
│   │   ├── versionManager.js # Version downloads
│   │   ├── launchManager.js  # Game launching
│   │   └── microsoftAuth.js  # MS auth flow
│   └── renderer/       # UI (HTML/CSS/JS)
│       ├── index.html
│       ├── css/
│       └── js/
├── assets/             # Icons and images
├── package.json
└── README.md
```

## License

MIT

## Credits

Built by **VortyYT**
