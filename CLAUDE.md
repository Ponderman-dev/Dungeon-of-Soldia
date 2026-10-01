# Dungeon of Soldia

Mobile auto-battler roguelike. Phaser 3 + Vite + plain JavaScript (ES modules, no TypeScript).
Will be wrapped for Android later (Solana Seeker dApp Store).
Full design lives in the "game-design-recap" doc.

## About the user
Total beginner, fully vibe coding. Explain simply, work in small steps,
and ask before big decisions (new libraries, big refactors, design changes).

## Rules
- **Screen:** portrait 390x844 (see `src/config.js`). Crisp pixel scaling:
  `pixelArt: true`, `roundPixels: true`, Scale.FIT. Never use smoothing/antialiasing on art.
- **Data in JSON:** heroes, items, skills, enemies etc. live in `src/data/*.json`.
  Never hard-code that data inside scene code; scenes only read it.
- **Placeholder art only:** characters are colored blocks built from separate parts
  (body, head, weapon) so real pixel-art parts can replace each one later. No real art yet.
- **Git:** commit after every working step, with a clear message. Don't commit broken code.
- **Small steps:** do one step at a time, then stop and tell the user how to see it.

## Commands
- `npm install`  install dependencies
- `npm run dev`  start dev server (http://localhost:5173)
- `npm run build`  production build into `dist/`

## Layout
- `index.html`  page shell
- `src/main.js`  Phaser game config
- `src/config.js`  size/colour constants
- `src/scenes/`  one file per scene
- `src/data/`  JSON game data
- `public/`  static assets
