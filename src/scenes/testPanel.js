// TEST ONLY (remove before release, with DebugScene): an HTML panel over the game to jump to any floor (the squad
// keeps its levels, items and skill pages; dead heroes come back), pick what that floor is (a fight or a room),
// give any item to a hero, level everyone up and heal. Opened by the 'TEST: tools' button (DebugScene).
import rawItems from '../data/items.json';
import rarities from '../data/rarities.json';
import roomRules from '../data/rooms.json';

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
let panel = null;

const css = (c) => `#${Number(c).toString(16).padStart(6, '0')}`;

export function toggleTestPanel(game) {
  if (panel) { panel.remove(); panel = null; return; }
  panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:50%;top:44px;transform:translateX(-50%);width:min(370px,calc(100vw - 16px));max-height:calc(100vh - 56px);' +
    'overflow:auto;background:#000;border:2px solid #ffe08a;color:#fff;font:12px monospace;padding:10px;box-sizing:border-box;z-index:10;';
  document.body.appendChild(panel);
  const battle = () => {
    const s = game.scene.getScene('Battle');
    return s && game.scene.isActive('Battle') && s.state ? s : null;
  };
  const btn = 'background:#222;color:#ffe08a;border:1px solid #ffe08a;font:12px monospace;padding:6px 8px;cursor:pointer;';
  const field = 'background:#111;color:#fff;border:1px solid #888;font:12px monospace;padding:5px;';
  const rooms = Object.entries(roomRules.kinds).map(([k, r]) => `<option value="${k}">${r.name} (${k})</option>`).join('');
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="color:#ffe08a">TEST TOOLS</b><button data-a="close" style="${btn}">X</button></div>
    <div data-r="msg" style="color:#6ee07a;min-height:14px;margin-bottom:6px"></div>
    <div style="margin-bottom:10px">
      Floor <input data-r="floor" type="number" min="1" value="20" style="${field}width:64px">
      <select data-r="room" style="${field}max-width:170px"><option value="">normal (game picks)</option><option value="fight">fight</option>${rooms}</select>
      <button data-a="jump" style="${btn}margin-top:6px">Go to floor</button>
    </div>
    <div style="margin-bottom:10px"><button data-a="level" style="${btn}">All heroes +1 level</button>
      <button data-a="heal" style="${btn}">Heal all</button></div>
    <div style="margin-bottom:6px">Give to <select data-r="hero" style="${field}"></select>
      <input data-r="find" placeholder="search item" style="${field}width:120px"></div>
    <div data-r="items"></div>`;
  const $ = (r) => panel.querySelector(`[data-r="${r}"]`);
  const say = (t, bad = false) => { $('msg').textContent = t; $('msg').style.color = bad ? '#ff7a5a' : '#6ee07a'; };

  const fillHeroes = () => {
    const s = battle();
    $('hero').innerHTML = s ? s.state.heroes.map((h) => `<option value="${h.uid}">${h.def.name}${h.alive ? '' : ' (dead)'}</option>`).join('') : '<option>no run</option>';
  };
  const items = Object.entries(rawItems)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
  const fillItems = () => {
    const q = $('find').value.trim().toLowerCase();
    $('items').innerHTML = items
      .filter((it) => !q || it.name.toLowerCase().includes(q) || it.rarity.includes(q))
      .map((it) => `<div data-item="${it.id}" style="border-left:4px solid ${css(rarities[it.rarity].color)};padding:5px 6px;margin:3px 0;background:#151515;cursor:pointer">
        <b style="color:${css(rarities[it.rarity].color)}">${it.name}</b> <span style="color:#8a8a9a">${it.rarity}</span><br><span style="color:#ccc">${it.description || ''}</span></div>`)
      .join('');
  };
  fillHeroes();
  fillItems();
  $('find').addEventListener('input', fillItems);

  panel.addEventListener('click', (ev) => {
    const s = battle();
    const row = ev.target.closest('[data-item]');
    if (row) {
      if (!s) return say('Start a run first', true);
      const hero = s.state.heroes.find((h) => String(h.uid) === $('hero').value);
      if (!hero || !hero.alive) return say('That hero is dead (Go to floor brings them back)', true);
      s.giveItem(row.dataset.item, hero.uid);
      return say(`Gave ${rawItems[row.dataset.item].name} to ${hero.def.name}`);
    }
    const a = ev.target.dataset.a;
    if (a === 'close') return toggleTestPanel(game);
    if (!a) return;
    if (!s) return say('Start a run first', true);
    if (a === 'jump') {
      const floor = Math.max(1, Math.floor(Number($('floor').value) || 1));
      s.testJump(floor, $('room').value || null);
      say(`Floor ${floor}`);
      setTimeout(fillHeroes, 300);
    } else if (a === 'level') {
      s.testLevelUp();
      say('Everyone +1 level');
    } else if (a === 'heal') {
      s.testHeal();
      say('Everyone healed');
    }
  });
}
