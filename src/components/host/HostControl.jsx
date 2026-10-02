import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Button from '../common/Button';
import Toast from '../common/Toast';
import {
  subscribeSession,
  subscribeParticipants,
  advanceRound,
  completeGroupTurn,
  getGroupTurn,
} from '../../firebase/sessionService';
import { ClockIcon, ChevronRightIcon, CheckCircleIcon } from '../common/Icons';
import Avatar from '../common/Avatar';

const formatClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function HostControl() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const prevGroupsRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Subscribe to real-time session
  useEffect(() => {
    if (!sessionId) return;
    const unsubSession = subscribeSession(sessionId, (data) => {
      if (!data) return;
      setSession(data);
      if (data.groups) {
        prevGroupsRef.current = data.groups;
      }
      if (data.status === 'completed') {
        navigate(`/host/${sessionId}/finish`);
      }
    });

    const unsubParts = subscribeParticipants(sessionId, (list) => {
      setParticipants(list);
    });

    return () => {
      unsubSession?.();
      unsubParts?.();
    };
  }, [sessionId, navigate]);

  // Round elapsed timer
  useEffect(() => {
    if (!session?.roundStartedAt) return;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      setElapsedSec(Math.max(0, Math.floor((current - session.roundStartedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.roundStartedAt]);

  const currentRoundIndex = session?.currentRound ?? 0;
  const totalRounds = session?.prompts?.length || session?.roundCount || 3;
  const currentPrompt = session?.prompts?.[currentRoundIndex] || {
    cat: 'Story Swap',
    text: 'Share a story about your team.',
  };
  const isLastRound = currentRoundIndex >= totalRounds - 1;

  const storyOf = (m) => participants.find(
    (p) => (m.id && p.id === m.id) || (m.email && (p.email || '').toLowerCase() === m.email.toLowerCase())
  )?.stories?.[currentRoundIndex]?.text || '';
  const groupTurns = (session?.groups || []).map((group, groupIdx) => {
    const { index, timeLeft } = getGroupTurn(session, groupIdx, now);
    const writer = group[index];
    return { index, timeLeft, writerShared: Boolean(writer && storyOf(writer)) };
  });
  const turnKey = groupTurns.map((t) => `${t.index}:${t.writerShared ? 1 : 0}`).join(',');

  // Backs up the players' devices in moving a group on once its writer has shared.
  useEffect(() => {
    if (session?.status !== 'in-progress') return;
    turnKey.split(',').forEach((entry, groupIdx) => {
      const [index, shared] = entry.split(':');
      if (shared === '1') completeGroupTurn(sessionId, groupIdx, currentRoundIndex, Number(index));
    });
  }, [turnKey, session?.status, sessionId, currentRoundIndex]);

  const memberCount = (session?.groups || []).reduce((n, g) => n + g.length, 0);
  const sharedCount = (session?.groups || []).reduce((n, g) => n + g.filter((m) => storyOf(m)).length, 0);

  const handleNextRound = async () => {
    setIsAdvancing(true);
    try {
      await advanceRound(
        sessionId,
        participants,
        currentRoundIndex,
        totalRounds,
        prevGroupsRef.current
      );
      if (isLastRound) {
        navigate(`/host/${sessionId}/finish`);
      }
    } catch (err) {
      console.error('Error advancing round:', err);
      showToast('Failed to advance round');
    } finally {
      setIsAdvancing(false);
    }
  };

  const formatElapsed = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')} elapsed`;
  };

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-x-hidden">
      <Navbar contextText={session?.name || 'Team Bonding'} sessionId={sessionId} maxWidthClass="max-w-[430px] md:max-w-5xl" />

      <Toast message={toastMsg} />

      {/* Main Container: Mobile = max-w-[430px]; Desktop = max-w-5xl */}
      <div className="flex-1 w-full max-w-[430px] md:max-w-5xl mx-auto px-4 md:px-6 py-2 md:py-6 flex flex-col justify-between space-y-4">
        
        {/* Round Progress Header */}
        <div className="flex items-center justify-between px-2 shrink-0">
          <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#999999]">
            Round {currentRoundIndex + 1} of {totalRounds}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] md:text-[14px] font-extrabold text-[#E8710A] bg-[#FDE8D0] px-3 py-1 rounded-full">
            <ClockIcon className="w-3.5 h-3.5" />
            {formatElapsed(elapsedSec)}
          </div>
        </div>

        {/* Top Prompt Billboard Card */}
        <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] p-6 md:p-8 text-center shadow-sm">
          <div className="text-[11px] md:text-[13px] font-extrabold tracking-wider uppercase text-[#F5821F] mb-2">
            {currentPrompt.cat}
          </div>
          <h1 className="text-[20px] md:text-[28px] font-black text-[#1A1A1A] leading-snug max-w-3xl mx-auto">
            {currentPrompt.text}
          </h1>
        </section>

        {/* Groups Breakdown Grid */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-[11px] md:text-[13px] font-extrabold tracking-wider uppercase text-[#555555]">
              Breakout Groups This Round ({session?.groups?.length || 0})
            </div>
            <div className="text-[11px] md:text-xs font-bold text-[#555555]">
              {sharedCount}/{memberCount} stories shared
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(!session?.groups || session.groups.length === 0) ? (
              <div className="col-span-full text-center text-xs text-[#999999] py-8 bg-white rounded-2xl border border-[#E0DBD4]">
                Forming small groups...
              </div>
            ) : (
              session.groups.map((group, groupIdx) => (
                <div
                  key={groupIdx}
                  className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-4 shadow-xs flex flex-col justify-between"
                >
                  <div className="text-[11px] font-extrabold text-[#999999] uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Group {groupIdx + 1}</span>
                    {groupTurns[groupIdx].index >= group.length ? (
                      <span className="text-[10px] border px-2 py-0.5 rounded-full font-bold bg-[#E6F6EC] border-[#22A855] text-[#22A855]">
                        Done · {group.filter((m) => storyOf(m)).length}/{group.length} shared
                      </span>
                    ) : (
                      <span className="text-[10px] border px-2 py-0.5 rounded-full font-bold bg-[#FDE8D0] border-[#F5821F] text-[#E8710A]">
                        Turn {groupTurns[groupIdx].index + 1}/{group.length} · {formatClock(groupTurns[groupIdx].timeLeft)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.map((member, memberIdx) => {
                      const story = storyOf(member);
                      const turnIndex = groupTurns[groupIdx].index;
                      const isWriting = memberIdx === turnIndex && !story;
                      return (
                        <div key={member.id || member.email || member.name}>
                          <div className="flex items-center gap-2 text-[13px] font-bold text-[#1A1A1A]">
                            <div className={`w-6 h-6 rounded-full bg-white overflow-hidden shrink-0 border-[1.5px] ${story ? 'border-[#22A855]' : isWriting ? 'border-[#F5821F]' : 'border-[#E0DBD4]'}`}>
                              <Avatar id={member.av} className="w-full h-full" />
                            </div>
                            <span className="flex-1 min-w-0 truncate">{member.name || member.email}</span>
                            {story ? (
                              <CheckCircleIcon className="w-4 h-4 text-[#22A855] shrink-0" />
                            ) : isWriting ? (
                              <span className="text-[11px] font-extrabold text-[#E8710A] shrink-0">
                                Writing · {formatClock(groupTurns[groupIdx].timeLeft)}
                              </span>
                            ) : memberIdx < turnIndex ? (
                              <span className="text-[11px] font-semibold text-[#999999] shrink-0">Didn't share</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#999999] shrink-0">
                                {memberIdx === turnIndex + 1 ? 'Up next' : 'Waiting'}
                              </span>
                            )}
                          </div>
                          {story && (
                            <p className="mt-1 ml-8 text-[12px] text-[#555555] leading-snug whitespace-pre-wrap break-words line-clamp-4">
                              {story}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Host Action Bar */}
        <footer className="pt-2 bg-[#EDEAE4] shrink-0 max-w-md mx-auto w-full md:max-w-none md:flex md:items-center md:justify-between md:pt-4">
          <div className="hidden md:block text-xs text-[#999999]">
            Advance once groups have shared their stories.
          </div>
          <Button
            variant="orange"
            onClick={handleNextRound}
            disabled={isAdvancing}
            className="md:w-auto md:px-10 py-4 text-base"
          >
            {isAdvancing
              ? 'Updating round...'
              : <>{isLastRound ? 'Finish session' : 'Next round'} <ChevronRightIcon className="w-4 h-4" /></>}
          </Button>
        </footer>

      </div>
    </main>
  );
}
