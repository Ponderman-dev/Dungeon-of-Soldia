// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// The fight HUD: hero slots and skill squares, health bars, status chips, cast bars, the pause / speed buttons, the boss bar (docs/systems/ui.md).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, SKILL_COLORS, UI } from '../../config.js';
import { drawWindow, uiText, uiStyle } from '../../entities/uiKit.js';
import combatRules from '../../data/combat.json';
import damageTypes from '../../data/damageTypes.json';
import statusInfo from '../../data/statuses.json';
import * as sfx from '../../audio/sfx.js';
import { statusIconKey } from '../../entities/statusIconTexture.js';
import { itemIconKey } from '../../entities/itemIconTexture.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import itemFxData from '../../data/itemFx.json';
import statusIcons from '../../data/statusIcons.json';
import { iconList, iconLayout, ICON_PX } from '../../systems/statusIcons.js';
import { loadProgress, saveProgress } from '../../systems/progress.js';
import settingsDefs from '../../data/settings.json';
import { readSettings, cardOf, changeSetting } from '../../systems/settings.js';
import pauseData from '../../data/pause.json';
import { SLOT_Y, BAR_WIDTH, itemDefs, skillDefs, SKILL_Y, SKILL_W, SKILL_H, DEPTH } from './shared.js';

export const hudMethods = {
  // Status effects ON the fighters, every frame: each status plays its own loop (stars, ice, snow, sparks,
  // flames, bubbles, drops, brackets...) all at once, and tints the sprite (Freeze turns it to ice).
  // The recipes live in systems/statusFx.js; this only draws them at the fighter's body.
  // Small per-frame markers for the hero mechanics (rework v2): the Berserker's Rage bar under his health bar,
  // the Rogue's combo pips under the enemy he is working on, and the Bard's current song (a note: gold = March,
  // green = Ballad) right of his health bar.
  drawHeroHud() {
    if (!this.heroHud) this.heroHud = this.add.graphics().setDepth(DEPTH.heroBar + 0.5);
    const g = this.heroHud;
    g.clear();
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      if (!v || !h.alive || !v.bg.visible || !v.ch.active) continue;
      const rage = h.def.passive && h.def.passive.rage;
      if (rage) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        const full = this.state.frenzied(h);
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(full ? 0xffd24d : 0xff6a2a, 1).fillRect(x, y, full ? BAR_WIDTH : (BAR_WIDTH * h.rage) / rage.max, 2);
      }
      // Necromancer's Souls: a purple bar under his health bar fills with every minion death (pale when full).
      const legion = h.def.passive && h.def.passive.legion;
      if (legion && h.souls) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(h.souls >= legion.maxSouls ? 0xe6c8ff : 0xa064ff, 1).fillRect(x, y, (BAR_WIDTH * h.souls) / legion.maxSouls, 2);
      }
      // Knight's Grudge: a bar under his health bar fills with every reflected hit (gold when full).
      const grudge = h.def.passive && h.def.passive.grudge;
      if (grudge && h.grudge) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(h.grudge >= grudge.maxStacks ? 0xffd24d : 0xff9a3c, 1).fillRect(x, y, (BAR_WIDTH * h.grudge) / grudge.maxStacks, 2);
      }
      if (h.def.passive && h.def.passive.combo && h.combo.points > 0) {
        const tv = this.views.get(h.combo.uid);
        if (tv && tv.unit.alive && tv.ch.active && tv.bg.visible) {
          const max = h.def.passive.combo.max;
          for (let i = 0; i < max; i++) {
            const px = tv.bg.x - (max * 6) / 2 + i * 6 + 1, py = tv.bg.y + 6;
            g.fillStyle(0x000000, 0.9).fillRect(px - 1, py - 1, 6, 5);
            g.fillStyle(i < h.combo.points ? (h.combo.points >= max ? 0xff4a4a : 0xffd24d) : 0x3a3350, 1).fillRect(px, py, 4, 3);
          }
        }
      }
      if (h.song) {
        const col = h.song === 'ballad' ? 0x6dff8f : 0xffb84d;
        const x = v.bg.x + BAR_WIDTH / 2 + 6, y = v.bg.y - 2;
        g.fillStyle(0x000000, 1).fillRect(x - 3, y + 1, 5, 4).fillRect(x + 1, y - 6, 3, 8);
        g.fillStyle(col, 1).fillRect(x - 2, y + 2, 3, 2).fillRect(x + 2, y - 5, 1, 7).fillRect(x + 2, y - 5, 2, 1);
      }
    }
  },

  // A charge bar just under a hero's health bar while it winds up a skill, in the skill's colour
  // (attack red, support green). It fills up until the skill goes off.
  drawCastBars() {
    if (!this.castBars) this.castBars = this.add.graphics().setDepth(DEPTH.heroBar);
    const g = this.castBars;
    g.clear();
    for (const h of this.state.heroes) {
      if (!h.alive || !h.casting) continue;
      const v = this.views.get(h.uid);
      const kind = h.skills[h.casting.index].kind;
      const x = v.bg.x - BAR_WIDTH / 2;
      const y = v.bg.y + 6;
      const p = 1 - h.casting.remaining / h.casting.total;
      g.fillStyle(0x000000, 1).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
      g.fillStyle(SKILL_COLORS[kind].ready, 1).fillRect(x, y, BAR_WIDTH * Math.max(0, Math.min(1, p)), 3);
    }
    // A boss winding up a move: a red bar that fills (a channel: it empties while it lasts). Stun it to stop it!
    for (const u of this.state.enemies) {
      const c = u.alive && u.bossCast;
      const v = c && this.views.get(u.uid);
      if (!v || !(c.total > 0)) continue;
      const p = c.channel ? c.remaining / c.total : 1 - c.remaining / c.total;
      const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 6;
      g.fillStyle(0x000000, 1).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
      g.fillStyle(c.channel ? 0xc070ff : 0xff4a3a, 1).fillRect(x, y, BAR_WIDTH * Math.max(0, Math.min(1, p)), 3);
    }
  },

  // Morale: a faint wash over every living hero (light = INCOMPLETE, darker = ALL ALONE). No text.
  drawMoraleWash() {
    const m = combatRules.morale[this.state.morale];
    const color = m ? Phaser.Display.Color.HexStringToColor(m.tint).color : 0;
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      if (v) v.ch.setWash(color, h.alive && m ? m.tintAmount : 0);
    }
  },

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = this.slotWidth * i + this.slotWidth / 2;
      const view = this.makeView(unit, cx, SLOT_Y);
      // The hero's items: small item icons under the skill squares (drawDots).
      view.dots = this.add.container(cx - 2, SKILL_Y + SKILL_H / 2 + 14).setDepth(DEPTH.slot); // under the passive + skill squares
      view.slotX = cx;
      view.ch.setDepth(DEPTH.hero);
      for (const part of [view.bg, view.fill]) part.setDepth(DEPTH.heroBar);
      view.chipBox.setDepth(DEPTH.heroBar);

      // The two skill squares under the hero: tap to cast. Left = attack skill (red), right = support skill (green).
      // Each shows the skill's pixel icon (skillIcons.json); a skill without one shows its 2 letters.
      view.skillButtons = unit.skills.map((slot, j) => {
        const x = cx + (j === 0 ? -12 : 32); // a little right of centre: the passive icon sits on the left
        const textStyle = uiStyle('normal', UI.text);
        const iconKey = skillIconKey(this, slot.id);
        const button = {
          x: x - SKILL_W / 2,
          y: SKILL_Y - SKILL_H / 2,
          g: this.add.graphics().setDepth(3),
          code: iconKey ? this.add.image(x, SKILL_Y, iconKey).setScale(2).setDepth(4) : this.add.text(x, SKILL_Y, skillDefs[slot.id].short, textStyle).setOrigin(0.5).setDepth(4),
          cd: this.add.text(x, SKILL_Y, '', { ...textStyle, color: UI.text, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5),
        };
        this.add
          .zone(x, SKILL_Y, SKILL_W + 6, SKILL_H + 6)
          .setInteractive()
          .setDepth(6)
          .on('pointerdown', () => this.castFromUI(unit.uid, j));
        return button;
      });
      // The hero's passive: a small gold-framed icon left of the skill squares; tap it to read what it does.
      const pKey = skillIconKey(this, `passive_${unit.def.id}`, true);
      if (pKey) {
        const px = cx - 12 - SKILL_W / 2 - 13;
        view.passiveIcon = this.add.image(px, SKILL_Y, pKey).setDepth(4);
        this.add.zone(px, SKILL_Y, 26, 30).setInteractive().setDepth(6).on('pointerdown', () => this.showPassive(view));
      }
    });
  },

  // A tap on a passive icon: its name and what it does, in a small black window over the squad for a few seconds.
  // Any other tap closes it at once (that tap still does its normal job); tapping the same icon again closes it too.
  showPassive(view) {
    const p = view.unit.def.passive;
    if (!p) return;
    const again = this.passiveTip && this.passiveTip.active && this.passiveTip.view === view;
    this.hidePassive();
    if (again) return;
    sfx.play('tap');
    const t = this.add.text(GAME_WIDTH / 2, 0, `${p.name}\n${p.description}`, { fontFamily: UI.font, fontSize: '8px', color: UI.text, lineSpacing: 5, align: 'left', wordWrap: { width: GAME_WIDTH - 52, useAdvancedWrap: true } }).setOrigin(0.5, 1);
    const y = SKILL_Y - SKILL_H / 2 - 92;
    t.setY(y);
    const g = drawWindow(this.add.graphics(), GAME_WIDTH / 2 - t.width / 2 - 12, y - t.height - 12, t.width + 24, t.height + 24, { line: 0xf2b632 });
    this.passiveTip = this.add.container(0, 0, [g, t]).setDepth(DEPTH.hud + 1);
    const tip = this.passiveTip;
    tip.view = view;
    tip.shownAt = this.time.now;
    this.time.delayedCall(3500, () => { if (tip.active) this.tweens.add({ targets: tip, alpha: 0, duration: 250, onComplete: () => tip.destroy() }); });
  },

  hidePassive() {
    if (this.passiveTip && this.passiveTip.active) this.passiveTip.destroy();
    this.passiveTip = null;
  },

  // Taps on a skill square.
  castFromUI(heroUid, index) {
    if (this.mode !== 'fighting') return;
    this.showEvents(this.state.castSkill(heroUid, index));
  },

  // Redraws the skill squares (ready / cooling down) and health bars.
  refreshHud() {
    for (const hero of this.state.heroes) {
      const view = this.views.get(hero.uid);
      if (hero.alive) this.setBar(view); // health regeneration moves the bar
      const heart = hero.alive && this.state.heartStrikeIn(hero) === 0; // Sharpest Blade: the next attack is a Heart Strike
      const coil = hero.alive && this.state.coilReady(hero); // Kinetic Coil: 3 charges, the next attack is lightning
      if (view.steadyShown !== hero.steady || view.heartShown !== heart || view.coilShown !== coil) {
        view.steadyShown = hero.steady; // Steady Aim switched on or off: redraw the tags
        view.heartShown = heart; // (and the blade's glint)
        view.coilShown = coil;
        this.drawChips(view);
      }
      view.skillButtons.forEach((b, j) => {
        const slot = hero.skills[j];
        const skill = skillDefs[slot.id];
        const spell = this.state.currentSpell(hero, j);
        if (b.code.setText) b.code.setText(spell.short); // (no icon) a rotation skill shows its NEXT spell's letters
        const ready = this.mode === 'fighting' && this.state.canCast(hero, j);
        const g = b.g;
        g.clear();
        // A black window: its line is red (attack) or green (support) when it can be cast, grey while it cools down
        // (a grey fill drains from the top). The Mage's rotation always shows the NEXT spell's element (user).
        const kindColor = slot.kind === 'attack' ? UI.red : UI.green;
        const element = skill.rotation && damageTypes[spell.damageType] ? Phaser.Display.Color.HexStringToColor(damageTypes[spell.damageType].color).color : null;
        const line = element ?? (ready ? SKILL_COLORS[slot.kind].ready : 0x4a4a5a);
        const inset = this.drawSkillFrame(g, b, line, ready, hero.alive);
        if (slot.cooldownLeft > 0) {
          const frac = slot.cooldownLeft / skill.cooldownMs;
          g.fillStyle(0x2a2a36, 1).fillRect(b.x + inset, b.y + inset, SKILL_W - 2 * inset, Math.round((SKILL_H - 2 * inset) * frac));
        }
        this.drawPageMarks(g, b, slot, hero.alive);
        b.cd.setText(slot.cooldownLeft > 0 ? String(Math.ceil(slot.cooldownLeft / 1000)) : '');
        if (b.code.setColor) {
          b.code.setColor(ready ? kindColor : UI.dim);
          b.code.setVisible(slot.cooldownLeft <= 0); // the cooldown number takes the letters' place
        } else if (ready && hero.alive) b.code.clearTint();
        else b.code.setTint(hero.alive ? 0x5a5a66 : 0x2a2a30); // the icon darkens while it cools down (the number shows on it)
      });
    }
  },

  // A skill square's frame (session 41, user picked A: the gold theme frame was too distracting): a thin 2px line in
  // the skill's colour (red attack / green support / grey cooling / the Mage's next element) round a dark tile.
  // Returns the inset (where the cooldown shade starts).
  drawSkillFrame(g, b, line, ready, alive) {
    const alpha = alive ? 1 : 0.5, x = b.x, y = b.y, w = SKILL_W, h = SKILL_H;
    const tile = (i, c) => { g.fillStyle(c, alpha).fillRect(x + i + 2, y + i, w - 2 * i - 4, h - 2 * i).fillRect(x + i, y + i + 2, w - 2 * i, h - 2 * i - 4); };
    tile(0, line);
    tile(2, UI.goldTheme.slot);
    return 2;
  },

  // Skill book pages on a skill square: a small white dot per stat page along the bottom edge (rows of 5, going up),
  // a purple diamond per modifier along the top edge (rows of 4, going down). No page limit (user), so they wrap.
  drawPageMarks(g, b, slot, alive) {
    const pages = slot.pages || [];
    if (!pages.length) return;
    const a = alive ? 1 : 0.4;
    const stats = pages.filter((p) => p.kind === 'stat').length;
    for (let i = 0; i < stats; i++) {
      const row = Math.floor(i / 5), inRow = Math.min(5, stats - row * 5), k = i % 5;
      const x = b.x + SKILL_W / 2 + (k - (inRow - 1) / 2) * 7 - 2;
      const y = b.y + SKILL_H - 8 - row * 7;
      g.fillStyle(0x000000, a).fillRect(x - 1, y, 6, 6);
      g.fillStyle(0xf3eefc, a).fillRect(x, y + 1, 4, 4);
    }
    const mods = pages.filter((p) => p.kind === 'modifier').length;
    for (let i = 0; i < mods; i++) {
      const row = Math.floor(i / 4), k = i % 4;
      const cx = mods <= 2 ? (k === 0 ? b.x + 7 : b.x + SKILL_W - 7) : b.x + 6 + k * 9.3; // 1-2: the two top corners, as before
      const cy = b.y + 7 + row * 9;
      g.fillStyle(0x000000, a).fillTriangle(cx - 5, cy, cx, cy - 5, cx + 5, cy).fillTriangle(cx - 5, cy, cx, cy + 5, cx + 5, cy);
      g.fillStyle(0xc8a0ff, a).fillTriangle(cx - 3, cy, cx, cy - 3, cx + 3, cy).fillTriangle(cx - 3, cy, cx, cy + 3, cx + 3, cy);
    }
  },

  // Keeps a fighter's health bar attached to it while it moves.
  syncBar(view, baseY = view.ch.y + view.ch.hopOffset) {
    const y = baseY - view.unit.def.height * Math.abs(view.ch.scaleY) - 10;
    // The bar (and the Lv label left of it) stays on screen when the fighter stands at a side wall.
    const left = BAR_WIDTH / 2 + (view.lvl ? view.lvl.width + 5 : 2);
    const x = Phaser.Math.Clamp(view.ch.x, left, GAME_WIDTH - BAR_WIDTH / 2 - 2);
    view.bg.setPosition(x, y).setAlpha(view.ch.alpha);
    view.fill.setPosition(x - BAR_WIDTH / 2, y).setAlpha(view.ch.alpha);
    view.shieldFill.setPosition(x - BAR_WIDTH / 2, y - 5).setAlpha(view.ch.alpha);
    view.chipBox.setPosition(x, y - 18).setAlpha(view.ch.alpha);
    if (view.lvl) view.lvl.setPosition(x - BAR_WIDTH / 2 - 3, y).setAlpha(view.bg.alpha);
    this.blinkIcons(view);
  },

  // Shows or hides a fighter's health bar (and item dots).
  setBarsVisible(view, visible) {
    view.bg.setVisible(visible);
    view.fill.setVisible(visible);
    view.shieldFill.setVisible(visible);
    view.chipBox.setVisible(visible);
    if (view.lvl) view.lvl.setVisible(visible);
  },

  // Redraws the status tags on a fighter: one tag per kind of status it has right now.
  // How many Assault Breastplates the living heroes hold (its enemy icon shows this number).
  assaultCopies() {
    if (!(this.state.assaultShred() > 0)) return 0; // not yet (0.5s into the floor) or nobody holds one
    return this.state.heroes.reduce((n, h) => n + (h.alive ? h.items.filter((id) => id === 'assault_breastplate').length : 0), 0);
  },

  drawChips(view) {
    view.chipBox.removeAll(true);
    const kinds = [...new Set(view.unit.statuses.map((st) => st.type))];
    // An "every Nth attack" passive shows its count on the hero itself: after the (N-1)th attack the weapon
    // shines until the Nth goes off (a counter with a rotation shows the colour of the element that comes NEXT).
    const counter = view.unit.side === 'hero' && view.unit.alive ? view.unit.def.counter : null;
    const next = counter && counter.rotation ? counter.rotation[(view.unit.beatsFired || 0) % counter.rotation.length].color : null;
    // Sharpest Blade: the weapon glints gold when the next attack is a Heart Strike (a charged counter shows first).
    const charged = counter && view.unit.counterCount >= counter.every - 1;
    // Kinetic Coil: the weapon glows electric yellow when the next attack is its lightning strike.
    view.ch.setGlow(charged ? Phaser.Display.Color.HexStringToColor(next || counter.color || '#c8a0ff').color : view.heartShown ? Number(itemFxData.sharpest_blade.glint) : view.coilShown ? Number(itemFxData.kinetic_coil.glint) : null);
    // Status ICONS (statusIcons.json) in rows of 3 over the health bar, rows going up (a hero's item dots move
    // up above them). Stacking statuses (bleed, burn, poison, chill) show their
    // stack count just right of the icon. The icon pops up a little when it arrives or gains a stack.
    const S = CHAR_SCALE;
    // Assault Breastplate's aura (not a status): an ARMOR DOWN icon on every enemy, its number = copies held.
    const shredCopies = view.unit.side === 'enemy' && view.unit.alive ? this.assaultCopies() : 0;
    const extra = [...(view.unit.steady ? ['steady'] : []), ...(shredCopies ? ['assaultShred'] : [])];
    const list = iconList(statusIcons, kinds, (k) => (k === 'assaultShred' ? shredCopies : statusInfo[k] && (statusInfo[k].dot || statusInfo[k].stacking) ? this.state.stacks(view.unit, k) : 1), extra);
    const before = view.iconCounts || {};
    view.iconCounts = {};
    view.icons = [];
    view.iconRows = Math.ceil(list.length / 3);
    for (const e of iconLayout(list)) {
      view.iconCounts[e.id] = e.n;
      const img = this.add.image(e.x * S, e.y * S, statusIconKey(this, e.id)).setScale(S);
      view.chipBox.add(img);
      const parts = [img];
      if (e.n > 1) {
        const num = this.add
          .text((e.x + ICON_PX / 2) * S, e.y * S + 1, String(e.n), { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 3 })
          .setOrigin(0, 0.5);
        view.chipBox.add(num);
        parts.push(num);
      }
      if (before[e.id] !== e.n && (before[e.id] || 0) < e.n) this.tweens.add({ targets: parts, y: `-=${S}`, duration: 75, yoyo: true });
      view.icons.push({ id: e.id, parts });
    }
    // A status that has no icon yet still shows its old text tag, so nothing is ever hidden.
    let x = 0;
    const leftovers = kinds.filter((k) => !statusIcons[k] && statusInfo[k] && !statusInfo[k].instant);
    for (const k of leftovers) {
      const chip = this.add
        .text(x, -((Math.ceil(list.length / 3) || 0) * ICON_PX * S) - 10, statusInfo[k].label, { fontFamily: UI.font, fontSize: '8px', color: statusInfo[k].textColor, backgroundColor: statusInfo[k].color, padding: { x: 2, y: 1 } })
        .setOrigin(0, 0.5);
      view.chipBox.add(chip);
      x += chip.width + 3;
    }
  },

  // Makes a status icon blink in its last moments (every frame, from syncBar).
  blinkIcons(view) {
    if (!view.icons || !view.icons.length) return;
    const blinkOn = Math.floor(this.time.now / 100) % 2 === 1;
    for (const ic of view.icons) {
      const sts = view.unit.statuses.filter((st) => st.type === ic.id);
      const left = sts.length ? Math.max(...sts.map((st) => st.remaining)) : Infinity;
      const hide = blinkOn && left > 0 && left < 800;
      for (const p of ic.parts) p.setVisible(!hide);
    }
  },

  // The hero's items under its skill squares: one small framed item icon per kind of item (the frame tells
  // the rarity), with a number when it has several copies. 5 per row, 2 rows; more kinds show "+N".
  drawDots(view) {
    if (!view || !view.dots) return;
    view.dots.removeAll(true);
    const counts = new Map();
    for (const id of view.unit.items) counts.set(id, (counts.get(id) || 0) + 1);
    let kinds = [...counts.entries()];
    const perRow = 5, gap = 22, rowH = 22, maxShown = perRow * 2;
    let more = 0;
    if (kinds.length > maxShown) { more = kinds.length - (maxShown - 1); kinds = kinds.slice(0, maxShown - 1); }
    const n = kinds.length + (more ? 1 : 0);
    const at = (i) => { const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow); return [((i % perRow) - (inRow - 1) / 2) * gap, row * rowH]; };
    const style = { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    kinds.forEach(([id, count], i) => {
      const def = itemDefs[id];
      const [x, y] = at(i);
      view.dots.add(this.add.image(x, y, itemIconKey(this, id, def.rarity)));
      if (count > 1) view.dots.add(this.add.text(x + 11, y + 11, String(count), style).setOrigin(1, 1));
    });
    if (more) { const [x, y] = at(kinds.length); view.dots.add(this.add.text(x, y, `+${more}`, { ...style, fontSize: '8px' }).setOrigin(0.5)); }
  },

  // PAUSE and BATTLE SPEED (user, session 42; data/pause.json): two small buttons top right (on the floor counter's row). Pause =
  // this scene pauses and the Pause window opens over it; speed = cycles the BATTLE SPEED choices (saved, like the
  // Settings page). Back from the pause window: the settings are read again (speed may have changed there).
  drawControls() {
    const B = pauseData.buttons, P = B.pause, Sp = B.speed, g = this.add.graphics().setDepth(DEPTH.hud);
    drawWindow(g, P.x, B.y, P.w, B.h);
    const mx = P.x + P.w / 2, my = B.y + B.h / 2;
    g.fillStyle(0xffffff, 1).fillRect(mx - B.barGap / 2 - B.barW, my - B.barH / 2, B.barW, B.barH).fillRect(mx + B.barGap / 2, my - B.barH / 2, B.barW, B.barH);
    drawWindow(g, Sp.x, B.y, Sp.w, B.h);
    this.speedText = uiText(this, Sp.x + Sp.w / 2, my + 1, '', 'normal').setOrigin(0.5).setDepth(DEPTH.hud);
    this.refreshSpeed();
    this.add.zone(P.x, B.y, P.w, B.h).setOrigin(0).setInteractive().setDepth(DEPTH.hud).on('pointerup', () => this.openPause());
    this.add.zone(Sp.x, B.y, Sp.w, B.h).setOrigin(0).setInteractive().setDepth(DEPTH.hud).on('pointerup', () => this.cycleSpeed());
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.applySettings(); this.refreshSpeed(); });
  },

  refreshSpeed() {
    const opt = cardOf(settingsDefs, 'battleSpeed').options.find((o) => o.value === this.speed);
    this.speedText.setText(opt ? opt.label : `${this.speed}X`).setColor(this.speed > 1 ? UI.gold : UI.text);
  },

  cycleSpeed() {
    if (this.mode === 'lost') return;
    const opts = cardOf(settingsDefs, 'battleSpeed').options, i = opts.findIndex((o) => o.value === this.speed);
    const progress = loadProgress();
    changeSetting(progress, settingsDefs, 'battleSpeed', opts[(i + 1) % opts.length].value);
    saveProgress(progress);
    sfx.play('tap');
    this.applySettings();
    this.refreshSpeed();
  },

  openPause() {
    if (this.mode === 'lost' || !this.scene.isActive()) return;
    sfx.play('tap');
    this.scene.launch('Pause');
    this.scene.pause();
  },

  // GIVE UP (pause window): the run ends here like a defeat (game over summary, best floor kept).
  giveUp() {
    if (this.mode === 'lost') return;
    this.onLoss();
  },

  // The player's Settings (systems/settings.js): battle speed runs the whole scene (fight, tweens, timers) faster;
  // screen shake off = the camera never shakes; damage numbers off = popText skips numbers; vibration = buzz().
  applySettings() {
    const set = readSettings(loadProgress(), settingsDefs);
    this.speed = set.battleSpeed;
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
    const cam = this.cameras.main;
    if (!set.shake) cam.shake = function () { return this; };
    else delete cam.shake;
    this.showNumbers = set.damageNumbers;
    this.vibrate = set.vibration;
    this.lastBuzz = -Infinity;
  },

  // A short phone buzz (Settings VIBRATION on), never more often than settings.json vibration.gapMs.
  buzz() {
    const V = settingsDefs.vibration, now = performance.now();
    if (!this.vibrate || now - this.lastBuzz < V.gapMs) return;
    this.lastBuzz = now;
    try { if (navigator.vibrate) navigator.vibrate(V.ms); } catch { /* no buzz on this device */ }
  },

  drawAllBars() {
    for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
  },

  setBar(view) {
    view.fill.width = BAR_WIDTH * (view.unit.hp / view.unit.maxHp);
    view.shieldFill.width = Math.min(BAR_WIDTH, BAR_WIDTH * (this.state.shieldAmount(view.unit) / view.unit.maxHp));
  },

  // A hero in danger (combat.json heroDanger): below lowHpPercent health a soft red glow rises from the bottom edge of
  // the screen under that hero's slot, stronger the lower its health, pulsing slowly. A hero that just fell flares its
  // column once (v.fellAt). Pixel bands, no smoothing.
  drawDangerGlow() {
    const D = combatRules.heroDanger, g = this.dangerGlow;
    g.clear();
    const now = this.time.now, color = Phaser.Display.Color.HexStringToColor(D.glowColor).color;
    const bandH = Math.ceil(D.glowHeightPx / D.glowBands);
    this.state.heroes.forEach((h, i) => {
      const v = this.views.get(h.uid);
      if (!v) return;
      let strength = 0;
      const ratio = h.hp / h.maxHp;
      if (h.alive && this.mode === 'fighting' && ratio * 100 < D.lowHpPercent) {
        const deep = 1 - (ratio * 100) / D.lowHpPercent; // 0 at the line .. 1 at no health
        const pulse = 0.75 + 0.25 * Math.sin((now / D.pulseMs) * Math.PI * 2);
        strength = (D.glowMinStrength + (1 - D.glowMinStrength) * deep) * pulse;
      }
      if (v.fellAt !== undefined && now - v.fellAt < D.fellGlowMs) strength = Math.max(strength, 1.4 * (1 - (now - v.fellAt) / D.fellGlowMs));
      if (strength <= 0) return;
      const x = this.slotWidth * i;
      for (let k = 0; k < D.glowBands; k++) {
        const fade = 1 - k / D.glowBands;
        g.fillStyle(color, Math.min(1, D.glowAlpha * strength * fade * fade));
        g.fillRect(x, GAME_HEIGHT - (k + 1) * bandH, this.slotWidth, bandH);
      }
    });
  },

  // The boss bar at the top of the screen: its name, a big health bar, its heat gauge (Ignatius) and
  // armor plates (Frost Warden). Twin bosses get one bar each.
  drawBossHud() {
    if (!this.bossG) {
      this.bossG = this.add.graphics().setDepth(DEPTH.hud);
      this.bossNames = [];
    }
    const g = this.bossG;
    g.clear();
    const bosses = this.mode === 'fighting' ? this.state.enemies.filter((u) => u.def.boss && (u.alive || this.state.enemies.some((o) => o.alive && o.reviveUid === u.uid))) : [];
    const W = 300, X = (GAME_WIDTH - W) / 2;
    bosses.forEach((u, i) => {
      const y = 104 + i * 34;
      let t = this.bossNames[i];
      if (!t) t = this.bossNames[i] = this.add.text(X, 0, '', { fontFamily: UI.font, fontSize: '8px', color: '#ffe0d8', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 1).setDepth(DEPTH.hud);
      t.setText(u.dust ? `${u.name} (dust)` : u.alive ? u.name : `${u.name} (down)`).setPosition(X, y - 3).setVisible(true);
      g.fillStyle(0x000000, 0.85).fillRect(X - 2, y - 2, W + 4, 12);
      g.fillStyle(0x3a1018, 1).fillRect(X, y, W, 8);
      const p = u.alive && !u.dust ? Math.max(0, u.hp / u.maxHp) : 0;
      g.fillStyle(u.dust ? 0x8a8a9a : 0xe04b4b, 1).fillRect(X, y, W * p, 8);
      g.fillStyle(0xffffff, 0.25).fillRect(X, y, W * p, 2);
      if (u.def.plates) for (let k = 0; k < u.def.plates.count; k++) {
        const px = X + W - 10 - k * 14;
        g.fillStyle(0x000000, 1).fillRect(px - 1, y - 13, 12, 9);
        g.fillStyle(k < u.plates ? 0xbfe0ff : 0x30384a, 1).fillRect(px, y - 12, 10, 7);
      }
      if (u.def.heat) {
        const hp = Math.min(1, u.heat / u.def.heat.max);
        g.fillStyle(0x000000, 0.85).fillRect(X - 2, y + 11, W + 4, 6);
        g.fillStyle(hp > 0.8 ? 0xffe060 : 0xff8a2a, 1).fillRect(X, y + 12, W * hp, 4);
      }
    });
    for (let i = bosses.length; i < this.bossNames.length; i++) this.bossNames[i].setVisible(false);
  },
};
