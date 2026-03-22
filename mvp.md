# System Architecture: Download Manager

## 1. Technology Stack

| Layer              | Technology                                         |
|:------------------ |:-------------------------------------------------- |
| Desktop Shell      | **Tauri v2** (Rust backend, system WebView)        |
| Frontend           | **React 19** + TypeScript + Tailwind CSS v4        |
| State Management   | **Zustand** (lightweight, no boilerplate)           |
| Backend / Engine   | **Rust** with `tokio` + `reqwest` + `rusqlite`     |
| Database           | **SQLite** (local, file-based persistence)          |
| IPC                | Tauri command & event system                        |
| Browser Extension  | Chrome/Firefox **WebExtension** (Manifest V3) via native messaging |

---

## 2. Architecture Overview

The application is split into four layers: Frontend, Backend Engine, Data, and External.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────────┐  │
│  │Dashboard │ │  Sidebar   │ │ Pre-Flight │ │   Settings     │  │
│  │TaskList  │ │QueuesNav  │ │   Modal    │ │     View       │  │
│  │FilterBar │ │ SpeedHUD  │ │ BatchName  │ │  ThemePicker   │  │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘ └──────┬─────────┘  │
│       └──────────────┴─────────────┴───────────────┘            │
│                         Zustand Store                           │
│                    (tasks, queues, settings)                     │
│                              │                                  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Tauri IPC ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                     BACKEND ENGINE (Rust)                        │
│                              │                                  │
│  ┌───────────────┐  ┌───────┴───────┐  ┌────────────────────┐  │
│  │  Clipboard    │  │  Worker Pool  │  │   Speed Governor   │  │
│  │  Monitor      │  │  (N workers)  │  │   (token bucket)   │  │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬──────────┘  │
│          │                  │                     │             │
│          │          ┌───────┴───────┐              │             │
│          │          │ Chunk Manager │◄─────────────┘             │
│          │          │ (Range reqs)  │                            │
│          │          └───────┬───────┘                            │
│          │          ┌───────┴───────┐  ┌────────────────────┐  │
│          │          │ File Stitcher │  │   Event Emitter    │  │
│          │          │ (.part merge) │  │ (progress → UI)    │  │
│          │          └───────────────┘  └────────────────────┘  │
│          │                                                      │
│  ┌───────┴──────────────────────────────────────────────────┐  │
│  │              Native Messaging Host                        │  │
│  │         (receives links from browser extension)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                       DATA LAYER (SQLite)                       │
│                              │                                  │
│    ┌────────┐  ┌────────┐  ┌┴───────┐  ┌──────────┐           │
│    │ tasks  │  │ queues │  │ chunks │  │ settings │           │
│    └────────┘  └────────┘  └────────┘  └──────────┘           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL                                   │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │  Browser Extension (Chrome / Firefox, Manifest V3)  │     │
│    │  ─ Intercepts downloads.onCreated                   │     │
│    │  ─ Context menu "Download with Next DM"             │     │
│    │  ─ Sends URLs via chrome.runtime.sendNativeMessage  │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Modules

### 3.1 Frontend Layer

The UI is decoupled from the download engine. It reads state and dispatches commands.

**Zustand Store** — three slices:
* `tasksSlice`: Array of task objects. Updated by Tauri events (`progress_update`, `status_change`). Provides selectors for filtered views.
* `queuesSlice`: Array of queue objects. CRUD via Tauri commands. Includes drag-reorder state.
* `settingsSlice`: Key-value map loaded from SQLite on init. Theme, default folder, speed limits, clipboard toggle.

**Key React Components:**
* `TaskDashboard` — Virtualized list (`@tanstack/react-virtual`) of task rows. Handles multi-select, bulk actions, and keyboard navigation.
* `Sidebar` — Queue navigation, category filters, Speed HUD. Handles drag-and-drop queue reordering.
* `PreFlightModal` — URL list editor + configuration panel (naming patterns, tags, folder, metadata). Sends `create_tasks` command.
* `ClipboardToast` — Listens to `clipboard_url_detected` Tauri event. Renders stacking notifications.
* `SettingsView` — Forms for all configurable options. Writes via `update_setting` commands.
* `TaskDetailPanel` — Slide-over showing chunk-level progress, transfer log, editable metadata.

