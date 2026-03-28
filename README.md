# Next DM

A high-performance desktop download manager with **video platform support**, built with **Tauri v2**, **React 19**, and **Rust**.

Download videos from **YouTube, Facebook, Instagram, TikTok, Twitter/X**, and **1800+ platforms** via yt-dlp integration.

## Downloads

| Platform | File | Notes |
| :------- | :--- | :---- |
| Windows (x64) | [`next-dm_0.2.0_x64-setup.exe`](https://github.com/MostafaSalama/next-dm/releases/latest) | NSIS installer |
| Windows (x64) | [`next-dm_0.2.0_x64_en-US.msi`](https://github.com/MostafaSalama/next-dm/releases/latest) | MSI installer |
| macOS (Apple Silicon) | [`next-dm_0.2.0_aarch64.dmg`](https://github.com/MostafaSalama/next-dm/releases/latest) | DMG image |
| macOS (Intel) | [`next-dm_0.2.0_x64.dmg`](https://github.com/MostafaSalama/next-dm/releases/latest) | DMG image |
| Linux (x64) | [`next-dm_0.2.0_amd64.deb`](https://github.com/MostafaSalama/next-dm/releases/latest) | Debian/Ubuntu |
| Linux (x64) | [`next-dm_0.2.0_amd64.AppImage`](https://github.com/MostafaSalama/next-dm/releases/latest) | Portable AppImage |

> All binaries are built via `npm run tauri build`. See [Building](#building) below.

## Screenshots

| Downloads & Queues | Queue Actions |
|---|---|
| ![Downloads view showing queued and completed tasks](screenshots/queued-downloaded.png) | ![Queue context menu with actions like pause, rename, clear](screenshots/queue-actions.png) |

| Task List & Bulk Actions | Archive |
|---|---|
| ![Main task list with status filters and bulk action bar](screenshots/queue-page.png) | ![Archive view with restore and delete options](screenshots/archive-items.png) |

| Settings — General & Downloads | Settings — Appearance & Shortcuts |
|---|---|
| ![Settings page showing save folder, clipboard, and download options](screenshots/settings.png) | ![Theme switcher, speed limiter, and keyboard shortcuts](screenshots/settings2.png) |

## Features

### File Downloads
- **Chunked / multi-part downloads** with resume support via HTTP Range requests
- **Multiple download queues** with per-queue concurrency limits and speed caps
- **Clipboard monitoring** — automatically detects copied URLs and offers to add them
- **Pre-flight modal** — configure filenames, tags, save folder, and queue before starting
- **Batch file naming** — token-based patterns (`{original}`, `{index}`, custom text)
- **Global speed limiter** — token-bucket algorithm keeps bandwidth in check

### Video Downloads (New in v0.2.0)
- **YouTube, Facebook, Instagram, TikTok, Twitter/X** and 1800+ platforms via yt-dlp
- **Playlist support** — extract full playlists, select individual videos to download
- **Quality selection** — Best, 4K, 1080p, 720p, 480p, 360p, Audio Only
- **Format selection** — MP4, MKV, WebM, MP3, M4A
- **Subtitle download** — select languages, embed into video
- **Video pre-flight modal** — thumbnail preview, format details, quality picker
- **Auto binary management** — download and update yt-dlp & FFmpeg from Settings
- **Video metadata in task list** — thumbnails, duration badges, resolution, platform icons

### Organization & UI
- **Category filtering** — video, audio, documents, archives, images, programs
- **Status filtering** — downloading, completed, queued, paused, errored
- **Drag-and-drop queue reordering**
- **Archive** — move old downloads out of the main view, restore or delete later
- **Dark / Light / Custom themes** with CSS-variable-based theming
- **Settings persistence** in SQLite
- **Open folder** for completed downloads
- **Unicode support** — proper display of Arabic, CJK, and other non-Latin filenames

## Tech Stack

| Layer            | Technology                                       |
| :--------------- | :----------------------------------------------- |
| Desktop Shell    | Tauri v2 (Rust backend, system WebView)          |
| Frontend         | React 19 + TypeScript + Tailwind CSS v4          |
| State Management | Zustand                                          |
| Backend Engine   | Rust — `tokio` + `reqwest` + `rusqlite`          |
| Video Engine     | yt-dlp (subprocess) + FFmpeg                     |
| Database         | SQLite (local, file-based)                       |
| IPC              | Tauri command & event system                     |

## Prerequisites

- **Node.js** >= 18
- **Rust** >= 1.77
- **MSVC Build Tools** (Windows) or equivalent C toolchain

For video downloads, **yt-dlp** and **FFmpeg** are managed automatically from within the app (Settings > Video Downloads).

## Getting Started

```bash
# Install frontend dependencies
npm install

# Run in development mode (starts both Vite dev server and Tauri)
npm run tauri dev
```

## Building

```bash
# Build production binaries for your platform
npm run tauri build
```

Output locations after build:

| Platform | Output Path |
| :------- | :---------- |
| Windows  | `src-tauri/target/release/bundle/nsis/next-dm_0.2.0_x64-setup.exe` |
| Windows  | `src-tauri/target/release/bundle/msi/next-dm_0.2.0_x64_en-US.msi` |
| macOS    | `src-tauri/target/release/bundle/dmg/next-dm_0.2.0_*.dmg` |
| Linux    | `src-tauri/target/release/bundle/deb/next-dm_0.2.0_*.deb` |
| Linux    | `src-tauri/target/release/bundle/appimage/next-dm_0.2.0_*.AppImage` |

To build for a specific target only:

```bash
# Windows NSIS only
npm run tauri build -- --bundles nsis

# macOS DMG only
npm run tauri build -- --bundles dmg

# Linux AppImage only
npm run tauri build -- --bundles appimage
```

## Project Structure

```
next-dm/
├── src/                    # React frontend
│   ├── components/
│   │   ├── layout/         # TitleBar, Sidebar, TaskStage, SpeedHUD
│   │   ├── tasks/          # TaskList, TaskRow, FilterBar, AddUrlBar
│   │   ├── sidebar/        # QueueList, QueueItem, QueueContextMenu
│   │   ├── modals/         # PreFlightModal, VideoPreFlightModal
│   │   ├── notifications/  # ClipboardToast
│   │   ├── settings/       # SettingsView, SpeedLimiter, ThemeSwitcher
│   │   └── shared/         # PatternInput, TagInput, FolderPicker
│   ├── stores/             # Zustand stores (tasks, queues, settings)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities (formatters, file icons, platformDetect)
│   └── styles/             # Global CSS & theme variables
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # IPC handlers (tasks, queues, settings, video)
│   │   ├── db/             # SQLite schema, migrations, CRUD
│   │   ├── engine/         # Download engine, worker pool, video downloader
│   │   └── services/       # Clipboard monitor, event emitter, binary manager
│   └── migrations/         # SQL migration files
└── package.json
```

## Changelog

### v0.2.0 — Video Platform Downloads

- Added video downloading from YouTube, Facebook, Instagram, TikTok, Twitter/X, and 1800+ platforms
- Added yt-dlp and FFmpeg binary manager (auto-download, version check, update)
- Added Video PreFlight modal with thumbnail, quality/format picker, subtitle selection
- Added full playlist extraction and per-video selection
- Added video metadata display in task rows (thumbnails, duration, resolution, platform)
- Added platform URL detection in clipboard and paste handler
- Added Video Downloads section in Settings
- Added database migration for video settings

### v0.1.0 — Initial Release

- Multi-part chunked downloads with HTTP Range support
- Multiple download queues with concurrency and speed limits
- Clipboard URL monitoring with toast notifications
- Pre-flight modal with batch naming patterns
- Global speed limiter (token-bucket algorithm)
- Category and status filtering
- Drag-and-drop queue reordering
- Archive view for old downloads
- Dark / Light theme support
- SQLite settings persistence
- Unicode filename support (Arabic, CJK, etc.)

## Author

**Mostafa Tourad** — [GitHub](https://github.com/MostafaSalama/)

## License

MIT
