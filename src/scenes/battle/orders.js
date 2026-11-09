// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// The player's hands: dragging a hero onto an enemy, tapping the floor to move, the order lines (docs/systems/combat.md).
import combatRules from '../../data/combat.json';
import * as sfx from '../../audio/sfx.js';
import { bodyBox } from '../../systems/statusFx.js';
import { charScale, DEPTH } from './shared.js';

export const ordersMethods = {
  // DRAG ORDERS (user's sketch): press a living hero during a fight and drag: a red arrow follows the finger and the
  // enemy under it gets a ring; let go over an enemy = only that hero attacks it (BattleState.setOrder). Letting go
  // anywhere else does nothing. Tap-to-focus on enemies is unchanged.
  startOrderDrag(view, pointer) {
    if (this.mode !== 'fighting' || !view.unit.alive) return;
    this.orderDrag = { view, x: pointer.worldX, y: pointer.worldY };
    if (!this.orderInput) {
      this.orderInput = true;
      this.input.on('pointermove', (p) => { if (this.orderDrag) { this.orderDrag.x = p.worldX; this.orderDrag.y = p.worldY; } });
      this.input.on('pointerup', (p) => this.endOrderDrag(p));
      this.input.on('gameout', () => { this.orderDrag = null; });
    }
  },

  // The enemy under a point (the nearest living, hittable one within its body), or null.
  enemyAt(x, y) {
    let best = null, bestD = Infinity;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.side !== 'enemy' || !u.alive || this.state.untargetable(u)) continue;
      const c = this.center(v);
      const reach = Math.max(40, (bodyBox(u.def.parts, u.def.height).hw + 6) * charScale(u.def));
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < reach && d < bestD) { best = v; bestD = d; }
    }
    return best;
  },

  endOrderDrag(p) {
    const drag = this.orderDrag;
    this.orderDrag = null;
    if (!drag || this.mode !== 'fighting') return;
    // The enemy under the finger, or the one that was lit up a moment ago (small enemies walk; fingers are big).
    const lit = drag.over && drag.over.unit.alive && this.views.get(drag.over.unit.uid) === drag.over ? drag.over : null;
    const target = this.enemyAt(p.worldX, p.worldY) || lit;
    if (!target) { // let go over the floor = only that hero walks there (move order)
      const from = this.center(drag.view);
      if (Math.hypot(p.worldX - from.x, p.worldY - from.y) >= 12 && this.onFloor(p.worldX, p.worldY)) this.orderMove([drag.view.unit], p.worldX, p.worldY);
      return;
    }
    if (!this.state.setOrder(drag.view.unit.uid, target.unit.uid)) return;
    sfx.play('tap');
    this.ring(target, 0xffa040);
    this.popText(drag.view, 'On it!', '#ffa040');
  },

  // Is a point on the fight floor (where fighters can stand)? Same band the rules keep fighters in.
  onFloor(x, y) {
    const L = combatRules.movement.layout;
    return x >= 0 && x <= L.width && y >= L.enemyY + L.topMarginY - 10 && y <= L.heroY + 10;
  },

  // MOVE ORDERS (user's pick): a short tap on the empty fight floor (nothing tappable under the finger, no hero drag)
  // = the whole squad walks there side by side (BattleState.moveSquad). A tap just next to an enemy still focuses it.
  floorTap(p) {
    const press = this.floorPress;
    this.floorPress = null;
    if (!press || !press.free || this.mode !== 'fighting' || this.orderDrag) return;
    if (Math.hypot(p.worldX - press.x, p.worldY - press.y) > 12 || !this.onFloor(p.worldX, p.worldY)) return;
    const near = this.enemyAt(p.worldX, p.worldY);
    if (near) { this.state.setFocus(near.unit.uid); return; }
    this.orderMove(null, p.worldX, p.worldY);
  },

  // Sends heroes (null = the whole squad) to a floor spot; the spot gets a small white ring and the heroes say 'Moving!'.
  orderMove(heroes, x, y) {
    const events = [];
    const moved = heroes ? heroes.filter((h) => this.state.setMove(h.uid, x, y, events)) : this.state.moveSquad(x, y, events);
    if (!moved.length) return;
    this.showEvents(events);
    sfx.play('tap');
    if (heroes) this.popText(this.views.get(moved[0].uid), 'Moving!', '#ffffff');
    this.moveTap = { x, y, at: this.time.now };
  },

  // Every frame: the drag arrow (while dragging), and for every hero with an order a thin orange ring under its
  // target and a small one under the hero itself (so you can see who has an order).
  drawOrders() {
    if (!this.orderG) this.orderG = this.add.graphics().setDepth(DEPTH.marker + 0.5);
    if (!this.arrowG) this.arrowG = this.add.graphics().setDepth(DEPTH.popup - 0.5);
    const g = this.orderG, a = this.arrowG;
    g.clear();
    a.clear();
    const foot = (v) => ({ x: v.ch.x, y: v.ch.y + v.ch.hopOffset + (v.groundY - v.ch.homeY) + 6 });
    for (const h of this.state.heroes) {
      const t = h.alive && this.state.orderOf(h);
      const hv = this.views.get(h.uid), tv = t && this.views.get(t.uid);
      if (!hv || !tv) continue;
      const tf = foot(tv), hf = { x: hv.ch.x, y: hv.ch.y + 4 };
      g.lineStyle(2, 0xffa040, 0.9).strokeEllipse(tf.x, tf.y, 54, 14);
      g.lineStyle(2, 0xffa040, 0.6).strokeEllipse(hf.x, hf.y, 34, 9);
    }
    // Move orders: a small white ring on the floor where each walking hero is going, and a short ripple where you tapped.
    for (const h of this.state.heroes) if (h.alive && h.walkTo) g.lineStyle(2, 0xffffff, 0.75).strokeEllipse(h.walkTo.x, h.walkTo.y + 4, 30, 9);
    const mt = this.moveTap, mq = mt ? (this.time.now - mt.at) / 300 : 1;
    if (mq < 1) g.lineStyle(2, 0xffffff, 0.8 * (1 - mq)).strokeEllipse(mt.x, mt.y + 4, 20 + 30 * mq, 6 + 9 * mq);
    const d = this.orderDrag;
    if (!d || !d.view.unit.alive || this.mode !== 'fighting') { if (d) this.orderDrag = null; return; }
    const from = this.center(d.view);
    const over = this.enemyAt(d.x, d.y);
    d.over = over || (d.over && Math.hypot(this.center(d.over).x - d.x, this.center(d.over).y - d.y) < 70 ? d.over : null); // stays lit a little while the finger slips off
    const to = over ? this.center(over) : { x: d.x, y: d.y };
    const ang = Math.atan2(to.y - from.y, to.x - from.x), len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < 12) return; // a tap, not a drag yet
    if (!over && !d.over && !this.onFloor(d.x, d.y)) return; // off the floor: letting go here does nothing
    const col = over || d.over ? 0xff4d4d : 0xffffff; // red = attack that enemy, white = walk to this spot
    a.lineStyle(6, 0x1a1020, 0.8).lineBetween(from.x, from.y, to.x - Math.cos(ang) * 10, to.y - Math.sin(ang) * 10);
    a.lineStyle(3, col, 1).lineBetween(from.x, from.y, to.x - Math.cos(ang) * 10, to.y - Math.sin(ang) * 10);
    const head = (k, w) => [to.x - Math.cos(ang) * k + Math.cos(ang + Math.PI / 2) * w, to.y - Math.sin(ang) * k + Math.sin(ang + Math.PI / 2) * w];
    const [l1, l2] = head(16, 9), [r1, r2] = head(16, -9);
    a.fillStyle(col, 1).fillTriangle(to.x, to.y, l1, l2, r1, r2);
    if (!over && !d.over) a.lineStyle(2, 0xffffff, 0.9).strokeEllipse(to.x, to.y + 4, 30, 9);
    if (over) { const f = foot(over); a.lineStyle(3, 0xff4d4d, 1).strokeEllipse(f.x, f.y, 62, 16); }
  },
};