### 3.2 Backend Engine Layer

All modules are Rust async tasks running on the `tokio` runtime inside Tauri.

**Clipboard Monitor Service**
* Polls the OS clipboard every 500ms using `arboard` crate.
* Matches content against a URL regex.
* Deduplicates against recently seen URLs (LRU cache, 100 entries, 30-second TTL).
* Emits `clipboard_url_detected` event to the frontend with the URL string.
* Can be toggled on/off via a setting.

**Worker Pool**
* Maintains a bounded semaphore of N permits (configurable, default 5).
* Watches the `tasks` table for rows with `status = 'queued'`, ordered by queue priority then `created_at`.
* When a permit is available, acquires it, spawns a download task, and releases on completion/error/pause.
* Respects per-queue `max_concurrent` limits as a nested semaphore.

**Chunk Manager**
* For a new task: sends a HEAD request to resolve filename, `Content-Length`, and `Accept-Ranges` support.
* If the server supports Range requests and the file is above a threshold (default 1 MB), splits into N chunks (configurable, default 8). Each chunk is a byte range.
* Spawns N async `reqwest` streams, each writing to a temporary `.part` file.
* Periodically (every 500ms) updates `chunks.downloaded_bytes` in SQLite and emits progress events.
* If the server does not support Range requests, falls back to a single-stream download.

**File Stitcher**
* Triggered when all chunks for a task reach `status = 'completed'`.
* Streams `.part` files sequentially into the final destination file using buffered I/O.
* Deletes `.part` files after successful stitching.
* Updates `tasks.status` to `'completed'` and emits a `task_completed` event.
* Triggers an OS notification via Tauri's notification API.

**Speed Governor**
* Implements a token bucket algorithm.
* Two tiers: global bucket (caps total bandwidth) and per-task bucket (caps individual task speed).
* Per-queue limits are distributed across that queue's active tasks.
* The Chunk Manager calls `governor.acquire(bytes_to_read)` before each read from the HTTP stream. If the bucket is empty, the read is delayed until tokens refill.
* Unlimited by default (bucket size = `u64::MAX`).

**Event Emitter**
* Batches progress updates and pushes them to the frontend via Tauri's `emit` API at ~10 Hz (every 100ms).
* Event payload per task: `{ id, downloaded_bytes, total_bytes, speed_bps, eta_seconds, status, chunks: [{ index, downloaded, total }] }`.
* Debounces to avoid flooding the WebView when many tasks are active.

### 3.3 Data Layer (SQLite)

#### `tasks` table

| Column            | Type         | Description                                              |
|:----------------- |:------------ |:-------------------------------------------------------- |
| `id`              | TEXT (UUID)  | Primary key                                               |
| `url`             | TEXT         | Source download URL                                       |
| `filename`        | TEXT         | Final filename (after rename patterns are applied)        |
| `original_name`   | TEXT         | Server-provided filename (from Content-Disposition / URL) |
| `save_path`       | TEXT         | Absolute directory path on disk                           |
| `status`          | TEXT         | `pending` / `queued` / `downloading` / `paused` / `completed` / `error` |
| `total_bytes`     | INTEGER      | File size from HEAD (0 if unknown)                        |
| `downloaded_bytes` | INTEGER     | Sum of all chunk progress (for resume)                    |
| `queue_id`        | TEXT (UUID)  | Foreign key to `queues.id`                                |
| `priority`        | INTEGER      | Sort order within the queue (lower = higher priority)     |
| `tags`            | TEXT (JSON)  | Array of string tags, e.g. `["lecture", "week3"]`         |
| `config`          | TEXT (JSON)  | Custom headers, referer, user-agent, auth credentials     |
| `error_message`   | TEXT         | Last error description (null if no error)                 |
| `retry_count`     | INTEGER      | Number of retries attempted                               |
| `created_at`      | TEXT (ISO)   | Timestamp of task creation                                |
| `updated_at`      | TEXT (ISO)   | Timestamp of last status change                           |

#### `queues` table

