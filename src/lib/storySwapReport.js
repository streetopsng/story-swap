import { getGummyGumSession } from './gummygumSession';

const storiesShared = (p) =>
  Object.values(p?.stories || {}).filter((s) => s && typeof s.text === 'string' && s.text.trim()).length;

export const buildStorySwapReport = (session, participants) => {
  const host = getGummyGumSession()?.player?.name || 'Host';
  const joined = participants.filter((p) => p.status === 'joined');
  return {
    experience: 'story-swap',
    rounds: session?.prompts?.length || session?.roundCount || null,
    participantCount: joined.length,
    // Score is the number of rounds the participant shared a story in.
    leaderboard: [
      { name: host, score: 0, isHost: true },
      ...joined.map((p) => ({ name: p.name || p.email || 'Player', score: storiesShared(p) })),
    ],
  };
};
