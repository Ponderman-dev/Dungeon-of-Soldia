// The 3 squad slots on the squad screen (src/systems/squadSlots.js).
import { emptySlots, slotsFrom, addToSlots, removeFromSlots, isFull, squadOrder } from '../../src/systems/squadSlots.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const s = emptySlots();
ok('starts with 3 empty slots', s.length === 3 && s.every((x) => x === null));
ok('a chosen hero goes to the first empty slot', addToSlots(s, 'knight') === 0 && addToSlots(s, 'rogue') === 1);
ok('the same hero cannot be added twice', addToSlots(s, 'knight') === -1);
removeFromSlots(s, 'knight');
ok('sending a hero back leaves its slot empty, the others stay', s[0] === null && s[1] === 'rogue');
ok('the next hero fills the gap', addToSlots(s, 'mage') === 0 && addToSlots(s, 'bard') === 2);
ok('full after 3', isFull(s) && addToSlots(s, 'cleric') === -1);
ok('squad order = slot order (left, middle, right)', squadOrder(s).join() === 'mage,rogue,bard');
const last = slotsFrom(['knight', 'cleric', 'archer'], ['knight', 'archer', 'rogue']);
ok('the last squad comes back without locked heroes', last.join() === 'knight,archer,');
