// TAP-TO-AIM (user's design): tapping a skill that hits ONE enemy (BattleState.aimable) does not fire it at once. The
// fight KEEPS RUNNING (user's pick), the floor dims, that skill button glows, every enemy that can be hit gets a red ring,
// and the next tap on an enemy fires the skill at it (BattleState.castSkill(uid, index, enemyUid)). Tapping the glowing
// button again cancels (the skill stays ready); another skill button = leave aim mode and press that one; a tap on the
// empty floor does nothing (no accidental squad walk). Aim mode ends by itself when the skill can no longer be cast
// (hero stunned / dead, the fight ends) or no enemy is left. Numbers: combat.json `aim`.
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../../config.js';
import combatRules from '../../data/combat.json';
import * as sfx from '../../audio/sfx.js';
import { DEPTH, SKILL_W, SKILL_H } from './shared.js';

const A = combatRules.aim;

export const aimMethods = {
  // A skill button was tapped: aimable skills enter aim mode, the rest fire at once (castFromUI).
  pressSkill(heroUid, index) {
    if (this.aiming) {
      const same = this.aiming.heroUid === heroUid && this.aiming.index === index;
      this.endAim();
      if (same) { sfx.play('tap'); return; } // tap the glowing button again = cancel
    }
    if (this.mode !== 'fighting') return;
    const hero = this.state.heroes.find((h) => h.uid === heroUid);
    if (!hero || !this.state.canCast(hero, index)) return this.castFromUI(heroUid, index); // not ready: as before (nothing happens)
    if (!this.state.aimable(hero, index) || !this.state.targetableEnemies().length) return this.castFromUI(heroUid, index);
    this.startAim(heroUid, index);
  },

  startAim(heroUid, index) {
    const view = this.views.get(heroUid);
    const btn = view && view.skillButtons && view.skillButtons[index];
    if (!btn) return;
    sfx.play('tap');
    this.aiming = { heroUid, index, btn, t0: this.time.now };
    // the dim: over the floor and the dock, under the fighters (they stay bright, so enemies are easy to see)
    this.aimDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setDepth(DEPTH.hero - 0.1);
    this.tweens.add({ targets: this.aimDim, fillAlpha: A.dimAlpha, duration: A.dimInMs });
    this.aimRings = this.add.graphics().setDepth(DEPTH.hero - 0.05);
    // the chosen button comes up above the dim and gets a glowing frame
    btn.oldDepth = [btn.g.depth, btn.code.depth, btn.cd.depth];
    btn.g.setDepth(DEPTH.hero - 0.04); btn.code.setDepth(DEPTH.hero - 0.03); btn.cd.setDepth(DEPTH.hero - 0.02);
    this.aimGlow = this.add.graphics().setDepth(DEPTH.hero - 0.01);
    this.aimHint = this.add.text(btn.x + SKILL_W / 2, btn.y - 10, A.hint, { fontFamily: UI.font, fontSize: '8px', color: A.hintColor, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(DEPTH.hud);
    // one invisible layer over everything catches the next tap (the pause buttons above it still work)
    this.aimCatch = this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0).setInteractive().setDepth(DEPTH.hud - 0.5);
    this.aimCatch.on('pointerdown', (p) => this.aimTap(p));
  },

  aimTap(p) {
    const aim = this.aiming;
    if (!aim) return;
    // a skill button: the same one cancels, another one leaves aim mode and is pressed
    for (const v of this.views.values()) {
      if (!v.skillButtons) continue;
      for (const [j, b] of v.skillButtons.entries()) {
        if (p.worldX >= b.x - 3 && p.worldX <= b.x + SKILL_W + 3 && p.worldY >= b.y - 3 && p.worldY <= b.y + SKILL_H + 3) { this.pressSkill(v.unit.uid, j); return; }
      }
    }
    const target = this.enemyAt(p.worldX, p.worldY, combatRules.moveOrders.enemyTapRadiusPx);
    if (!target) return; // empty floor: nothing (stay aiming)
    const { heroUid, index } = aim;
    this.endAim();
    this.ring(target, A.ringColor);
    this.showEvents(this.state.castSkill(heroUid, index, target.unit.uid));
  },

  // Every frame while aiming: rings round the enemies that can be hit, the button's glow; leave when it can't go off.
  drawAim() {
    const aim = this.aiming;
    if (!aim) return;
    const hero = this.state.heroes.find((h) => h.uid === aim.heroUid);
    if (this.mode !== 'fighting' || !hero || !this.state.canCast(hero, aim.index) || !this.state.targetableEnemies().length) { this.endAim(); return; }
    const pulse = 0.5 + 0.5 * Math.sin((this.time.now - aim.t0) / A.pulseMs * Math.PI * 2);
    const r = this.aimRings; r.clear();
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.side !== 'enemy' || !u.alive || this.state.untargetable(u)) continue;
      const c = this.center(v);
      r.lineStyle(2, A.ringColor, 0.55 + 0.45 * pulse);
      r.strokeEllipse(c.x, u.y ?? c.y, A.ringW, A.ringH);
    }
    const b = aim.btn, g = this.aimGlow; g.clear();
    g.lineStyle(3, A.glowColor, 0.6 + 0.4 * pulse); g.strokeRect(b.x - 3, b.y - 3, SKILL_W + 6, SKILL_H + 6);
    g.lineStyle(1, 0xffffff, 0.9); g.strokeRect(b.x - 1, b.y - 1, SKILL_W + 2, SKILL_H + 2);
  },

  endAim() {
    const aim = this.aiming;
    if (!aim) return;
    this.aiming = null;
    const b = aim.btn;
    if (b.oldDepth) { b.g.setDepth(b.oldDepth[0]); b.code.setDepth(b.oldDepth[1]); b.cd.setDepth(b.oldDepth[2]); }
    for (const k of ['aimDim', 'aimRings', 'aimGlow', 'aimHint', 'aimCatch']) { if (this[k]) this[k].destroy(); this[k] = null; }
  },
};

