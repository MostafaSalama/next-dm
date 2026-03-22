# Design System: High-Performance Desktop Interface

## 1. Overview & Creative North Star: "The Kinetic Observatory"

This design system moves away from the static, boxy nature of traditional utility software. Our Creative North Star is **"The Kinetic Observatory"** — an interface that feels like a high-precision instrument orbiting in deep space.

To achieve a "High-End Editorial" feel for a technical tool, we bypass the standard "table-and-sidebar" grid. Instead, we utilize **Intentional Asymmetry** and **Tonal Depth**. The UI should feel like a single, cohesive piece of hardware where data doesn't just sit on the screen; it lives within layers of translucent, midnight-toned glass. We replace harsh dividers with breathing room (using our `Spacing Scale`) and hierarchy with `Surface Tiering`.

---

## 2. Screen & View Inventory

The application is composed of five primary views and two overlay layers.

### 2.1 Main Dashboard

The default view. A single-page layout split into two regions:

* **Left — Sidebar** (fixed width, ~260px): Queue navigation, category filters, the Speed HUD widget, and storage stats.
* **Right — Task Stage** (fluid): A virtualized list of download tasks. Each task row shows: file icon, file name, progress bar, speed, ETA, status badge, and action buttons (pause/resume/cancel). Above the list sits a **filter bar** with tabs: All | Downloading | Queued | Completed | Errored. A search input and bulk-action toolbar appear when tasks are selected.

### 2.2 Sidebar

The sidebar is not a flat navigation menu. It is a layered panel on `surface-container-low`.

* **Queues section** (top): Collapsible groups — each queue shows its name, a colored dot, a task count badge, and a drag handle. An inline "+" button creates a new queue. Right-click opens a context menu (rename, set folder, set speed limit, delete).
* **Categories section** (middle): Auto-generated categories based on file type — Video, Audio, Documents, Archives, Images, Other. Each shows a count. Clicking filters the task stage.
* **Speed HUD** (bottom, pinned): Glassmorphic widget showing aggregate download speed in `display-sm` Manrope, active task count, and a mini sparkline of the last 60 seconds of throughput.
* **Storage Stats** (below HUD): A thin segmented bar showing disk usage of the default save folder, with free space in `body-sm`.

### 2.3 Pre-Flight Modal

Opens when the user pastes URLs or when the clipboard monitor detects links and the user clicks "Add to Queue." This is the configuration hub before downloading begins.

* **URL list** (left column): All pending URLs in an editable list. Each row shows the resolved filename (from HEAD response), file size, and a status icon (valid / checking / error). Rows are selectable for batch operations.
* **Configuration panel** (right column):
  - **File naming**: Pattern input with token autocomplete (`{original}`, `{index}`, `{ext}`, `{date}`, `{tag}`, `{queue}`) and a live preview grid showing the resulting filenames for all selected URLs.
  - **Tags**: Chip input — type a tag and press Enter to add. Tags are stored per-task and appear as filterable labels in the dashboard.
  - **Destination folder**: Folder picker button (triggers OS-native dialog) + a dropdown of recent folders. Per-task override available.
  - **Queue assignment**: Dropdown to select which queue these tasks join.
  - **Metadata**: Expandable section for custom HTTP headers, Referer, User-Agent, and basic auth credentials.
* **Footer**: "Download Now" (primary), "Add to Queue" (secondary), "Cancel" (ghost).

### 2.4 Clipboard Toast Notification

A floating notification that appears in the bottom-right corner of the window when the Clipboard Monitor detects a copied URL.

* **Content**: Truncated URL preview (monospace, `body-sm`), resolved filename and file size if HEAD completes fast enough.
* **Actions**: Two buttons — "Add to Queue" (opens Pre-Flight) and "Download Now" (uses default queue and folder). A small "x" dismiss button.
* **Behavior**: Auto-dismisses after 8 seconds. Stacks vertically if multiple links are copied in quick succession (max 3 visible, with a "+N more" indicator).