| Column            | Type         | Description                                              |
|:----------------- |:------------ |:-------------------------------------------------------- |
| `id`              | TEXT (UUID)  | Primary key                                               |
| `name`            | TEXT         | User-facing queue name                                    |
| `save_path`       | TEXT         | Default save directory for tasks in this queue            |
| `max_concurrent`  | INTEGER      | Max simultaneous downloads for this queue (0 = global)    |
| `speed_limit`     | INTEGER      | Bandwidth cap in bytes/sec for this queue (0 = unlimited) |
| `sort_order`      | INTEGER      | Display order in the sidebar                              |
| `created_at`      | TEXT (ISO)   | Timestamp                                                 |

#### `chunks` table

| Column            | Type         | Description                                              |
|:----------------- |:------------ |:-------------------------------------------------------- |
| `id`              | TEXT (UUID)  | Primary key                                               |
| `task_id`         | TEXT (UUID)  | Foreign key to `tasks.id`                                 |
| `chunk_index`     | INTEGER      | 0-based position in the chunk sequence                    |
| `start_byte`      | INTEGER      | First byte of this chunk's range                          |
| `end_byte`        | INTEGER      | Last byte of this chunk's range (inclusive)                |
| `downloaded_bytes` | INTEGER     | Bytes downloaded for this chunk so far                    |
| `status`          | TEXT         | `pending` / `downloading` / `completed` / `error`        |
| `temp_path`       | TEXT         | Absolute path to the `.part` file on disk                 |

#### `settings` table

| Column  | Type  | Description                                                     |
|:------- |:----- |:--------------------------------------------------------------- |
| `key`   | TEXT  | Setting identifier (primary key)                                |
| `value` | TEXT  | JSON-encoded value                                              |

**Default settings rows:**

| Key                    | Default Value                          |
|:---------------------- |:-------------------------------------- |
| `theme`                | `"dark"`                               |
| `custom_theme`         | `{}` (empty JSON object)               |
| `default_save_path`    | OS downloads folder                    |
| `clipboard_enabled`    | `true`                                 |
| `global_speed_limit`   | `0` (unlimited)                        |
| `max_concurrent`       | `5`                                    |
| `default_chunks`       | `8`                                    |
| `retry_count`          | `3`                                    |
| `launch_on_boot`       | `false`                                |
| `minimize_to_tray`     | `true`                                 |
| `chunk_threshold_bytes`| `1048576` (1 MB)                       |

---

## 4. Data Flow: Lifecycle of a Download

1. **Capture** — User copies `https://example.com/big-file.zip`. The **Clipboard Monitor** detects it and emits `clipboard_url_detected` to the frontend. A toast notification appears.

2. **Pre-Flight** — User clicks "Add to Queue" on the toast (or pastes URLs manually with Ctrl+V). The **Pre-Flight Modal** opens. The frontend fires a `preflight_check` Tauri command which sends a HEAD request to resolve the filename, Content-Length, and Range support. Results populate the modal.

3. **Configuration** — User optionally renames files (batch pattern), assigns tags, picks a destination folder, selects a queue, and configures metadata. Clicks "Download Now" or "Add to Queue."

4. **Task Creation** — Frontend sends a `create_tasks` Tauri command with an array of task configs. The backend writes rows to `tasks` and `chunks` tables. Tasks start with `status = 'queued'`.

5. **Execution** — The **Worker Pool** picks up queued tasks based on priority. It acquires a semaphore permit, sets `status = 'downloading'`, and hands the task to the **Chunk Manager**. The Chunk Manager spawns N async streams, each writing to a `.part` file. The **Speed Governor** throttles reads if limits are set.

6. **Progress** — Every 100ms, the **Event Emitter** pushes batched progress data to the frontend. The Zustand store updates, React re-renders the relevant task rows. SQLite is updated every 500ms for crash recovery.

7. **Completion** — All chunks finish. The **File Stitcher** merges `.part` files into the final file. SQLite updates to `status = 'completed'`. An OS notification fires. The semaphore permit is released.

8. **Error / Retry** — If a chunk fails, the Chunk Manager retries up to `retry_count` times with exponential backoff. If all retries fail, `status = 'error'` with the error message stored. The user can manually retry from the UI.

