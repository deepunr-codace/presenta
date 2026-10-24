# Presenta Studio Design System

Warm editorial minimalism. An eggshell canvas, black ink, one layer of warm taupe surfaces, stone hairlines, pill buttons, whisper-weight display type. Colour appears only inside product visuals (slide thumbnails, theme swatches, brand previews), never in the chrome. Light is the primary mode; dark is a warm near-black counterpart with the same structure.

## 1. Principles

- Paper, not screen. Surfaces stack eggshell → taupe → stone. No pure white, no pure grey, no gradients, no blur.
- Authority through restraint. Display headlines are Inter at weight 300 with tight tracking; body is Inter 400; 500 is reserved for buttons and emphasised links.
- Monochrome chrome. Buttons are black or outlined; links are black; selection and focus use ink at low alpha. Violet and orange exist only as sparks inside artwork and the product mark.
- Hairlines over shadows. 1 px stone dividers separate; shadows are near invisible and used only on menus and popovers.
- Pills and soft cards. Buttons, tags and tabs are fully round; cards are 20 px, large cards 24 px, inputs 4 px.

## 2. Tokens (`--ps-*` in `globals.css`)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ps-canvas` | #FDFCFC | #121110 | Page background |
| `--ps-surface` | #F5F3F1 | #1B1917 | Cards, section bands, sidebar |
| `--ps-plate` | #EBE8E4 | #262320 | Icon plates, wells, hover rows, thumbnails backdrop |
| `--ps-paper` | #FDFCFC | #1B1917 | Elevated cards and inputs on top of surface |
| `--ps-ink` | #000000 | #F4F2EF | Primary text, filled buttons, nav |
| `--ps-graphite` | #44403B | #D6D1CB | Strong secondary text, section labels |
| `--ps-smoke` | #625C55 | #BDB7AF | Body text, descriptions |
| `--ps-ash` | #766F67 | #9A948C | Captions, placeholders, tertiary icons |
| `--ps-line` | #EBE8E4 | #2B2825 | Hairlines, card borders |
| `--ps-line-2` | #E5E5E5 | #36322E | Button borders, input borders |
| `--ps-ink-soft` | rgba(0,0,0,0.06) | rgba(255,255,255,0.08) | Selected rows, active nav, chip selection |
| `--ps-ink-ring` | rgba(0,0,0,0.18) | rgba(255,255,255,0.24) | Focus ring |
| `--ps-spark-violet` | #0447FF | #4C7DFF | Product visuals only (mark, artwork accents) |
| `--ps-spark-orange` | #FF4704 | #FF6A33 | Product visuals only |
| `--ps-success` | #2E7D4F | #6FCF97 | Saved state |
| `--ps-warning` | #B45309 | #F2A73B | Offline banner dot |
| `--ps-danger` | #B42318 | #F0776B | Destructive |
| `--ps-stage` | #EBE8E4 | #0E0D0C | Editor canvas backdrop |
| `--ps-shadow-subtle` | rgba(0,0,0,0.4) 0 0 1px, rgba(0,0,0,0.04) 0 1px 1px, rgba(0,0,0,0.04) 0 2px 4px | rgba(0,0,0,0.6) 0 0 1px, rgba(0,0,0,0.3) 0 2px 6px | Menus, popovers, elevated paper cards |
| `--ps-inset` | rgba(0,0,0,0.075) 0 0 0 0.5px inset | rgba(255,255,255,0.08) 0 0 0 0.5px inset | Inset borders on inputs |
| `--ps-r-input` | 4px | | Inputs, textareas, selects, small elements |
| `--ps-r-sm` | 10px | | Thumbnails, tiles, menus |
| `--ps-r-card` | 20px | | Cards |
| `--ps-r-card-lg` | 24px | | Hero and large cards |
| `--ps-r-pill` | 9999px | | Buttons, tags, tabs, badges |