### 2.5 Settings View

Accessible from a gear icon in the sidebar header. Replaces the task stage area (does not open a modal — feels integrated).

* **General**: Default save folder (folder picker), startup behavior (launch on boot, minimize to tray), clipboard monitoring toggle.
* **Downloads**: Default chunk count (slider: 1–32), max concurrent tasks (slider: 1–20), retry count on failure.
* **Speed**: Global speed limit (slider + numerical input with unit toggle KB/s / MB/s), per-queue default limits.
* **Appearance**: Theme switcher (Dark / Light / Custom) with live preview swatches. Custom theme opens a panel with color pickers for the primary token set.
* **Browser Extension**: Connection status indicator, instructions for installing the extension, and a "Test Connection" button.
* **About**: Version, update check, links.

### 2.6 Task Detail Panel

A slide-over panel that opens from the right edge when a task row is clicked or expanded.

* **Header**: Full filename, full URL (copyable), status badge, total size.
* **Chunk progress**: A stacked bar or segmented visualization showing each chunk's individual progress. Each segment is labeled with its byte range and current speed.
* **Transfer log**: A scrollable monospace log showing chunk start/complete events, retries, and errors.
* **Metadata**: Tags, custom headers, assigned queue, save path — all editable inline.
* **Actions**: Pause, Resume, Cancel, Retry, Open File, Open Folder, Copy URL.

---

## 3. Colors: Depth Over Definition

Our palette is rooted in the "Deep Blue" spectrum, shifting from the void of the background to the luminescence of the data.

### The "No-Line" Rule

