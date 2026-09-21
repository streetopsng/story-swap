/**
 * Computes small group sizes of 2 or 3 people
 * For example:
 * 2 -> [2]
 * 3 -> [3]
 * 4 -> [2, 2]
 * 5 -> [2, 3]
 * 6 -> [2, 2, 2]
 * 7 -> [2, 2, 3]
 */
export function computeGroupSizes(n) {
  if (n <= 3) return n > 0 ? [n] : [];
  const numGroups = Math.floor(n / 2);
  const sizes = new Array(numGroups).fill(2);
  if (n - numGroups * 2 === 1) {
    sizes[sizes.length - 1] = 3;
  }
  return sizes;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupSetKey(group) {
  return group
    .map(p => p.id || p.email || p.name)
    .sort()
    .join(',');
}

function groupsRepeatPrevious(groups, prevGroups) {
  if (!prevGroups || !prevGroups.length) return false;
  const prevKeys = prevGroups.map(groupSetKey);
  return groups.some(g => prevKeys.includes(groupSetKey(g)));
}

/**
 * Builds groups of 2-3 participants, minimizing repeated groupings
 */
export function buildGroups(participants, prevGroups = null) {
  if (!participants || participants.length === 0) return [];
  if (participants.length === 1) return [[participants[0]]];

  let groups = [];
  let attempts = 0;

  do {
    const shuffled = shuffle(participants);
    const sizes = computeGroupSizes(shuffled.length);
    groups = [];
    let idx = 0;
    sizes.forEach(sz => {
      groups.push(shuffled.slice(idx, idx + sz));
      idx += sz;
    });
    attempts++;
  } while (attempts < 10 && groupsRepeatPrevious(groups, prevGroups));

  return groups;
}