9. **Pause / Resume** — Pausing aborts active HTTP streams and saves current `downloaded_bytes` to SQLite. Resuming re-spawns chunk streams using Range headers starting from the saved offsets.

---

## 5. Batch File Naming System

### Pattern Tokens

| Token        | Resolves To                                         | Example                |
|:------------ |:--------------------------------------------------- |:---------------------- |
| `{original}` | Server-provided filename (without extension)         | `lecture-notes`        |
| `{ext}`      | File extension (including the dot)                   | `.pdf`                 |
| `{index}`    | Sequential index (respects start, step, zero-pad)    | `01`, `02`, `03`       |
| `{date}`     | Current date in `YYYY-MM-DD` format                  | `2026-03-22`           |
| `{tag}`      | First tag applied to the task (empty if no tags)     | `week3`                |
| `{queue}`    | Name of the assigned queue                           | `Lectures`             |

Free text is allowed between tokens: `{queue} - {index} - {original}{ext}` produces `Lectures - 01 - lecture-notes.pdf`.

### Index Configuration

* **Start index**: Default `1`. User can set any integer.
* **Step**: Default `1`. Allows `2` for odd-only numbering, etc.
* **Zero-padding**: Default `2` digits. User can set 1–5. Computed as `String::from(format!("{:0>pad$}", index))`.

### Application Flow

1. User enters a pattern in the Pre-Flight Modal pattern input.
2. The live preview grid shows all selected files with their computed filenames.
3. On confirmation, the computed `filename` is stored in `tasks.filename` and the original is preserved in `tasks.original_name`.
4. The Chunk Manager uses `tasks.filename` when creating the final file path.

---

## 6. Speed Limiting Architecture

### Token Bucket Algorithm

The speed governor uses a token bucket where tokens represent bytes.

* **Bucket capacity** = limit in bytes/sec (burst allowance equals 1 second of throughput).
* **Refill rate** = limit in bytes/sec, refilled continuously via `tokio::time::interval`.
* **Acquire** = before each HTTP stream read, the chunk manager calls `governor.acquire(n)` where `n` is the read buffer size. If insufficient tokens, the future sleeps until tokens are available.

### Hierarchy

```
Global Governor (caps total app bandwidth)
  └─ Per-Queue Governor (caps bandwidth for a specific queue)
       └─ Per-Task Governor (caps bandwidth for a single file)
```

Each tier is independent. The chunk manager must acquire from all applicable governors before reading. The most restrictive governor wins.

### Configuration

* **Global limit**: Set in Settings > Speed. Stored in `settings` table as `global_speed_limit` (bytes/sec, 0 = unlimited).
* **Per-queue limit**: Set via queue context menu. Stored in `queues.speed_limit`.
* **Per-task limit**: Set in Task Detail Panel. Stored in `tasks.config` JSON as `speed_limit`.
* Changes take effect immediately — the governor adjusts its refill rate on the next tick.

---

## 7. Browser Extension Architecture

### Overview

A lightweight Chrome/Firefox WebExtension communicates with the desktop app via Chrome Native Messaging.

### Extension (JavaScript, Manifest V3)

* **Background service worker**: Listens to `chrome.downloads.onCreated` events. When a download starts in the browser, the extension cancels it and forwards the URL to the native host.
* **Context menu**: Adds a "Download with Next DM" entry to the right-click menu on links and pages.
* **Popup**: A small popup showing connection status to the desktop app and a toggle to enable/disable interception.
* **Permissions**: `downloads`, `nativeMessaging`, `contextMenus`, `activeTab`.

### Native Messaging Host (Rust binary)

A small Rust executable bundled with the Tauri app installer:

* Registered in the OS native messaging manifest (`com.nextdm.host.json`) pointing to the binary path.
* Reads JSON messages from stdin (Chrome native messaging protocol: 4-byte length prefix + JSON).
* Forwards URLs to the running Tauri app via a local TCP socket or named pipe on `localhost:PORT` (port stored in a lockfile at a known path).
* If the app is not running, queues URLs in a temporary file. The app reads this file on startup.

### Communication Flow

