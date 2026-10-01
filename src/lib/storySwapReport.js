import { getGummyGumSession } from './gummygumSession';

export const buildStorySwapReport = (session, participants) => {
  const host = getGummyGumSession()?.player?.name || 'Host';
  const joined = participants.filter((p) => p.status === 'joined');
  return {
    experience: 'story-swap',
    rounds: session?.prompts?.length || session?.roundCount || null,
    participantCount: joined.length,
    leaderboard: [
      { name: host, score: 0, isHost: true },
      ...joined.map((p) => ({ name: p.name || p.email || 'Player', score: 0 })),
    ],
  };
};
