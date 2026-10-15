// Builds the item sheet data: every item's total effect at 1, 5, 10, 20 copies, with the game's stacking rules.
import fs from 'fs';
const ROOT = new URL('../../../', import.meta.url).pathname;
const items = JSON.parse(fs.readFileSync(ROOT + 'src/data/items.json'));
const icons = JSON.parse(fs.readFileSync(ROOT + 'src/data/itemIcons.json'));
const rarities = JSON.parse(fs.readFileSync(ROOT + 'src/data/rarities.json'));
const minions = JSON.parse(fs.readFileSync(ROOT + 'src/data/minions.json'));
const statuses = JSON.parse(fs.readFileSync(ROOT + 'src/data/statuses.json'));
const { framedIconPixels } = await import(ROOT + 'src/systems/itemIcons.js');
const N = [1, 5, 10, 20];
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (v) => `${r1(v)}%`;
const STAT = { attack: 'attack', health: 'max health', defense: 'defense', resist: 'resist', crit: 'crit', evasion: 'evasion', attackEfficiency: 'attack speed' };
const CAPNOTE = { crit: 100, evasion: 70 };
const NAMES = { armorBreak: 'Armor Break', regenBoost: 'Regen' };
const statusName = (s) => NAMES[s] || s.charAt(0).toUpperCase() + s.slice(1);
const sec = (ms) => `${r1(ms / 1000)}s`;