Compatibility aliases so existing kit classes keep working: `--ps-bg` = canvas, `--ps-surface-2` = plate, `--ps-ink-2` = smoke, `--ps-ink-3` = ash, `--ps-primary` = ink, `--ps-primary-ink` = canvas (dark: #121110), `--ps-primary-soft` = ink-soft, `--ps-accent` = ink, `--ps-accent-soft` = ink-soft, `--ps-shadow-sm` = shadow-subtle, `--ps-shadow-md` = shadow-subtle, `--ps-r-md` = sm, `--ps-r-lg` = card.

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96. Page max width 1280 px with 64 px gutters on wide screens, 24 px below 1024 px.

## 3. Typography

Inter everywhere. Display roles use weight 300 with the `ss01` stylistic set when available. Tabular numerals for aligned numbers.

| Role | Size / line | Weight | Tracking | Colour |
|---|---|---|---|---|
| Display | 48 / 1.08 | 300 | -0.02em | ink |
| Heading | 36 / 1.17 | 300 | -0.02em | ink |
| Heading small | 32 / 1.13 | 300 | -0.02em | ink |
| Page title | 28 / 1.15 | 300 | -0.02em | ink |
| Body large | 20 / 1.35 | 400 | 0 | ink |
| Subheading | 18 / 1.6 | 400 | 0 | graphite |
| Body | 16 / 1.5 | 400 | +0.01em | smoke |
| Body small | 14 / 1.5 | 400 | +0.01em | smoke |
| Label | 13 / 1.4 | 500 | 0 | graphite |
| Caption | 12 / 1.5 | 400 | 0 | ash |
| Mono | 13 / 1.69 | 400 | 0 | graphite, `--font-mono`, for ids and technical values only |

Buttons and links: 14 / 500. UI density inside panels (editor sidebar, filmstrip) may step body down to 13 and labels to 12.

## 4. App shell

- Canvas page with a top nav of 56 px: wordmark "Presenta" (Inter 600, 16 px, ink) left, nav links centre-left (Studio, Decks, New deck; Projects and Templates marked "Soon" with an ash tag), right: mode toggle (ghost pill icon button), account avatar (24 px ink circle with initial). Transparent on canvas, 1 px stone hairline below. No sticky behaviour on marketing-style pages; the editor and review pin it.
- Content column max 1280 px, centred, 64 px gutters (24 px under 1024 px).
- Under 768 px the nav links collapse into a menu button opening a sheet-like panel.
- Editor and review are full-width work surfaces under the same nav; present is fullscreen black.

## 5. Components

- Filled pill button: ink fill, canvas text, 9999 px, 36 px tall (sm 32), 16 px horizontal padding, Inter 14 / 500, 1 px line-2 border. Primary action everywhere (Create, Generate slides, Present, Send).
- Outline pill button: canvas fill, ink text, 1 px line-2 border; secondary actions (Edit, Export, Back, Cancel).
- Ghost pill button: transparent until hover (plate fill); nav items and tertiary actions. Icon-only ghost buttons are 32 px circles with `aria-label`.
- Destructive: outline pill with danger text.
- Input, textarea, select: paper fill, 1 px line-2 border, radius input (4 px), 14 px Inter, padding 8 × 12; focus: ink border and a 2 px ink-ring. Textareas inside cards may be borderless with the card acting as the frame.
- Card (taupe): surface fill, 20 px radius, 24 px padding (32 px on wide hero cards), no border, no shadow. The default container.
- Paper card: canvas fill, 20 px radius, 1 px line border, used when a card sits on a taupe band or needs separation (deck cards, thumbnails frames).
- Elevated paper card: paper card plus shadow-subtle; menus, popovers, dialogs (dialog radius 24 px).
- Tag and badge: 9999 px, plate fill, 12 px, 22 px tall; "Soon" tags use ash text.
- Tab pill: outline pill 32 px tall; active state is an ink-filled pill (segmented groups) or an outline pill with a 6 px ink dot before the label (product-switcher style). Editor sidebar uses the segmented form for Assistant | Design.
- Chip: outline pill 28 px tall, 13 px; selected chip is ink fill with canvas text.
- Hairline divider: 1 px stone.
- Stat tile: taupe card with label (13 / 500 graphite) above a value in Inter 300 at 32 px with -0.02em, optional caption in ash. No sparklines, no charts in chrome.
- Icon plate: 32 px circle, plate fill, 16 px ink icon.
- Thumbnail: 16:9, radius sm, 1 px line, 2 px ink ring when active, caption row beneath (number in ash, title in graphite).
- Empty state: taupe card, centred icon plate, title 18 / 400 ink, one line in smoke, a filled pill action.
- Toast: elevated paper card bottom-right, 13 px.
- Banner: plate strip, 13 px smoke text, warning dot, dismiss ghost button; home only.
- Prompt box: a taupe card (24 px radius, 24 px padding) holding a borderless textarea in 16 px, starter chips, and a footer with the status tag left and a filled pill "Create deck" right.
- Stepper: vertical list, 28 px numbered circles (outline; current = ink fill; done = ink fill with check), hairline connector, labels 14 / 500 with ash sub-labels; horizontal circles with the current label on narrow screens.
- Product mark: a 24 px ink rounded square with a two-tone spark (violet and orange) cut-out, the one place the sparks appear in chrome.

## 6. Screens

- Home ("Studio"): page title in display weight ("What are we building today?"), a one-line smoke description, the prompt box as a wide taupe hero card, then a row of three stat tiles (Decks, Slides, Last edited), then "Recent decks" as a grid of paper cards (thumbnail, title, meta, menu). Empty state card when no decks. Secondary actions (Import JSON, Open sample) are outline pills beside the title.
- Wizard ("New deck"): left stepper (220 px), centre column (max 720 px) of taupe cards, right column (280 px) with context and settings paper cards. Primary buttons are filled pills; Back is an outline pill.
- Editor: nav pinned; a 48 px tool row below it on canvas with a hairline: editable title, undo/redo ghost icons, Add, Theme, save state tag; right: Export outline pill, Present filled pill. Filmstrip 200 px taupe column with thumbnails; stage on `--ps-stage`; sidebar 340 px taupe panel with the segmented Assistant | Design pill and hairline-separated groups.
- Review: pinned nav; title row with the deck name in heading weight, meta in smoke, Edit outline and Present filled pills, Export menu; hero slide in a paper card; stat tiles; "All slides" grid; right column 340 px with tab pills Assistant | Details.
- Present: fullscreen black; controls as translucent paper pills, shown for two seconds on entry and on any key or mouse move.

## 7. Sidebar spec (editor and review)

Assistant tab: scope chips (selected = ink fill), message list (assistant replies as plain text with hairlines listing applied changes, with Undo and Show as underlined ink links; user messages as plate blocks), quick-action chips per scope, composer as a paper card with a borderless textarea and a filled pill Send (Cmd/Ctrl+Enter). Design tab: property groups with hairlines, 13 px labels left and controls right, 32 px rows; inputs per §5; swatches as 20 px circles with a 0.5 px inset ring; icon picker as 32 px plate tiles.

## 8. Dark mode

Same structure and type. Canvas #121110, surfaces one step lighter, ink becomes warm off-white, filled buttons invert (off-white fill, near-black text). Sparks brighten slightly for the mark. Contrast targets: body smoke on surface ≥ 4.5:1 in both modes; ash and smoke text meet 4.5:1 on canvas and surface in both modes.

## 9. Accessibility

Visible 2 px ink-ring focus on every control; nav items, icon buttons and thumbnails carry labels; dialogs have titles; all interactive targets at least 32 px.

## 10. Type and icon standards (supersedes the light display weight above)

- **Font:** Inter with its default letterforms. No stylistic alternates (`ss01`, `cv11`) and no positive letter-spacing on body text.
- **Weights:** 400 body, 500 controls and row labels, 600 headings, labels in caps and numerals. No 300 or 700 in the app chrome (slide content is separate).
- **Sizes:** 12 (captions, labels), 13 to 14 (body, rows), 16 (large body), 20 and up for headings; page titles top out at 40.
- **Tracking:** headings -0.02em, uppercase labels +0.04em, everything else 0.
- **Icons:** Phosphor only, `regular` weight, `fill` for the active state; 20 to 24 px in navigation, 16 px inline. Do not mix in other icon libraries.
