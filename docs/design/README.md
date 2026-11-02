# Elsewhere — design source and implementation notes

This folder is the frozen visual contract for Elsewhere. The app is a hand-built React/CSS implementation of the Figma Make prototype, not a running embed of Figma.

## Source

- Figma Make prototype: [Build Elsewhere Worldbuilding Studio](https://www.figma.com/make/aeRRMdDfVsyuJvz2Dy1DV3/Build-Elsewhere-Worldbuilding-Studio?t=Y0SPn1WcqeAIuBMw-1)
- Frozen: 2026-11-01 (Version 33)
- `prototype.css` — the Version 33 prototype's compiled CSS, used to read exact colors, type sizes, borders, and spacing
- `prototype-home-full.png` + `prototype-home-full.html` — the frozen home screen reference
- `prototype-studio.png`, `prototype-timeline.png` — frozen Version 33 studio and world-time references
- `prototype-world.elsew.json` — a world exported from the prototype; used to verify `.elsew` compatibility
- `app-home-world.png`, `app-studio-full.png`, `app-explore-full.png` — final implementation screenshots at 1440×900 / 2× (CSS pixels 1440×900)
- `icon-source.png` — source artwork for the app icon; the `.icns` / `.ico` / PNG set is generated with `npx tauri icon docs/design/icon-source.png`

Figma Make files cannot be opened through the Figma MCP server (`create_session` rejects them), so the prototype was inspected in a browser and its CSS and markup were copied into this folder rather than fetched through MCP.

## Version 33 differences

The current studio is the 2026-11-01 Version 33 design. Compared with the 0.1.0 studio it has:

- Three broad create types — **Space**, **Element**, **Event** — instead of fourteen palette entries. Legacy node types still render for imported worlds.
- **World time** snapshots: up to three states (`Origin`, then two later moments), switchable from the bottom timeline. Each snapshot keeps its own nodes and relations.
- The **All Elements** outline drawer, world search, and a right-click canvas create menu.
- Element icons (character / faction / concept / object), Space backgrounds, parent containment, tags, and image upload / drop.
- A new blue-gray canvas, 210 px sidebar, 270 px inspector, serif node titles, and the Version 33 timeline.

## Design language

Elsewhere should feel like a quiet atlas or a well-made index card box, not a productivity dashboard:

- **Warm ivory paper** rather than white or gray.
- **Editorial serif display type** for world and node names; a neutral system sans for UI; spaced uppercase monospace for micro-labels.
- **Hairline borders** and almost no shadow. The only large shadow is the home archive card and the Explore card.
- **A dot grid** on the blue-gray studio canvas, with a lighter space surface for regions.
- **One accent**: a dusty blue used for selection, focus, and the active mode. Everything else is ink, muted ink, or line.
- **No icon library**; 24×24 stroke icons are inline SVG paths in `src/components/Icon.tsx`.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ivory` | `#f6f5f0` | app and card paper |
| `--canvas` | `#eef1f1` | studio canvas background |
| `--canvas-inner` | `#f4f2ec` | legacy world boundary |
| `--line` | `#dfe0da` | hairlines, node borders |
| `--line-strong` | `#c9cbc4` | hover borders, dividers |
| `--ink` | `#282b2d` | primary text |
| `--muted` | `#858984` | secondary text |
| `--faint` | `#a8aba5` | tertiary text, hints |
| `--blue` | `#8aa9c7` | accent, focus rings, selection |
| `--selected` | `#e3ecf4` | selected node fill |
| `--white` | `#fffefa` | node paper |
| `--danger` | `#a4574e` | destructive actions |

The palette is deliberately low-contrast on the page but keeps body text at `#282b2d` on `#f6f5f0` for readable contrast.

## Typography

| Role | Family | Size / spacing |
| --- | --- | --- |
| Brand / home display / node titles | Georgia, `Times New Roman`, serif | home H1 `clamp(3rem, 4.8vw, 4.5rem)`, line-height 1.04, letter-spacing -0.045em |
| UI body | system sans (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif) | 12–14px, line-height 1.5 |
| Micro-labels | `SFMono-Regular`, `Cascadia Mono`, `Roboto Mono`, monospace | 9px, uppercase, letter-spacing 0.11em |
| Node type labels | same mono stack | 8–9px, uppercase, letter-spacing 0.08em |
| Inspector node title | Georgia | 1.55rem, letter-spacing -0.025em |

No web fonts are loaded. Georgia and the system UI font are always available offline; the mono stack degrades to the platform monospace.

## Layout

### Studio (Version 33)

- Toolbar 58 px: brand, world title, centred undo / redo / zoom / Fit, right-side save state, Create / Explore, `Save .elsew`, `Export PNG`.
- Sidebar 210 px: three create cards and, at the bottom, `Search world…` plus `All Elements`.
- Canvas: 1 px inner rule, dot grid, nodes on a 1100 × 680 world, relation labels on curves.
- Inspector 270 px: type, description, type-specific fields, delete. Relation inspector replaces it when a relation is selected.
- Bottom **World time** strip: up to three snapshots; choose, rename, delete, or add a moment.
- ≤980 px: sidebar hides, toolbar gets a quick-add button, inspector becomes a bottom sheet; ≤640 px: quick-add palette.

### Home

- Header 68px: brand at left, italic serif tagline at right.
- Content `min(1080px, 100% - 80px)`, two columns `0.86fr 1.14fr`, gap 90px, vertically centered.
- Left: `YOUR ARCHIVE` micro-label, three-line display headline, one-line explanation, `Create new world` primary button and `Import .elsew` secondary button.
- Right: a single ivory card with 14px radius, 1px border, soft large shadow; `Recent worlds` serif heading and `N LOCAL` count; world rows use a small framed thumbnail, serif name, mono metadata, and a right arrow.
- Empty state replaces the list with a quiet message; the card is not hidden, so the layout remains stable.
- At ≤640px the grid becomes one column and the archive card follows the intro.

### Studio (Version 33)

- Toolbar 58px: brand block, world title, centered undo / redo / zoom / Fit, right-side save state, Create / Explore, `Save .elsew`, `Export PNG`. On macOS the native title bar (transparent, title hidden) sits above the web content; the toolbar does not reserve traffic-light padding and is not a drag region.
- Workspace `210px 1fr 270px`: sidebar, canvas, inspector. Explore hides the sidebar and inspector.
- Canvas: blue-gray `#eef1f1`, 22px dot grid, 1px inner rule, world layer `1100 × 680`, initially 90% and centered.
- Sidebar: three create cards with icon, name, subtitle, and `+`; bottom `Search world…` and `All Elements` with base-node count.
- Inspector: type eyebrow, serif title, Type select, Description, type-specific fields (Element icon / Space / image / tags; Space background / children), and Delete. Relation inspector replaces it when a relation is selected.
- Bottom world-time strip: `WORLD TIME 1/3` through `3/3`; up to three snapshot buttons, a rename input, delete, and add.
- Right-click create menu and All Elements drawer float above the canvas; the drawer sits above the timeline.
- ≤980px: sidebar hides, toolbar gets Quick add, inspector becomes a bottom sheet with a close button; ≤640px: quick-add palette.
- The browser screenshots in this folder show the web content only; the macOS native title bar is outside the web view after the v0.1.3 drag fix.

### Node geometry

| Type | Default size | Resizable |
| --- | --- | --- |
| Space | 560 × 360 | yes |
| Element | 150 × 72 | no |
| Event | 174 × 46 | no |
| Image | 150 × 108 | no |
| Legacy Place | 560 × 360 | yes |
| Legacy Category | 480 × 300 | yes |
| Legacy Character | 104 × 104 | no |
| Legacy Faction | 154 × 88 | no |
| Legacy other types | per `NODE_TYPE_META` | no |

- Space has a title chip, blue-gray background, and child nodes rendered above it. Moving a Space moves its children; deleting a Space deletes them.
- Element is a horizontal card with a 32px icon tile, serif title, and `ELEMENT` micro-label. The icon can be character, faction, concept, or object.
- Event is a narrow warm card with an iconic tile, title, and type label, used as a moment in time.
- Image renders the uploaded data URL; without one it shows a choose-image placeholder.
- Relation ports are 7px circles centered on left/right edges; they appear on hover and while connecting.
- Relation curves are cubic Béziers with horizontal control points, dashed, 1px `#9da6a4`, and a small ivory label background. SVG paths carry inline fallback attributes so PNG export keeps the stroke.

## Motion

- Node transform/drag: no CSS transition while actively dragging (the canvas adds `transition: none` when `interacting`).
- Relation path: `stroke-dashoffset` animation while connecting, plus a subtle fade.
- Home card and rows: 120–160 ms opacity/translate on hover and menu open.
- Mode switch: no page-level slide; panels collapse immediately to keep the canvas stable.
- `prefers-reduced-motion: reduce` disables non-essential transitions in `app.css`.

## Intentional deviations

1. **World rename** — prototype shows a modal-style rename; the implementation uses an inline toolbar input opened by the `⌄` button or double-clicking the title. Same outcome, fewer layers.
2. **Create menu** — the prototype shows a right-click menu; the implementation keeps it for the canvas and adds a Quick add popover for narrow layouts and `N`.
3. **Title editing** — double-click on the canvas title matches the prototype; the inspector title is a single click. Single-click on the toolbar world name does not enter edit mode (only the chevron / double-click does) to avoid accidental renames when selecting the window.
4. **Mobile** — the prototype's responsive behavior is frozen as a CSS reference; the Tauri window minimum is 1040px, so the narrow layout is exercised in browser/Playwright only.
5. **Explore panel** — the implementation keeps a floating card with the image, type eyebrow, serif title, description, parent Space, tags, and coordinates; the close button is explicit.
6. **Image nodes** — the prototype exported nonfunctional image dialogs; Elsewhere stores the image data URL in `.elsew` and includes it in PNG export.
7. **No external assets** — the prototype used a remote font/icon setup; Elsewhere uses system fonts and inline SVG so it works fully offline and inside the Tauri CSP.

## Fidelity checks

The implementation was compared against the prototype at 1440×900:

- home headline line breaks and column rhythm;
- toolbar order, heights, and spacing;
- three create cards, sidebar search, and All Elements drawer;
- canvas dot spacing (22px) and world bounds;
- Space / Element / Event shapes and world-time strip;
- inspector typography and section order;
- relation label placement and curve weight;
- Explore chrome removal and panel proportions.

The final comparison screenshots live in this folder. If a visual change is intentional, update this document and recapture the final screenshots in the same change.

