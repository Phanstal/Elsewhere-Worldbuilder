# Elsewhere

A quiet, local-first worldbuilding studio for macOS. Elsewhere turns a setting into a spatial canvas: place spaces, elements and events on the page, draw the relations between them, record up to three moments in the world's time, and step back into a read-only Explore view when the world is ready to be read.

Built with Tauri 2, React, TypeScript, and SQLite. No accounts, no cloud, no telemetry.

![Elsewhere studio](docs/design/app-studio-full.png)

![Elsewhere archive](docs/design/app-home-world.png)

![Elsewhere explore mode](docs/design/app-explore-full.png)

## Download

Download the latest universal build for macOS 12 or newer (Apple Silicon and Intel) from [Releases](https://github.com/Phanstal/Elsewhere-Worldbuilder/releases/latest):

- `Elsewhere_0.1.5_universal.dmg`
- `Elsewhere_0.1.5_universal.zip`
- `SHA256SUMS.txt`

Verify the download before opening it:

```sh
shasum -a 256 -c Elsewhere_0.1.5_universal.dmg.sha256
```

### First launch

The app is **unsigned and not notarized** (personal distribution, no Apple Developer ID). macOS Gatekeeper will warn on first launch:

1. Open the DMG and drag `Elsewhere.app` to `/Applications`.
2. Right-click the app, choose **Open**, then **Open** again. Or use **System Settings → Privacy & Security → Open Anyway**.
3. If macOS says the app is damaged, clear the quarantine flag:

```sh
xattr -dr com.apple.quarantine /Applications/Elsewhere.app
```

Because every build is ad-hoc signed rather than notarized, you may need to repeat this after installing a new release.

## What it does

- **Spatial studio**: a dot-grid canvas. Scroll with two fingers to pan, pinch or `Ctrl` / `⌘` + scroll to zoom around the pointer, drag blank space for a selection marquee, and use **Fit** to bring everything back into view.
- **Three broad types**: **Space** is a container or region; **Element** is a person, object, faction, concept, or landmark; **Event** is a moment in time. The older 14 node types still render in imported worlds.
- **World time**: up to three snapshots per world, starting with `Origin`. Switch, rename, add, or delete a moment from the bottom timeline; each moment keeps its own nodes and relations.
- **Inspector**: edit title, type, and description. Elements get an icon, Space parent, tags, and an image. Spaces get a background color and a list of their contents. Deleting a Space removes what is inside it.
- **Relations**: drag from either side of a node and drop on another to create a named relation. Relation labels sit on the curve and can be renamed in place or from the inspector.
- **Aliases**: a character can appear in two parts of the map without becoming two characters. Aliases share the source node's title and type, and are counted separately from base nodes.
- **Canvas workflow**: right-click blank space to create a node or add an image, drag an image file onto the canvas, drag nodes into a Space to parent them, double-click a title to rename it, and drag a Space to move its contents with it. Drag blank space to marquee-select, then drag any selected node to move the group. Right-click a node for its layer order (Bring forward / Send backward / Bring to front / Send to back), and copy/paste with `⌘C` / `⌘V`. Spaces render at 80% opacity.
- **Create / Explore**: Create mode exposes the sidebar and inspector. Explore mode hides the editing chrome and opens a quiet read-only card for any node you click.
- **All Elements**: open any base node from the outline drawer at the top of the sidebar.
- **Autosave**: changes land in a local SQLite database after a short debounce, with `Saving…` / `Saved` feedback. Undo and redo are available from the toolbar and `⌘Z` / `⇧⌘Z`.
- **`.elsew` files**: a readable, versioned JSON format. Save the current world, or import a world as a new entry in the archive; imports never overwrite existing worlds. v0.1.0 files open with an `Origin` snapshot.
- **PNG export**: render the whole world, including the dot grid, spaces, and relation lines, at 2× resolution through a native save dialog.
- **Native macOS shell**: a transparent native title bar with the standard traffic lights and menus, drag-to-move from the system title bar, `⌘N` / `⌘S` / `⇧⌘E` / `⇧⌘P` / `⇧⌘O`, and window-state restore.
- **Example world**: [samples/the-hollow-reach.elsew](samples/the-hollow-reach.elsew) is the world in the screenshots. Import it from the archive to try the app.

## Keyboard and trackpad

| Action                           | Shortcut               |
| -------------------------------- | ---------------------- |
| Create a world                   | `⌘N`                   |
| Save now                         | `⌘S`                   |
| Undo / redo                      | `⌘Z` / `⇧⌘Z`           |
| Zoom in / out                    | `⌘+` / `⌘-`            |
| Fit the world                    | `⌘0`                   |
| Quick add node                   | `N`                    |
| Toggle Explore / Create          | `⇧⌘O`                  |
| Export `.elsew`                  | `⇧⌘E`                  |
| Export PNG                       | `⇧⌘P`                  |
| Copy / paste selected nodes      | `⌘C` / `⌘V`            |
| Rename a node on the canvas      | Double-click its title |
| Rename a relation                | Double-click its label |
| Cancel selection / close a panel | `Esc`                  |

## World time

The bottom strip is the world's time track. `Origin` is created with every new or imported world. The `+` button adds a later moment (up to three); the trash button removes the current one, keeping at least `Origin`. Switching a moment swaps the whole node and relation graph, so a character can be in one place at `Origin` and somewhere else in `After the Silence`.

Each snapshot is stored inside the `.elsew` file and the SQLite record. The active snapshot is marked by `activeSnapshotId`.

## Your data

The SQLite database lives at:

```text
~/Library/Application Support/com.phanstal.elsewhere/elsewhere.db
```

Back it up with Time Machine or by copying that file while Elsewhere is closed. Removing the app does not remove the database; delete the folder above if you want a clean slate.

The browser build used for development and Playwright stores worlds in `localStorage` under `elsewhere.worlds.v1`. It is a full local adapter, not a demo mode.

## The `.elsew` format

```json
{
  "format": "elsew",
  "version": 1,
  "id": "0ccf4b9a-6b7d-4c4e-9e4a-1f2d3c4b5a69",
  "name": "The Hollow Reach",
  "updatedAt": "2026-11-01T09:30:00.000Z",
  "activeSnapshotId": "snapshot-origin",
  "nodes": [
    {
      "id": 104,
      "title": "Mira Vale",
      "type": "Element",
      "x": 320,
      "y": 470,
      "description": "A cartographer who charts the roads nobody else will walk.",
      "icon": "character",
      "parentId": 101,
      "tags": ["cartographer", "traveler"]
    }
  ],
  "relations": [{ "id": 201, "from": 104, "to": 105, "name": "Sworn to" }],
  "snapshots": [
    {
      "id": "snapshot-origin",
      "label": "Origin",
      "nodes": [],
      "relations": []
    }
  ]
}
```

- `format` must be `elsew`, `version` must be `1`.
- Node IDs may be numbers or the millisecond timestamps produced by the original prototype.
- Missing `width` / `height` fall back to the type's default footprint.
- `icon` is one of `character`, `faction`, `concept`, `object`; `parentId` must point to a Space; `backgroundColor` is a six-digit hex color; `tags` are short strings; `imageSrc` is a data URL.
- `snapshots` is optional. Files without it get a single `Origin` snapshot on import; `activeSnapshotId` selects the moment whose graph is copied into the top-level `nodes` / `relations`.
- A bad file is rejected with a readable message instead of being partially imported.

The format is intentionally plain JSON: it can be read, diffed, repaired by hand, and moved between machines without a database.

## Development

Prerequisites:

- Node.js 22 or newer
- Rust stable (`rustup`)
- macOS: Xcode Command Line Tools
- Windows: Visual Studio C++ build tools and WebView2
- Linux: the usual Tauri 2 WebKitGTK dependencies

```sh
npm install
npm run dev          # browser mode, localStorage adapter, hot reload
npm run tauri dev    # native window, SQLite adapter
```

Checks:

```sh
npm run lint
npm run format:check
npm run typecheck
npm test             # Vitest: domain, .elsew parsing, local repository
npm run build
npx playwright install chromium
npm run test:e2e     # builds, serves the production bundle, runs Playwright
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The E2E suite uses Chromium. On a Windows machine without Playwright's browser installed, set `PLAYWRIGHT_CHANNEL=msedge` to reuse the installed Edge:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

Build a universal macOS app locally:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin --bundles app
```

## Architecture

```text
React views (archive, studio, canvas, inspector)
        │
        ├── domain: types, world operations, .elsew parsing, repository port
        ├── infra/storage: SQLite adapter (Tauri desktop)
        │                  localStorage adapter (browser + E2E)
        ├── infra/export: native .elsew save and 2× PNG rendering
        └── platform: Tauri detection, native menu command bus, save dialog
        │
Rust shell (src-tauri): plugins, menus, window config, save_export command
```

The domain and storage ports have no React dependency. That is what keeps the model portable to a future iOS or Android target without rewriting the world operations or the file format.

Read [docs/architecture.md](docs/architecture.md) for the detailed decisions, schema, save pipeline, undo transactions, and mobile-porting plan. The design contract and frozen reference assets are in [docs/design](docs/design).

## Why Tauri instead of SwiftUI?

The target was a Mac app that can later become an iPhone or Android app. Tauri 2 gives a native window and menus today, a React/SVG world canvas that runs well in WKWebView, and a documented mobile path later. The trade-off is a WebView-based UI and a Rust toolchain; for a single-window, local-first canvas that is a good exchange. SwiftUI would be excellent for Mac-only, but would require a second implementation for mobile.

## Privacy

Elsewhere has no network code, no analytics, no account system, and no synchronization. The only file writes outside its own database are the `.elsew` and PNG files you explicitly choose in a save dialog.

## Known limitations

- No Apple signing or notarization; first launch needs manual approval, and each new build may need it again.
- No auto-update, cloud sync, accounts, collaboration, or version history beyond the in-session undo stack.
- World time is limited to 3 snapshots; there is no merge or diff between moments.
- The world is fixed at 1100 × 680; nodes cannot be rotated, and only Space (and legacy Place / Category) can be resized.
- Relations are named two-node links; no routing points or multi-edge groups.
- Images are stored inline in the world file; there is no crop, frame, or media library yet.
- The interface is English only, matching the prototype.

## Design

The interface is based on the [Elsewhere Figma Make prototype](https://www.figma.com/make/aeRRMdDfVsyuJvz2Dy1DV3/Build-Elsewhere-Worldbuilding-Studio?t=Y0SPn1WcqeAIuBMw-1), Version 35 (2026-11-04). Figma Make files are not supported by the Figma MCP server, so the prototype's CSS, exported world, and reference screenshots were frozen into [docs/design](docs/design) and used as the visual contract; the Version 35 interaction source was inspected through the Make file and is recorded in the design notes. See [docs/design/README.md](docs/design/README.md) for tokens and intentional deviations.