**Prohibit 1px solid borders for sectioning.** To separate the sidebar from the main stage, do not draw a line. Instead, use a background shift from `surface` (#041329) to `surface-container-low` (#0D1C32). The eye should perceive the change in depth, not a mechanical boundary.

### Surface Hierarchy & Nesting

Treat the UI as a physical stack.

* **Base Layer:** `surface` (#041329) for the global backdrop.
* **Secondary Stage:** `surface-container-low` (#0D1C32) for the sidebar.
* **Active Workspaces:** `surface-container-high` (#1C2A41) for the main download list.
* **Floating Inspect Panels:** `surface-container-highest` (#27354C) to signify temporary prominence.

### The "Glass & Gradient" Rule

Standard buttons are too "web-template." For our primary actions and progress states, use `primary-fixed-dim` (#38DEBB) with a 15% `surface-tint` overlay. Floating elements, such as speed-monitoring tooltips, must use **Glassmorphism**: `surface-variant` at 60% opacity with a `20px` backdrop-blur.

### Status Colors

| Status        | Token                  | Hex       | Usage                              |
|:------------- |:---------------------- |:--------- |:---------------------------------- |
| Downloading   | `primary-fixed-dim`    | `#38DEBB` | Active progress bar, speed readout |
| Completed     | `primary-fixed`        | `#5FFBD6` | Completed badge, checkmark icon    |
| Queued        | `secondary`            | `#BCC6E6` | Queued badge, idle indicators      |
| Paused        | `on-surface-variant`   | `#BACAC3` | Paused badge, dimmed progress bar  |
| Error         | `error`                | `#FFB4AB` | Error badge, retry prompt          |
| Pending       | `outline-variant`      | `#3C4A45` | Ghost state, not yet started       |

---

## 4. Typography: Technical Elegance

We pair the structural precision of **Inter** with the editorial character of **Manrope**.

* **Display & Headlines (Manrope):** Used for "Hero Data" (total download speed, disk space, aggregate progress). Large, confident, spaced with `tracking-tighter`.
* **Title & Body (Inter):** Used for file names and technical metadata. Inter's tall x-height ensures readability even at `body-sm` (0.75rem) when viewing dense transfer logs.
* **Labels (Inter):** All-caps with `0.05rem` letter spacing for "Status" or "Category" tags to provide a refined, architectural feel.
* **Monospace (JetBrains Mono):** Used for URLs, file paths, byte ranges, and the transfer log. `body-sm` size with reduced line-height for density.

### Type Scale

| Token        | Font     | Size     | Weight | Use Case                        |
|:------------ |:-------- |:-------- |:------ |:------------------------------- |
| `display-lg` | Manrope  | 2.25rem  | 800    | Hero speed readout              |
| `display-sm` | Manrope  | 1.5rem   | 700    | Speed HUD, aggregate stats      |
| `title-lg`   | Inter    | 1.25rem  | 600    | Section headings, modal titles  |
| `title-sm`   | Inter    | 1rem     | 600    | Queue names, settings headers   |
| `body-md`    | Inter    | 0.875rem | 400    | File names, primary text        |
| `body-sm`    | Inter    | 0.75rem  | 400    | Metadata, ETA, secondary info   |
| `label-md`   | Inter    | 0.75rem  | 500    | Status badges, filter tabs      |
| `label-sm`   | Inter    | 0.625rem | 500    | Chunk labels, timestamps        |
| `mono-md`    | JetBrains Mono | 0.8rem | 400 | URLs, file paths                |
| `mono-sm`    | JetBrains Mono | 0.7rem | 400 | Transfer log, byte ranges       |

---

## 5. Elevation & Depth: Tonal Layering

We do not use drop shadows to create "pop." We use light and opacity to create "presence."

* **The Layering Principle:** A download card (on `surface-container-low`) should not have a shadow. Instead, give it a slightly lighter background (`surface-container-highest`) to create a soft, natural lift.
* **Ambient Shadows:** For modal dialogs (Pre-Flight, Settings), use a shadow tinted with `on-secondary-container` (#AAB4D4) at 5% opacity. The blur radius must be large (`40px+`) to mimic the soft glow of a screen in a dark room.
* **The "Ghost Border" Fallback:** If a high-density list requires definition, use the `outline-variant` (#3C4A45) at **12% opacity**. It should be felt, not seen.

---

## 6. Components: The Instrumentation Set

### 6.1 Progress Indicators (The Signature Element)

* Avoid the "flat bar." Use a linear gradient from `primary-fixed-dim` (#38DEBB) to `on-primary-container` (#00725E).
* Incorporate a subtle "pulse" animation on the leading edge of the progress bar using `primary` (#FFFFFF) at 30% opacity.
* **Chunk visualization:** In the Task Detail Panel, each chunk renders as a segment within the bar. Segments are separated by a 1px gap in `surface` color. Individual chunk speed is shown on hover.
* **Queue aggregate bar:** At the top of each queue group in the sidebar, a thin (3px) combined progress bar shows the overall queue completion.

### 6.2 Buttons & Interaction

* **Primary:** Solid `primary-fixed` (#5FFBD6). Text color: `on-primary` (#00382D). Radius: `DEFAULT` (0.5rem). Used for "Download Now", "Save", confirmations.
* **Secondary (Ghost):** No background. Text color: `secondary` (#BCC6E6). On hover, transition to `surface-bright` (#2C3951). Used for "Add to Queue", "Cancel", secondary actions.
* **Tertiary:** Used for "Pause/Cancel" icons. Use `on-surface-variant` (#BACAC3) to keep them secondary to the data.
* **Icon Buttons:** 32x32px hit area, 20px icon. Same tonal rules. Tooltip on hover (200ms delay).
* **Danger:** Solid `error` (#FFB4AB) background, `on-error` text. Used only for destructive confirms (delete queue, remove all tasks).

### 6.3 Input Fields

* **Structure:** Use `surface-container-lowest` (#010E24) for the input well.
* **States:** On focus, the "Ghost Border" increases from 12% to 40% opacity using the `primary-fixed-dim` token. No heavy glow.
* **Search input:** Includes a magnifying glass icon prefix. Debounced filtering (150ms). Appears in the filter bar above the task list.
* **Pattern input (Pre-Flight):** Wider input with inline token chips. Typing `{` triggers an autocomplete dropdown listing available tokens.

### 6.4 Cards & Lists (Forbidding Dividers)

* **The List Pattern:** Individual downloads must not be separated by lines. Use a `3.5` spacing unit (0.75rem) between items. The hover state should gently transition the background to `surface-container-high`.
* **Selection:** Selected rows get a `primary-fixed-dim` left border accent (3px) and a very subtle `primary-fixed-dim` at 5% opacity background fill.
* **Multi-select:** Shift+Click for range, Ctrl+Click for toggle. A floating toolbar appears above the list showing "N selected" and bulk actions (pause all, resume all, cancel all, move to queue, change folder).

### 6.5 Toast / Notification Popup

* **Container:** Glassmorphic — `surface-variant` at 60% opacity, `20px` backdrop-blur, `lg` (1rem) corner radius. Width: 360px. Ambient shadow (40px blur, 5% opacity).
* **Layout:** URL preview (truncated, monospace), filename + size on the second line, two action buttons on the third line.
* **Animation:** Slides in from the right with a 300ms ease-out. Fades out over 200ms on dismiss. A thin progress line at the bottom shrinks over the 8-second auto-dismiss duration.
* **Stacking:** Max 3 visible. New toasts push older ones up. A collapsed "+N more" pill appears below the stack.

### 6.6 Queue Sidebar Section

* **Queue item:** Row with a colored dot (queue accent color), queue name in `body-md`, task count badge in `label-sm` on a `surface-container-high` pill, and a drag handle icon (visible on hover).
* **Collapsed state:** Only queue name and count visible. Expanding (click or chevron) reveals: active task mini-list (top 3 by progress), queue-level progress bar, and a "View All" link.
* **New queue button:** A "+" icon button below the queue list. Clicking opens an inline input field (not a modal) for the queue name, with Enter to confirm.
* **Context menu:** Right-click a queue to access: Rename, Set Save Folder, Set Speed Limit, Pause All, Resume All, Delete.

### 6.7 Batch Rename Modal (within Pre-Flight)

* **Pattern builder:** A wide text input with token autocomplete. Available tokens are shown as clickable chips below the input: `{original}`, `{index}`, `{ext}`, `{date}`, `{tag}`, `{queue}`, or free text.
* **Live preview grid:** Below the pattern input, a table shows all selected files with columns: Original Name | New Name (computed from pattern). Updates in real-time as the pattern changes.
* **Index options:** A small config row below the pattern input: start index (default 1), zero-padding (e.g., 01, 001), step (default 1).
* **Tag input:** A separate chip input where users type tags. Tags are applied to all selected tasks and appear as filterable labels on the dashboard.

### 6.8 Speed Limiter Widget

* **Global (Settings view):** A horizontal slider ranging from 0 (unlimited) to the user's max bandwidth. Paired with a numerical input field and a unit toggle (KB/s | MB/s). The slider track uses a gradient from `secondary` (low) to `primary-fixed-dim` (high).
* **Per-task (Task Detail Panel):** A smaller inline version of the same slider, defaulting to "Use Queue Limit." Overriding shows the slider.
* **Per-queue (Queue context menu > Set Speed Limit):** A popover with the same slider/input combo.
* **Visual feedback:** When any speed limit is active, the Speed HUD shows a small "capped" icon next to the speed readout.

### 6.9 Theme Switcher (Settings view)

* **Selector:** Three cards side by side — Dark, Light, Custom. Each card is a mini preview swatch showing the surface + primary + text colors of that theme. The active theme has a `primary-fixed-dim` border accent.
* **Custom theme panel:** Expands below the selector when "Custom" is active. Shows color pickers for the core token set: `surface`, `surface-container-low`, `surface-container-high`, `primary-fixed`, `primary-fixed-dim`, `secondary`, `on-surface`, `error`. Changes apply in real-time via CSS variable overrides.
* **Import / Export:** Buttons to export the custom theme as a JSON file and import one.

### 6.10 Folder Picker

* **Trigger button:** A button with a folder icon and the current path displayed in `mono-md` (truncated from the left if long).
* **Click behavior:** Opens the OS-native folder selection dialog via Tauri's `dialog.open` API.
* **Recent folders dropdown:** A small chevron next to the button opens a dropdown listing the last 5 used folders. Clicking one selects it without opening the OS dialog.

### 6.11 The Speed HUD

* A floating, glassmorphic widget pinned to the bottom of the sidebar. It uses `display-sm` Manrope to show the aggregate download speed (e.g., "12.4 MB/s") and sits on a `surface-variant` container with `lg` (1rem) corner radius.
* Below the speed readout: active task count ("3 active") in `body-sm`, and a mini sparkline chart (60 data points, 1 per second) rendered as an SVG path in `primary-fixed-dim`.
* When a global speed limit is active, a small "capped at X MB/s" label appears in `label-sm` using `on-surface-variant`.

---

## 7. Theme System: CSS Variable Architecture

All colors are defined as CSS custom properties. Theme switching works by swapping the values on the root element.

### 7.1 Dark Theme (Default — "Kinetic Observatory")

```css
:root,
[data-theme="dark"] {
  --surface:                    #041329;
  --surface-container-lowest:   #010E24;
  --surface-container-low:      #0D1C32;
  --surface-container:          #141F35;
  --surface-container-high:     #1C2A41;
  --surface-container-highest:  #27354C;
  --surface-bright:             #2C3951;
  --surface-variant:            #3C4A45;
  --surface-tint:               #38DEBB;

  --on-surface:                 #E1E2E8;
  --on-surface-variant:         #BACAC3;

  --primary:                    #FFFFFF;
  --primary-fixed:              #5FFBD6;
  --primary-fixed-dim:          #38DEBB;
  --on-primary:                 #00382D;
  --on-primary-container:       #00725E;

  --secondary:                  #BCC6E6;
  --on-secondary-container:     #AAB4D4;

  --error:                      #FFB4AB;
  --on-error:                   #690005;

  --outline-variant:            #3C4A45;
}
```

### 7.2 Light Theme

```css
[data-theme="light"] {
  --surface:                    #F8FAFB;
  --surface-container-lowest:   #FFFFFF;
  --surface-container-low:      #F0F3F5;
  --surface-container:          #E8ECEF;
  --surface-container-high:     #DDE2E6;
  --surface-container-highest:  #D0D6DB;
  --surface-bright:             #C5CCD2;
  --surface-variant:            #B8C0C7;
  --surface-tint:               #00796B;

  --on-surface:                 #1A1C1E;
  --on-surface-variant:         #44474A;

  --primary:                    #000000;
  --primary-fixed:              #00796B;
  --primary-fixed-dim:          #00695C;
  --on-primary:                 #FFFFFF;
  --on-primary-container:       #B2DFDB;

  --secondary:                  #44474A;
  --on-secondary-container:     #5C5F62;

  --error:                      #BA1A1A;
  --on-error:                   #FFFFFF;

  --outline-variant:            #C4C7C9;
}
```

### 7.3 Custom Theme

```css
[data-theme="custom"] {
  /* Values are injected dynamically from the user's saved configuration.
     Falls back to dark theme tokens if a value is missing.
     Stored in the `settings` table as a JSON blob under key "custom_theme". */
}
```

### 7.4 Applying Themes

* Store the active theme key (`dark` | `light` | `custom`) in the `settings` SQLite table.
* On app load, read the key and set `data-theme` on the `<html>` element.
* For custom themes, also inject the user's overrides as inline `style` on the `<html>` element.
* All Tailwind classes reference these CSS variables — no hardcoded hex values in components.

---

## 8. Interaction Patterns

### 8.1 Hover & Focus

* All interactive elements must have a visible focus ring for keyboard navigation: `primary-fixed-dim` at 40% opacity, 2px offset.
* Hover transitions use `150ms ease` for background color shifts. No instant snaps.
* Buttons scale to `1.02` on hover, `0.98` on active press (subtle, 100ms).

### 8.2 Drag-and-Drop

* **Queue reordering:** Grab a queue item by its drag handle. While dragging, the item lifts to `surface-container-highest` with an ambient shadow. A 2px `primary-fixed-dim` insertion line indicates the drop position.
* **Task reordering within a queue:** Same mechanic. Drag a task row by its grip area (far left).
* **Move tasks between queues:** Drag a task row over a queue in the sidebar. The queue item highlights with a `primary-fixed-dim` border on hover.

### 8.3 Multi-Select

* **Ctrl+Click:** Toggle selection on individual tasks.
* **Shift+Click:** Select a range from the last clicked task to the current one.
* **Ctrl+A:** Select all visible tasks (respects current filter).
* When any tasks are selected, a **floating bulk-action toolbar** slides down from the top of the task stage. It shows: selected count, Pause All, Resume All, Cancel All, Move to Queue (dropdown), Change Folder, Apply Tags, Delete.

### 8.4 Keyboard Shortcuts

| Shortcut           | Action                              |
|:------------------ |:----------------------------------- |
| `Ctrl+V`           | Paste URLs — opens Pre-Flight Modal |
| `Ctrl+N`           | New download (opens Pre-Flight)     |
| `Space`            | Pause / Resume selected task(s)     |
| `Delete`           | Cancel / Remove selected task(s)    |
| `Ctrl+A`           | Select all visible tasks            |
| `Escape`           | Deselect all / Close modal          |
| `Ctrl+,`           | Open Settings                       |
| `Up / Down`        | Navigate task list                  |
| `Enter`            | Open Task Detail Panel              |
| `Ctrl+F`           | Focus search input                  |

### 8.5 Animations

* **Progress bar:** Continuous smooth interpolation (CSS `transition: width 200ms linear`). Pulse glow on the leading edge (CSS keyframe, 1.5s loop).
* **Toast entrance:** `translateX(100%) -> translateX(0)`, 300ms ease-out. Exit: `opacity 1 -> 0`, 200ms.
* **Modal entrance:** `opacity 0, scale(0.97) -> opacity 1, scale(1)`, 200ms ease-out with a `surface` backdrop fade-in.
* **Panel slide-over:** `translateX(100%) -> translateX(0)`, 250ms ease-out.
* **List item enter (new download added):** `opacity 0, translateY(-8px) -> opacity 1, translateY(0)`, 200ms ease-out.
* **Sparkline (Speed HUD):** New data points animate in from the right using SVG path morphing, 1s linear.

---

## 9. Do's and Don'ts

### Do:

* **Do** use asymmetrical margins. If the sidebar has a `spacing-8` left padding, give the main content a `spacing-12` left padding to create an editorial "unbalanced" sophisticated look.
* **Do** use `on-surface-variant` for non-essential technical data (e.g., "ETA: 2m"). Save `primary` for the numbers that matter.
* **Do** use the `xl` (1.5rem) roundedness for large containers to soften the "tech" edge and make the app feel premium.
* **Do** use CSS variables everywhere. Zero hardcoded color values in component code.
* **Do** test every component in both Dark and Light themes before merging.
* **Do** provide keyboard alternatives for every mouse interaction.

### Don't:

* **Don't** use pure black (#000000). Always use `surface` (#041329 dark / #F8FAFB light) to maintain tonal depth.
* **Don't** use 100% opaque borders. They break the "Kinetic Observatory" illusion of depth.
* **Don't** use standard "Electric Green" (#64FFDA) for everything. Reserve it for "Active" and "Completed" states. Use `secondary` (#BCC6E6) for "Queued" or "Paused" to manage user attention.
* **Don't** add transitions longer than 300ms. The interface must feel responsive and immediate.
* **Don't** use modal dialogs for actions that can be done inline (e.g., renaming a queue should be an inline input, not a modal).
* **Don't** show raw byte counts to users. Always format as KB, MB, GB with one decimal place.