```
Browser tab (user clicks link)
    │
    ▼
Extension service worker
    │ chrome.runtime.sendNativeMessage("com.nextdm.host", { url, referrer, cookies })
    ▼
Native Messaging Host (stdin/stdout)
    │ TCP localhost / named pipe
    ▼
Tauri Backend
    │ Creates task or emits clipboard_url_detected event
    ▼
Frontend (Pre-Flight Modal or auto-queue)
```

---

## 8. IPC Command & Event Reference

### Commands (Frontend → Backend)

| Command               | Payload                                      | Returns              |
|:---------------------- |:-------------------------------------------- |:-------------------- |
| `preflight_check`     | `{ urls: string[] }`                          | `FileInfo[]`         |
| `create_tasks`        | `{ tasks: TaskConfig[] }`                     | `string[]` (IDs)     |
| `pause_tasks`         | `{ ids: string[] }`                           | `void`               |
| `resume_tasks`        | `{ ids: string[] }`                           | `void`               |
| `cancel_tasks`        | `{ ids: string[] }`                           | `void`               |
| `retry_tasks`         | `{ ids: string[] }`                           | `void`               |
| `delete_tasks`        | `{ ids: string[] }`                           | `void`               |
| `get_all_tasks`       | `{}`                                          | `Task[]`             |
| `get_all_queues`      | `{}`                                          | `Queue[]`            |
| `create_queue`        | `{ name, save_path?, max_concurrent? }`       | `string` (ID)        |
| `update_queue`        | `{ id, ...partial fields }`                   | `void`               |
| `delete_queue`        | `{ id }`                                      | `void`               |
| `reorder_queues`      | `{ ids: string[] }` (new order)               | `void`               |
| `reorder_tasks`       | `{ queue_id, ids: string[] }` (new order)     | `void`               |
| `get_setting`         | `{ key }`                                     | `string` (JSON)      |
| `update_setting`      | `{ key, value }`                              | `void`               |
| `pick_folder`         | `{}`                                          | `string` (path)      |

### Events (Backend → Frontend)

| Event                      | Payload                                                 |
|:-------------------------- |:------------------------------------------------------- |
| `progress_update`          | `{ id, downloaded_bytes, total_bytes, speed_bps, eta_seconds, chunks }` |
| `status_change`            | `{ id, old_status, new_status, error_message? }`        |
| `task_completed`           | `{ id, filename, save_path }`                           |
| `clipboard_url_detected`   | `{ url }`                                               |
| `extension_link_received`  | `{ url, referrer?, cookies? }`                          |

---

## 9. Project Structure

```
next-dm/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs               # Tauri entry point, app setup, system tray
│   │   ├── commands/             # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── tasks.rs          # create, pause, resume, cancel, retry, delete
│   │   │   ├── queues.rs         # CRUD, reorder
│   │   │   ├── settings.rs       # get, update
│   │   │   └── preflight.rs      # HEAD requests, file info resolution
│   │   ├── engine/               # Download engine
│   │   │   ├── mod.rs
│   │   │   ├── worker_pool.rs    # Semaphore-based task scheduler
│   │   │   ├── chunk_manager.rs  # HTTP Range splitting, async stream downloads
│   │   │   ├── stitcher.rs       # .part file merging
│   │   │   └── governor.rs       # Token bucket speed limiter
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── clipboard.rs      # Clipboard polling service
│   │   │   ├── native_host.rs    # Native messaging host listener
│   │   │   └── events.rs         # Event batching and emission
│   │   └── db/
│   │       ├── mod.rs
│   │       ├── schema.rs         # Table creation, migrations
│   │       ├── tasks.rs          # Task CRUD queries
│   │       ├── queues.rs         # Queue CRUD queries
│   │       ├── chunks.rs         # Chunk CRUD queries
│   │       └── settings.rs       # Settings CRUD queries
│   └── migrations/
│       └── 001_initial.sql       # Initial schema
│
├── src/                          # React frontend
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component, routing, theme loader
│   ├── stores/
│   │   ├── tasksStore.ts         # Zustand tasks slice
│   │   ├── queuesStore.ts        # Zustand queues slice
│   │   └── settingsStore.ts      # Zustand settings slice
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TaskStage.tsx
│   │   │   └── TitleBar.tsx      # Custom draggable title bar
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx       # Virtualized list
│   │   │   ├── TaskRow.tsx        # Individual task row
│   │   │   ├── TaskDetailPanel.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── BulkActionBar.tsx
│   │   ├── queues/
│   │   │   ├── QueueList.tsx
│   │   │   ├── QueueItem.tsx
│   │   │   └── QueueContextMenu.tsx
│   │   ├── modals/
│   │   │   └── PreFlightModal.tsx
│   │   ├── notifications/
│   │   │   └── ClipboardToast.tsx
│   │   ├── settings/
│   │   │   ├── SettingsView.tsx
│   │   │   ├── SpeedLimiter.tsx
│   │   │   └── ThemeSwitcher.tsx
│   │   └── shared/
│   │       ├── ProgressBar.tsx
│   │       ├── SpeedHUD.tsx
│   │       ├── FolderPicker.tsx
│   │       ├── TagInput.tsx
│   │       ├── PatternInput.tsx
│   │       └── Button.tsx
│   ├── hooks/
│   │   ├── useTauriEvents.ts     # Subscribe to backend events
│   │   ├── useTauriCommand.ts    # Invoke backend commands
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/
│   │   ├── formatters.ts         # Byte formatting, ETA formatting
│   │   ├── naming.ts             # Batch rename pattern resolver
│   │   └── constants.ts
│   └── styles/
│       ├── theme.css             # CSS variable definitions (dark, light, custom)
│       └── globals.css           # Tailwind directives, font imports, base resets
│
├── extension/                    # Browser extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js             # Service worker: download interception, native messaging
│   ├── popup.html
│   ├── popup.js                  # Connection status, toggle
│   └── icons/
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── design.md
└── mvp.md
```

