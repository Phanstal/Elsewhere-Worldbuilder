# Elsewhere — design source and implementation notes

This folder is the frozen visual contract for Elsewhere. The app is a hand-built React/CSS implementation of the Figma Make prototype, not a running embed of Figma.

## Source

- Figma Make prototype: [Build Elsewhere Worldbuilding Studio](https://www.figma.com/make/aeRRMdDfVsyuJvz2Dy1DV3/Build-Elsewhere-Worldbuilding-Studio?t=Y0SPn1WcqeAIuBMw-1)
- Frozen: 2026-10-27
- `prototype.css` — the prototype's compiled CSS (46 KB), used to read exact colors, type sizes, borders, and spacing
- `prototype-home-full.png` + `prototype-home-full.html` — the frozen home screen reference
- `prototype-world.elsew.json` — a world exported from the prototype; used to verify `.elsew` compatibility
- `app-home-world.png`, `app-studio-full.png`, `app-explore-full.png` — final implementation screenshots at 1440×900 / 2× (CSS pixels 1440×900)
- `icon-source.png` — source artwork for the app icon; the `.icns` / `.ico` / PNG set is generated with `npx tauri icon docs/design/icon-source.png`

Figma Make files cannot be opened through the Figma MCP server (`create_session` rejects them), so the prototype was inspected in a browser and its CSS and markup were copied into this folder rather than fetched through MCP.

## Design language

Elsewhere should feel like a quiet atlas or a well-made index card box, not a productivity dashboard:

- **Warm ivory paper** rather than white or gray.
- **Editorial serif display type** for world and node names; a neutral system sans for UI; spaced uppercase monospace for micro-labels.
- **Hairline borders** and almost no shadow. The only large shadow is the home archive card and the Explore card.
- **A dot grid** on the canvas, with a subtly different paper tone inside world bounds.
- **One accent**: a dusty blue used for selection, focus, and the active mode. Everything else is ink, muted ink, or line.
- **No icon library**; 24×24 stroke icons are inline SVG paths in `src/components/Icon.tsx`.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ivory` | `#f6f5f0` | app and card paper |
| `--canvas` | `#f0efe9` | canvas background outside the world |
| `--canvas-inner` | `#f4f2ec` | inside the world boundary |
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

### Home

- Header 68px: brand at left, italic serif tagline at right.
- Content `min(1080px, 100% - 80px)`, two columns `0.86fr 1.14fr`, gap 90px, vertically centered.
- Left: `YOUR ARCHIVE` micro-label, three-line display headline, one-line explanation, `Create new world` primary button and `Import .elsew` secondary button.
- Right: a single ivory card with 14px radius, 1px border, soft large shadow; `Recent worlds` serif heading and `N LOCAL` count; world rows use a small framed thumbnail, serif name, mono metadata, and a right arrow.
- Empty state replaces the list with a quiet message; the card is not hidden, so the layout remains stable.
- At ≤640px the grid becomes one column and the archive card follows the intro.

### Studio

- Toolbar: 58px tall; `190px 1fr auto` inner grid. Brand block 190px, world title centered left, action cluster right. The whole bar is a drag region on macOS, with `padding-left: 82px` for traffic lights.
- Workspace: `190px 1fr 250px` — sidebar, canvas, inspector.
- Canvas is the remaining area; the world layer is `1100 × 680` and initially scaled to 90% and centered.
- Sidebar: `20px 12px` padding; `NAVIGATE`, `CREATE` micro-labels; World and All Nodes rows; four groups with numbered labels; each type row is a 30px-high ghost button that turns ivory on hover.
- Inspector: 250px; `NODE TYPE` eyebrow, serif title, `TYPE` select, `DESCRIPTION` textarea, alias/delete row, and a bottom column for relation metadata / create alias. When nothing is selected, a quiet empty message.
- At ≤980px the sidebar is removed, Quick add appears in the toolbar, and the inspector becomes a bottom sheet with `has-selection`.
- At ≤640px the home layout stacks and toolbar spacing tightens.

### Node geometry

| Type | Default size | Resizable |
| --- | --- | --- |
| Place | 560 × 360 | yes |
| Category | 480 × 300 | yes |
| Map | 178 × 116 | no |
| Building | 164 × 112 | no |
| Event | 174 × 46 | no |
| Timeline | 190 × 52 | no |
| Faction | 154 × 88 | no |
| Concept | 154 × 42 | no |
| Culture | 152 × 76 | no |
| Image | 150 × 108 | no |
| System | 146 × 88 | no |
| Species | 118 × 94 | no |
| Object | 112 × 82 | no |
| Character | 104 × 104 | no |

- Place/Category use a header strip with a 1px divider; child nodes are independently positioned and z-ordered above the container.
- Character uses a centered portrait-ish layout: icon tile at top, name and type below.
- Faction and other medium cards use a 24px icon tile on the left, title and type at the right.
- Image is a placeholder shape with a diagonal and a dot, intentionally not a real image upload in v0.1.0.
- Relation ports are 7px circles centered on the left/right edges; they appear on hover and while connecting.
- Relation curves are cubic Béziers with horizontal control points, dashed `4 4`, 1px `#9da6a4`, and a small ivory label background.

## Motion

- Node transform/drag: no CSS transition while actively dragging (the canvas adds `transition: none` when `interacting`).
- Relation path: `stroke-dashoffset` animation while connecting, plus a subtle fade.
- Home card and rows: 120–160 ms opacity/translate on hover and menu open.
- Mode switch: no page-level slide; panels collapse immediately to keep the canvas stable.
- `prefers-reduced-motion: reduce` disables non-essential transitions in `app.css`.

## Intentional deviations

1. **World rename** — prototype shows a modal-style rename; the implementation uses an inline toolbar input opened by the `⌄` button or double-clicking the title. Same outcome, fewer layers.
2. **Create menu** — prototype opens a centered modal in some states; the implementation keeps creation in the left rail and adds a Quick add popover for narrow layouts and `N`.
3. **Title editing** — double-click on the canvas title matches the prototype; the inspector title is a single click. Single-click on the toolbar world name does not enter edit mode (only the chevron / double-click does) to avoid accidental renames when selecting the window.
4. **Mobile** — the prototype's responsive behavior is frozen as a CSS reference; the Tauri window minimum is 1040px, so the narrow layout is exercised in browser/Playwright only in v0.1.0.
5. **Explore panel** — the implementation keeps a floating card with the type eyebrow, serif title, description, alias mark, and coordinates; the close button is explicit instead of click-outside only.
6. **No external assets** — the prototype used a remote font/icon setup; Elsewhere uses system fonts and inline SVG so it works fully offline and inside the Tauri CSP.

## Fidelity checks

The implementation was compared against the prototype at 1440×900:

- home headline line breaks and column rhythm;
- toolbar order, heights, and spacing;
- sidebar group labels, row heights, and 14 item order;
- canvas dot spacing (22px) and world bounds;
- node shapes and default footprints;
- inspector typography and section order;
- relation label placement and curve weight;
- Explore chrome removal and panel proportions.

The final comparison screenshots live in this folder. If a visual change is intentional, update this document and recapture the final screenshots in the same change.
