// Builds the SKILL ICONS review page: every hero's attack skill, support skill and passive icon
// (src/data/skillIcons.json, drawn by scripts/art/skill-icons.mjs), shown big and at game size, and the
// recoloured skill book per page type. Each has OK / CHANGE + a note (db collection `notes`).
// Run: node docs/proposals/skill-icons/make.mjs <out.html>
import fs from 'node:fs';
const R = (f) => JSON.parse(fs.readFileSync(new URL('../../../src/data/' + f, import.meta.url), 'utf8'));
const heroes = R('heroes.json'), skills = R('skills.json'), icons = R('skillIcons.json'), items = R('itemIcons.json'), books = R('skillBooks.json');
const list = (Array.isArray(heroes) ? heroes : Object.values(heroes)).filter((h) => h.id);
const HEROES = list.map((h) => ({
  id: h.id, name: h.name, role: h.role || '',
  icons: [
    ...Object.entries(h.skills).map(([kind, id]) => ({ key: id, kind, name: skills[id].name, text: skills[id].description || '' })),
    { key: `passive_${h.id}`, kind: 'passive', name: h.passive.name, text: h.passive.description || '' },
  ],
}));
// Book colours per page type: [mid, light, dark] replace the blue book's palette entries 1, 2 and 5.
const BOOKS = [
  ['stat', 'Stat pages', ['0x3f63c8', '0x7f9fe8', '0x24306a']],
  ['Debuff', 'Debuff', ['0x7a3fb8', '0xb88ae8', '0x3a1c5a']],
  ['Heal', 'Heal', ['0x2f9a55', '0x7ee09a', '0x17482a']],
  ['Defense', 'Defense', ['0x6a6e80', '0xc8cbd8', '0x34363f']],
  ['Team', 'Team', ['0x1f9a9a', '0x7fe0e0', '0x0e4848']],
  ['Tempo', 'Tempo', ['0xc8b020', '0xf8e878', '0x605010']],
  ['Risk', 'Risk', ['0xb8302a', '0xf07a6a', '0x5a1414']],
  ['Area', 'Area', ['0xd06a20', '0xffb070', '0x6a3210']],
  ['Self', 'Self', ['0xc0408a', '0xf090c8', '0x5a1a40']],
].map(([tag, label, cols]) => ({
  tag, label, cols,
  pages: Object.values(books.pages).filter((p) => (tag === 'stat' ? p.kind === 'stat' : p.tag === tag)).map((p) => p.name),
}));
const data = { HEROES, ICONS: icons, BOOK: items.skill_book, BOOKS };
const tpl = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
fs.writeFileSync(process.argv[2], tpl.replace('/*DATA*/', `const DATA = ${JSON.stringify(data)};`));
console.log('wrote', process.argv[2]);