---

## 10. Implementation Milestones

### M1 — Skeleton (Week 1)

**Goal:** Tauri app boots, shows a React window, and lives in the system tray.

* Initialize Tauri v2 project with React + TypeScript template.
* Set up Tailwind CSS v4, import fonts (Inter, Manrope, JetBrains Mono).
* Configure Zustand with the three store slices (empty initial state).
* Create the app shell: custom title bar, sidebar placeholder, task stage placeholder.
* Set up system tray with "Show/Hide" and "Quit" menu items.
* Create `theme.css` with all CSS variables for dark and light themes.
* Verify IPC works with a hello-world Tauri command.

### M2 — Engine Core (Weeks 2–3)

**Goal:** Rust engine can download a file using chunked Range requests and persist to SQLite.

* Create SQLite schema (`tasks`, `queues`, `chunks`, `settings` tables) with the initial migration.
* Implement `preflight_check` command: HEAD request, resolve filename and Content-Length.
* Implement the Chunk Manager: split file into N ranges, spawn async `reqwest` streams, write `.part` files.
* Implement the File Stitcher: merge `.part` files into the final file.
* Implement basic Worker Pool: single-queue, semaphore-based concurrency (default 5).
* Implement the Event Emitter: batch progress updates at 10 Hz and emit to the frontend.
* Wire up `create_tasks`, `pause_tasks`, `resume_tasks`, `cancel_tasks` commands.
* Verify: paste a URL in a dev input, download completes, `.part` files clean up, final file is correct.

### M3 — UI Shell (Week 4)

**Goal:** The dashboard renders real task data from the engine with progress bars.

* Build `TaskList` with `@tanstack/react-virtual` for virtualized rendering.
* Build `TaskRow` with: file icon, filename, progress bar (gradient + pulse), speed, ETA, status badge, action buttons.
* Build `FilterBar` with tabs (All / Downloading / Queued / Completed / Errored) and search input.
* Build `Sidebar` shell: queue list placeholder, category filter placeholders.
* Build `SpeedHUD` widget: aggregate speed, active count, sparkline placeholder.
* Connect Zustand stores to Tauri events (`progress_update`, `status_change`).
* Apply the full design system: surface hierarchy, typography scale, no-line rule, glass effects.
* Theme switcher (dark/light toggle) working via CSS variables.

### M4 — Queue System (Week 5)

**Goal:** Named queues with per-queue concurrency, drag-to-reorder, and folder defaults.

