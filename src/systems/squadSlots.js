// The 3 squad slots on the squad select screen (no Phaser). A slot holds a hero id or null.
// Slot order = the order on the battlefield (left, middle, right).

export function emptySlots(count = 3) {
  return Array(count).fill(null);
}

// Slots filled from a list of ids (the last squad), skipping ids that are not allowed.
export function slotsFrom(ids, allowed, count = 3) {
  const slots = emptySlots(count);
  (ids || []).filter((id) => allowed.includes(id)).slice(0, count).forEach((id, i) => { slots[i] = id; });
  return slots;
}

// Puts a hero in the first empty slot. Returns the slot index, or -1 (already in, or full).
export function addToSlots(slots, id) {
  if (slots.includes(id)) return -1;
  const i = slots.indexOf(null);
  if (i < 0) return -1;
  slots[i] = id;
  return i;
}

// Takes a hero out of its slot (the slot stays empty, the others keep their place). Returns its index or -1.
export function removeFromSlots(slots, id) {
  const i = slots.indexOf(id);
  if (i >= 0) slots[i] = null;
  return i;
}

export const isFull = (slots) => slots.every((id) => id !== null);
export const squadOrder = (slots) => slots.filter((id) => id !== null);
