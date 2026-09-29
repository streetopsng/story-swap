// Same hub-served avatar set every GummyGum experience hotlinks.
export const GUMMYGUM_AVATAR_BASE_URL = 'https://gummygum.app/avatars';
export const AVATAR_IDS = Array.from({ length: 26 }, (_, i) => `av-${i + 1}`);
export const isAvatarId = (id) => AVATAR_IDS.includes(id);
export const avatarUrl = (id) => (isAvatarId(id) ? `${GUMMYGUM_AVATAR_BASE_URL}/${id}.svg` : null);

export function randomAvatarId() {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}
