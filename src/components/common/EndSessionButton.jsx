import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { CloseIcon } from './Icons';
import { endSession, getSession, getParticipants } from '../../firebase/sessionService';
import {
  getGummyGumSession,
  endGummyGumSession,
  hostExitInProgressRef,
} from '../../lib/gummygumSession';

const buildReport = (session, participants) => {
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

const TRIGGER_STYLES = {
  nav: 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E0DBD4] text-xs font-bold text-[#555] hover:text-red-600 hover:border-red-300 hover:bg-red-50/50 transition-colors shadow-xs cursor-pointer',
  block: 'w-full py-2.5 rounded-full border border-[#E0DBD4] hover:border-red-300 text-xs font-bold text-[#777] hover:text-red-600 bg-white hover:bg-red-50/50 transition-all cursor-pointer shadow-xs',
};

export default function EndSessionButton({ sessionId, variant = 'nav' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  if (!getGummyGumSession()?.isHost) return null;

  const handleConfirm = async () => {
    setIsEnding(true);
    hostExitInProgressRef.current = true;
    const current = sessionId ? await getSession(sessionId) : null;
    const completed = current?.status === 'completed';
    if (sessionId) {
      try {
        await endSession(sessionId, { completed });
      } catch (err) {
        console.error('Failed to mark session ended:', err);
      }
    }
    const report = completed ? buildReport(current, await getParticipants(sessionId)) : null;
    await endGummyGumSession({ completed, report });
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={TRIGGER_STYLES[variant] || TRIGGER_STYLES.nav}>
        {variant === 'nav' && <CloseIcon className="w-3.5 h-3.5" />}
        <span>End session</span>
      </button>
      <Modal isOpen={isOpen} onClose={() => !isEnding && setIsOpen(false)} title="End this session?">
        <p className="text-[13px] text-[#555] text-center leading-relaxed mb-5">
          Everyone will be removed and the session will close in GummyGum.
        </p>
        <div className="space-y-2">
          <Button variant="dark" onClick={handleConfirm} disabled={isEnding}>
            {isEnding ? 'Ending session...' : 'End session'}
          </Button>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isEnding}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
