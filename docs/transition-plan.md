# Transition plan (session 40, user: "plan our work MAJORLY on the transition")

Goal: every change of screen, page, tab or window MOVES in one shared style, so the game feels like one polished
piece. Work in phases; every phase is shown first as short CLIPS of the real game on the review page (the user
liked clips, session 26), then rolled out.

## 1. Rules (one motion language)
- **Timing tokens** (one place, `UI.motion` in config.js): FAST 140ms (tabs, buttons, small windows), NORMAL 220ms
  (menu pages, sheets), SLOW 450ms (big moves: title -> camp, camp <-> squad, into the dungeon). Nothing over ~0.6s
  unless it is a story moment (boss intro, defeat).
- **Easing:** things that ARRIVE ease out (fast start, soft stop); things that LEAVE ease in. Never linear for UI.
- **Direction means something:** deeper into the game = forward (down into the dungeon, rightwards for the next
  page); going back = the exact reverse. Pop-up windows grow from where you tapped / the middle.
- **Never trap the player:** taps are off only while something moves; a tap during an entering animation finishes
  it at once; no transition blocks longer than its own length.
- **One helper per kind** in `entities/uiKit.js` (scenes only call them): `pageEnter/pageLeave` (done),
  `popIn/popOut` (windows), `slideSwap` (tab / sub-page content), `sceneFade` (scene to scene).
- Optional soft SOUND per kind (a whoosh / page flip), picked on the sound board (sound.md).

## 2. Every screen change (today -> plan)
| # | From -> to | Today | Plan |
|---|---|---|---|
| 1 | Boot -> Title | instant | fade in from black, logo drops in, TAP TO START appears last |
| 2 | Title -> Camp | camera zooms into the tower + fade | keep; time it with the tokens; camp UI rises in |
| 3 | Camp <-> Squad | camera slide + buttons shift | keep; same timing both ways |
| 4 | Camp -> menu pages | rise in / drop away (session 40) | keep (done) |
| 5 | Page -> page (Glossary -> Heroes) | opens on top, instant | slides sideways (sibling page), back = reverse |
| 6 | Inside pages: tabs, chapters, lists, hero card, shop tabs | instant swap | content slides sideways (FAST), the frame stays still |
| 7 | Pop-up windows (Coming soon, confirm, item / hero card, Who gets it) | instant | pop: grows 90% -> 100% + fade (FAST), closes in reverse |
| 8 | Squad -> Battle (BEGIN DESCENT) | heroes walk into the door + fade | keep; then a short 'FLOOR 1' title card on black before the fight |
| 9 | Floor -> floor (door walk) | walk through the door | keep; the new floor number slides in at the top |
| 10 | Battle -> Reward sheet | dims + sheet slides up | keep; tokens; cards deal in one by one |
| 11 | Battle -> special room / Puzzle | room text / puzzle opens on top | room: a short iris / fade with the room's name; puzzle: pop-in |
| 12 | Boss floor | roar + 2s wait | black bars slide in (letterbox) + the boss name card, then the bars leave |
| 13 | Defeat -> Game Over -> Squad/Camp | dim, red text, fade 250ms | keep the story beat; fades use the tokens |
| 14 | Settings over Title / Battle | rise in / drop away | keep (done) |

## 3. Phases (one per session, smallest first)
1. **Foundation:** `UI.motion` tokens, `popIn/popOut`, `slideSwap`, `sceneFade` in uiKit; tests for the helpers
   (no Phaser: timings and order). Retime what exists (rows 2, 3, 4, 13) to the tokens.
2. **Menus:** rows 5, 6, 7 on every menu screen (Glossary, Heroes, Leaders, Shop, Settings, Profile, Squad hero
   card, Reward 'Who gets it').
3. **Opening:** rows 1, 2 (Boot -> Title -> Camp polish).
4. **The run:** rows 8, 9, 10, 11, 12 (title card, floor number, cards dealing, room iris, boss letterbox).
5. **Sound:** a soft cue per kind, picked on the sound board.

## 4. Answers (session 41): QUICK, tabs SLIDE sideways, pop-ups DROP from above, sounds LATER
PHASE 1 DONE in session 41 (ui.md 'MOTION'). The old questions were:
- Feel: QUICK and snappy (classic RPG menus) or SMOOTH and cinematic (slower, more easing)?
- Inside pages: content slides SIDEWAYS (like turning a page) or simply FADES?
- Pop-up windows: GROW from the middle, or DROP down from above?
- Sounds on transitions: yes / no / later?