// Sum one effect over n copies (falloff / cap / unique like items.js).
function total(e, n) {
  let v = 0;
  for (let i = 0; i < n; i++) v += (e.percent ?? e.flat ?? 0) * (e.falloffRatio ? Math.pow(e.falloffRatio, i) : 1);
  if (e.unique) v = e.percent;
  if (e.cap !== undefined) v = Math.min(e.cap, v);
  return v;
}
function procLine(e, n, item) {
  const copies = e.unique ? 1 : n;
  const chances = [];
  for (let i = 0; i < copies; i++) chances.push(Math.min(100, e.chance * (e.falloffRatio ? Math.pow(e.falloffRatio, i) : 1)));
  const sum = chances.reduce((a, b) => a + b, 0);
  const any = 100 * (1 - chances.reduce((a, c) => a * (1 - c / 100), 1));
  const odds = e.chance >= 100 ? 'every attack' : copies === 1 ? `${r1(chances[0])}% per attack` : `${r1(sum)} per 100 attacks (${r1(any)}% chance at least one)`;
  let what = '';
  if (e.doubleHit) what = 'hit the same enemy again';
  else if (e.chain) what = `${e.chain.damageMultiplier * 100}% electric bolt jumping to ${e.chain.jumps} more enemies + Shock`;
  else if (e.tornado) what = `tornado (${e.tornado.damageMultiplier * 100}% every ${sec(e.tornado.tickMs)} for ${sec(e.tornado.durationMs)}, max ${e.tornado.max} at once)`;
  else if (e.strike) what = `${r1(e.strike.damageMultiplier * 100)}% ${e.strike.damageType} hit`;
  else if (e.apply) what = e.apply.map((a) => {
    if (a.status === 'buff') return `${e.targets === 'squad' ? 'squad' : a.to === 'selfAndAlly' ? 'holder + 1 ally' : 'holder'} ${a.mods.map((m) => `+${m.percent ?? m.flat}${m.percent ? '%' : ''} ${STAT[m.stat]}`).join(', ')} for ${sec(a.durationMs + (a.durationPerCopyMs || 0) * (n - 1))}`;
    if (a.status === 'regenBoost') return `+${a.percentMaxHpPerSec}%/s regen`;
    const dmg = a.damageMultiplier ? `, ${r1(a.damageMultiplier * (a.scalesWithCopies ? n : 1) * 100)}% per tick` : '';
    return `${statusName(a.status)} ${sec(a.durationMs)}${dmg}`;
  }).join(' + ');
  if (e.silent && e.strike) return { text: `${n > 1 && !e.unique ? `${n} ice hits of ${r1(e.strike.damageMultiplier * 100)}% (=${r1(e.strike.damageMultiplier * 100 * n)}% attack)` : what} on every attack`, sum };
  if (e.silent && e.unique) return { text: `1 ${what} stack per attack (doesn't grow)`, sum };
  return { text: `${odds}: ${what}${e.meleeOnly ? ' (melee only)' : ''}${e.unique ? ' — chance does not grow' : ''}`, sum };
}
// Specials: what the summed number means (formulas from BattleState).
const SPECIAL = {
  regen: (v) => `+${r1(v)}% max health per second in fights`,
  block: (v) => `${r1(v)}% chance to block a hit (2.5s recharge)`,
  thorns: (v) => `reflects ${r1(v)}% of melee damage taken`,
  skillDamage: (v) => `skills +${r1(v)}% damage`,
  skillSplash: (v) => `${r1(v)}% chance a skill also hits neighbours`,
  lifesteal: (v) => `heals ${r1(v)}% of damage dealt`,
  lifestealShare: (v) => `${r1(Math.min(100, v))}% chance to share the heal with the squad`,
  critDamage: (v) => `crits deal +${r1(v)}% more`,
  critDebuff: () => `every crit adds a random debuff`,
  clearHeal: (v) => `heals ${r1(v)}% max health on each floor cleared`,
  suckerPunch: (v) => `+${r1(v)}% on the first basic hit on each enemy`,
  killHeal: (v) => `heals ${r1(v)}% max health per kill`,
  secondWind: (v, n) => `heals 30% once below 40% (one flask per floor, ${n} flask${n > 1 ? 's' : ''} in total)`,
  fullVigor: (v) => `+${r1(v)}% damage at full health`,
  brawlerMax: (v) => `+2% per hit in a row on one enemy, up to +${r1(v)}% (needs ${Math.ceil(v / 2)} hits in a row)`,
  toughSkin: (v, n) => `first hit each floor deals ${r1(Math.min(90, 100 * (1 - 0.4 * Math.pow(0.75, n - 1))))}% less`,
  cooldown: (v) => `cooldowns -${r1(Math.min(50, v))}%${v >= 50 ? ' (limit reached)' : ''}`,
  gagRune: (v) => `holder's stuns/freezes also Silence ${r1(1 + v)}s`,
  fireArrows: (v) => `ranged: 50% chance per attack for a ${r1(v)}% fire hit`,
  executioner: (v) => `+${r1(v)}% vs enemies under 25% health`,
  magmaCore: (v) => `+${r1(v)}% vs burning enemies`,
  burnSpeed: (v) => `burns tick ${r1(v)}% faster${v >= 100 ? ' (limit)' : ''}`,
  shatterHammer: (v) => `+${r1(v)}% vs frozen enemies (breaks the freeze)`,
  bloodChalice: (v) => `+${r1(v)}% vs bleeding enemies`,
  chaliceHeal: (v) => `heals ${r1(v)}% on killing a bleeding enemy`,
  plagueFlask: (v) => `half its poison spreads to ${r1(v)} ${v === 1 ? 'enemy' : 'enemies'} on death (fights have 1-4 enemies)`,
  exploiter: (v) => `+${r1(v)}% vs enemies with 3+ debuffs`,
  hunterSigil: (v) => `first hit Marks: +${r1(v)}% damage taken from the squad for ${r1(5 + 2.5 * (v / 10 - 1))}s`,
  thousandCuts: () => `+1 extra Bleed stack on every bleed (doesn't grow)`,
  knifeBurst: (v) => `bleeding enemy dying bursts ${r1(v)}% into its neighbours`,
  frozenThunderbolt: (v) => `electric hits: ${r1(v)}% ice burst + 2 Chill on neighbours`,
  shieldBonus: (v) => `shields received +${r1(v)}%`,
  overhealRing: (v) => `${r1(Math.min(100, v))}% of overheal becomes a shield (max 25% health)`,
  spikedAegis: (v) => `shield breaks: ${r1(v)}% hit on every enemy`,
  hornDamage: (v) => `taunted enemies take +${r1(v)}%`,
  spiteMail: (v) => `+${r1(v)} defense while taunting`,
  spiteReflect: (v) => `reflects ${r1(v)}% melee damage while taunting`,
  martyr: () => `8% chance to take a hit for an ally (doesn't grow)`,
  martyrCopies: (v, n) => `step-in cooldown ${r1(6 * Math.pow(0.8, n - 1))}s, costs ${r1(3 * Math.pow(0.8, n - 1))}% health`,
  fireHeart: (v) => `fire shield ${r1(v)}% max health each floor (regrows, burns attackers)`,
  grimoireChance: (v) => `${r1(v)}% chance when healed${v >= 50 ? ' (limit)' : ''}`,
  grimoireDamage: (v) => `green fireball ${r1(v)}% fire`,
  baton: (v) => `support skills and songs +${r1(v)}% stronger`,
  echo: (v) => `${r1(v)}% chance a skill casts twice${v >= 60 ? ' (limit)' : ''}`,
  echoCopies: (v, n) => `echo at ${Math.min(100, 60 + 10 * (n - 1))}% power`,
  metronome: (v) => `+${r1(v)}% on 4th-attack hits — no hero has one now: does nothing`,
  mimic: () => `10% chance when hit (doesn't grow)`,
  mimicCopies: (v, n) => (n > 1 ? `mimic +${50 * (n - 1)}% health and attack` : 'a plain mimic'),
  boneCharm: (v) => `ALL minions +${r1(v)}% health and attack`,
  whistleCap: (v) => `weak minion cap +${Math.min(4, v)} (squad limit 4)`,
  whistleSpeed: (v) => `weak minions +${r1(v)}% attack speed`,
  graveDust: (v) => `weak minions explode on death (x${r1(v)} damage)`,
  necroCrownCap: (v) => `weak minion cap +${Math.min(6, v)} (squad limit 6)`,
  necroCrownKill: () => `every kill raises a skeleton`,
};
const groups = JSON.parse(fs.readFileSync(new URL('./verdicts.json', import.meta.url)));
const verdict = {}; for (const g of groups) for (const [id, , fix] of g.items) verdict[id] = { key: g.key, fix };
const rows = [];
for (const [id, it] of Object.entries(items)) {
  if (it.kind === 'potion') continue;
  const cells = N.map((want) => {
    const n = Math.min(want, it.maxStacks ?? Infinity);
    const parts = [];
    let upkeep = 0;
    for (const e of it.effects) {
      if (e.stat) {
        const v = total(e, n);
        const cap = CAPNOTE[e.stat];
        parts.push(`+${r1(v)}${e.percent !== undefined ? '%' : ''} ${STAT[e.stat]}${e.flat !== undefined && (e.stat === 'attack' || e.stat === 'health') ? ' (flat)' : ''}${cap && v > cap ? ` (only ${cap} counts)` : ''}`);
      } else if (e.damageBonus) parts.push(`+${r1(total(e, n))}% ${e.damageBonus} damage`);
      else if (e.special) parts.push((SPECIAL[e.special] || ((v) => `${e.special} ${v}`))(total(e, n), n));
      else if (e.proc) parts.push(procLine(e, n, it).text);
      else if (e.minionSpawner) {
        const m = minions[e.minionSpawner.minion];
        const nm = m.name || e.minionSpawner.minion, k = Math.min(4, n);
        parts.push(`${k} ${nm}${k > 1 ? 's' : ''} at fight start, then ${n} more every ${sec(e.minionSpawner.minMs)}; only 4 item minions can be alive${n > 4 ? ' (extra ones push out the oldest)' : ''}`);
        upkeep = 6 * n;
      } else if (e.greaterMinion) {
        const m = minions[e.greaterMinion];
        parts.push(`1 ${m.name || e.greaterMinion}${n > 1 ? ` with +${50 * (n - 1)}% health and attack` : ''}`);
        upkeep = 12;
      }
    }
    if (upkeep) parts.push(`holder -${upkeep}% attack speed and defense while it lives${upkeep >= 100 ? ' (!)' : ''}`);
    return { n, capped: n < want, text: parts };
  });
  const frame = rarities[it.rarity].frame;
  const grid = framedIconPixels(icons[id], frame);
  const pal = [], map = new Map();
  const px = grid.map((row) => row.map((c) => { if (c === null) return '.'; if (!map.has(c)) { map.set(c, pal.length); pal.push('#' + c.toString(16).padStart(6, '0')); } return String.fromCharCode(97 + map.get(c)); }).join(''));
  rows.push({ id, name: it.name, rarity: it.rarity, type: it.type, scope: it.scope || 'self', max: it.maxStacks ?? null, desc: it.description, verdict: verdict[id], cells, icon: { pal, px } });
}
fs.writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(rows));
console.log(rows.length);
for (const r of rows.slice(0, 4).concat(rows.filter((r) => ['war_banner', 'tough_skin', 'rat_cage', 'chill_band', 'jolly_banner'].includes(r.id)))) console.log(r.name, '|', r.cells.map((c) => c.text.join('; ')).join('  ||  '));
