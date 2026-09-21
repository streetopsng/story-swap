import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Button from '../common/Button';
import Toast from '../common/Toast';
import {
  subscribeSession,
  subscribeParticipants,
  advanceRound,
} from '../../firebase/sessionService';

export default function HostControl() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);

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
      const now = Date.now();
      const started = session.roundStartedAt;
      setElapsedSec(Math.max(0, Math.floor((now - started) / 1000)));
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
    return `⏱ ${mins}:${String(secs).padStart(2, '0')} elapsed`;
  };

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-x-hidden">
      <Navbar contextText={session?.name || 'Team Bonding'} maxWidthClass="max-w-[430px] md:max-w-5xl" />

      <Toast message={toastMsg} />

      {/* Main Container: Mobile = max-w-[430px]; Desktop = max-w-5xl */}
      <div className="flex-1 w-full max-w-[430px] md:max-w-5xl mx-auto px-4 md:px-6 py-2 md:py-6 flex flex-col justify-between space-y-4">
        
        {/* Round Progress Header */}
        <div className="flex items-center justify-between px-2 shrink-0">
          <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#999999]">
            Round {currentRoundIndex + 1} of {totalRounds}
          </div>
          <div className="text-[12px] md:text-[14px] font-extrabold text-[#E8710A] bg-[#FDE8D0] px-3 py-1 rounded-full">
            {formatElapsed(elapsedSec)}
          </div>
        </div>

        {/* Top Prompt Billboard Card */}
        <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] p-6 md:p-8 text-center shadow-[0_3px_0_#E0DBD4]">
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
            <div className="text-xs text-[#999999] hidden md:block">
              Each group discusses the prompt in their own conversation
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
                    <span className="text-[10px] bg-[#FAF7F2] border border-[#E0DBD4] px-2 py-0.5 rounded-full font-bold">
                      {group.length} members
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.map((member) => (
                      <div
                        key={member.id || member.email || member.name}
                        className="flex items-center gap-2 bg-[#FDE8D0] border border-[#F5821F] rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-bold text-[#1A1A1A]"
                      >
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm shrink-0">
                          {member.av || '🙂'}
                        </div>
                        <span className="truncate max-w-[130px]">
                          {member.name || member.email}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Host Action Bar */}
        <footer className="pt-2 bg-[#EDEAE4] shrink-0 max-w-md mx-auto w-full md:max-w-none md:flex md:items-center md:justify-between md:pt-4">
          <div className="hidden md:block text-xs text-[#999999]">
            Advance when conversations have reached natural completion.
          </div>
          <Button
            variant="orange"
            onClick={handleNextRound}
            disabled={isAdvancing}
            className="md:w-auto md:px-10 py-4 text-base"
          >
            {isAdvancing
              ? 'Updating round...'
              : isLastRound
              ? 'Finish session ›'
              : 'Next round ›'}
          </Button>
        </footer>

      </div>
    </main>
  );
}