* Implement queue CRUD commands (`create_queue`, `update_queue`, `delete_queue`, `reorder_queues`).
* Build `QueueList` and `QueueItem` components with drag-and-drop (use `@dnd-kit/core`).
* Per-queue context menu: rename, set folder, set speed limit, pause/resume all, delete.
* Task reordering within a queue via drag-and-drop.
* "Move to Queue" action in bulk-action toolbar.
* Update Worker Pool to respect per-queue `max_concurrent` limits.
* Auto-generated category filters (Video, Audio, Docs, Archives, Images, Other) based on file extension.

### M5 — Clipboard & Pre-Flight (Week 6)

**Goal:** Clipboard monitoring, toast notifications, and the full Pre-Flight Modal.

* Implement the Clipboard Monitor Service in Rust (`arboard` crate, 500ms polling, URL regex, dedup LRU).
* Build `ClipboardToast` component: stacking notifications, auto-dismiss, "Add" / "Download Now" actions.
* Build the full `PreFlightModal`:
  - URL list with resolved filenames and sizes (from `preflight_check`).
  - Batch rename `PatternInput` with token autocomplete and live preview grid.
  - `TagInput` chip component.
  - `FolderPicker` with OS dialog + recent folders dropdown.
  - Queue selector dropdown.
  - Metadata section (headers, referer, user-agent).
* Implement the batch naming resolver in `lib/naming.ts` (apply tokens, index config).
* Wire Ctrl+V to open Pre-Flight with pasted URLs.

### M6 — Speed Limiting & Settings (Week 7)

**Goal:** Token bucket speed governor and the full Settings view.

* Implement the token bucket governor in Rust (`governor` module): global, per-queue, and per-task tiers.
* Build `SpeedLimiter` component (slider + numerical input + unit toggle).
* Build the full `SettingsView`: General, Downloads, Speed, Appearance, Browser Extension, About sections.
* Integrate the Speed Governor with the Chunk Manager (acquire before each stream read).
* "Capped" indicator in the Speed HUD when any limit is active.
* Implement `get_setting` / `update_setting` commands. Settings changes take effect immediately.
* `TaskDetailPanel` per-task speed limit override.

### M7 — Browser Extension (Week 8)

**Goal:** Chrome extension intercepts downloads and sends them to the desktop app.

* Build the Manifest V3 extension: background service worker, popup, context menu.
* Build the Native Messaging Host: small Rust binary that reads Chrome's native messaging protocol from stdin.
* Register the native messaging host manifest on the system during app install.
* Implement localhost TCP socket in the Tauri backend for receiving URLs from the native host.
* Connection status indicator in the extension popup and in Settings > Browser Extension.
* "Test Connection" button in Settings.
* Handle the case where the app is not running: native host queues URLs in a temp file, app reads on startup.

### M8 — Polish (Week 9)

**Goal:** Theming, animations, keyboard shortcuts, and edge-case handling.

* Custom theme editor: color pickers for core tokens, live preview, JSON import/export.
* Implement all keyboard shortcuts from the design system.
* Add all animations: progress pulse, toast entrance/exit, modal transitions, panel slide-over, list item enter.
* Multi-select: Ctrl+Click, Shift+Click, Ctrl+A, bulk-action toolbar.
* Error states: network failures, disk full, permission denied, invalid URLs. Retry with exponential backoff.
* Resume after app crash: on startup, scan for tasks with `status = 'downloading'` and reset to `queued`.
* Launch-on-boot option (OS-specific: Windows registry, macOS launchd, Linux autostart).
* Sparkline chart in the Speed HUD (SVG path, last 60 seconds).
* Final design QA pass: verify every component against both themes, spacing, typography, motion.

---

## 11. Future Scope (Post-MVP)

These features are explicitly deferred:

* **Video/media extraction** (YouTube, etc.) — requires integrating `yt-dlp` or similar.
* **Advanced scheduling** — download at specific times, bandwidth scheduling by time of day.
* **Download history & statistics** — charts, total downloaded, monthly breakdown.
* **Checksum verification** — MD5/SHA256 verification against known hashes.
* **Mirror/fallback URLs** — try alternate URLs if the primary fails.
* **Torrent/magnet support** — would require a BitTorrent library.
* **Cloud sync** — sync queue state across devices.
