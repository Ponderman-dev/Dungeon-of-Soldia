# Publishing to itch.io (dev notes)

The playtest build is ONE html file with no test buttons (no TEST buttons, no 'unlock every hero' toggle).
Players' saves (best floor, unlocks) live in their own browser, so every player starts fresh.

## 1. Make the file
1. `npm run build:itch` -> makes `itch-page.html` in the project folder.
2. Rename a copy of it to **`index.html`** (itch.io looks for that name).
3. Zip it: right-click `index.html` -> Compress / Send to -> Compressed (zipped) folder.
   The zip must have `index.html` at the top, not inside a folder.
4. Before uploading: open `index.html` in your browser and play a little (title -> camp -> squad -> a fight).

## 2. First upload (new project)
On itch.io: your profile menu -> **Upload new project**.
- **Title:** Dungeon of Soldia
- **Kind of project:** HTML
- **Uploads:** upload the zip, then tick **"This file will be played in the browser"**.
- **Embed options:**
  - Viewport: **390 x 844** (the game's own size; it scales to fit any size, so 360 x 780 also works).
  - Tick **Mobile friendly**, orientation **Portrait**.
  - Tick **Fullscreen button**. Leave "Automatically start on page load" OFF (a Run button lets sound and input
    start cleanly).
  - Leave "SharedArrayBuffer support" OFF and scrollbars OFF.
- **Genre:** Strategy (or Role Playing). **Tags:** roguelike, auto-battler, pixel-art, dungeon-crawler, mobile.
- **Visibility:** for a playtest choose **Restricted** (only people with a password or invite) or **Draft**.
  Switch to **Public** when you are ready.
- Save. Open the page and play it once on your phone too.

## 3. Updating the game later
1. Change `"version"` in `package.json` (e.g. 0.1.0 -> 0.2.0); it shows in the title screen's bottom right corner,
   so testers can tell you which build they played.
2. Repeat step 1 (build, rename, zip).
3. On the itch.io project: Edit game -> Uploads -> **Replace** the old zip (or upload the new one and delete the
   old one), keep "played in the browser" ticked, Save.
4. Optional: post a devlog (itch.io Devlog tab). Drafts live in `docs/devlog/` (one file per update).

## What playtesters will see (current build)
- Title screen (forest from above) -> tap -> the camp, a random unlocked hero walks in.
- Camp: TO DUNGEON opens the squad screen. Glossary, Heroes, Leaderboard, Shop, Profile and Settings say
  'Coming soon'. Sound effects are in (menus, camp, fights); no music yet.
- Runs, unlocks and best floor are saved in the player's browser (clearing site data resets them).

## Good to ask testers
- Which floor did you reach, and what killed you?
- Was anything confusing (tap to focus, drag a hero onto an enemy)?
- Did it run smoothly on your phone (which phone / browser)?
