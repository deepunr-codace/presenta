# Presenta Studio

An AI presentation builder. Describe a deck in a short guided conversation or paste your own content, shape the outline, pick a theme and brand, and get a designed deck. Then edit every slide on a canvas, ask the assistant for changes to the deck, a slide or a single selected element, and present or export.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without an API key the app runs in offline mode: generation, outlines, suggestions and revisions are served by a deterministic local generator, so every screen is fully usable.

To enable Claude, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The key is read only on the server.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Type check, lint and unit tests |
| `npm test` | Unit tests only |

## Product flow

1. **Home.** Greeting, a prompt box that starts a new deck, and your recent decks.
2. **Brief.** A guided chat asks about topic, audience, goal, must-include points and angle, offering tailored suggestions at each step. Or paste content and skip the chat.
3. **Outline.** An editable outline: slide kinds, titles, goals and key points, with drag to reorder.
4. **Brand.** Theme, company, logo, accent colour, font pair and notes for the assistant, with a live cover preview.
5. **Generate.** Slides are written and laid out with progress feedback.
6. **Review.** The finished deck with Present and Edit, stats, thumbnails and the assistant at deck or slide scope.
7. **Edit.** Canvas with drag, resize, rotate and snapping; inline text editing; a right sidebar with an Assistant tab (scoped to the deck, the slide or the selected element, with undo for every applied change) and a Design tab with manual controls for position, size, radius, colours, fonts, images (upload, replace, regenerate), cards, shapes, icons and charts.
8. **Present** fullscreen, **export** to PDF (print view, one slide per page), PPTX and JSON.

Light and dark modes follow the system and can be toggled from the rail.

## Architecture

| Area | Location |
|---|---|
| Deck schema: slides, elements, themes, AI content, patch operations | `src/lib/deck/schema.ts` |
| Themes and layout engine | `src/lib/deck/themes.ts`, `src/lib/deck/layouts.ts` |
| Store with undo history and autosave | `src/store/deck-store.ts` |
| Persistence (IndexedDB), import and export | `src/lib/persist.ts` |
| Patch operations shared by the assistant and manual controls | `src/lib/deck/ops.ts` |
| Claude integration, prompts and offline generator | `src/lib/ai/` |
| API routes | `src/app/api/` |
| Design system tokens and kit | `DESIGN.md`, `src/app/globals.css`, `src/components/shell/` |
| Canvas renderer and editing | `src/components/canvas/` |
| Editor, sidebar, review, wizard, present | `src/components/` |
| Export (print view, PPTX) | `src/lib/export/` |

Every rendering surface uses one `SlideRenderer`, so the canvas, thumbnails, review, present and print stay identical. The assistant returns typed patch operations that run through the same undoable store path as the manual controls.

## Keyboard

Editor: arrows nudge 1 unit, Shift+arrows 10, Delete removes, Cmd/Ctrl+D duplicates, Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo, Escape clears selection or exits text editing, Cmd/Ctrl+Enter sends in the assistant. Present: arrows, Space, Enter, Escape, N for notes, F for fullscreen.

## Limits of this release

- Decks are stored in the browser. Export JSON to move them between devices.
- Image elements hold a description until you attach a file; generated imagery is a planned addition.
- PPTX export simplifies gradients to flat fills and omits icon glyphs.
- PDF export uses the browser print dialog: choose Save as PDF, no margins, background graphics on.
