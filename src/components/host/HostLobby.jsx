import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Button from '../common/Button';
import Toast from '../common/Toast';
import {
  subscribeSession,
  subscribeParticipants,
  startSession,
} from '../../firebase/sessionService';

export default function HostLobby() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Subscribe to real-time session updates
  useEffect(() => {
    if (!sessionId) return;
    const unsubSession = subscribeSession(sessionId, (data) => {
      if (!data) {
        showToast('Session not found');
        return;
      }
      setSession(data);
      if (data.status === 'in-progress') {
        navigate(`/host/${sessionId}/control`);
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

  const joinedParticipants = participants.filter((p) => p.status === 'joined');
  const joinedCount = joinedParticipants.length;
  const totalCount = participants.length;
  const progressPercent = totalCount > 0 ? Math.round((joinedCount / totalCount) * 100) : (joinedCount > 0 ? 100 : 0);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${sessionId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl);
      showToast('Invite link copied to clipboard!');
    } else {
      showToast(`Link: ${inviteUrl}`);
    }
  };

  const handleStartGame = async () => {
    if (joinedCount < 1) {
      showToast('Wait for at least one player to join before starting');
      return;
    }

    setIsStarting(true);
    try {
      await startSession(sessionId, participants);
      navigate(`/host/${sessionId}/control`);
    } catch (err) {
      console.error('Error starting game:', err);
      showToast('Failed to start game');
      setIsStarting(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-x-hidden">
      <Navbar contextText={session?.name || 'Story Swap'} maxWidthClass="max-w-[430px] md:max-w-5xl" />

      <Toast message={toastMsg} />

      {/* Main Container: Mobile = max-w-[430px]; Desktop = max-w-5xl */}
      <div className="flex-1 w-full max-w-[430px] md:max-w-5xl mx-auto px-4 md:px-6 py-2 md:py-6 flex flex-col justify-between">
        
        <div className="md:grid md:grid-cols-12 md:gap-6 space-y-4 md:space-y-0 flex-1">
          
          {/* Left Column (Stats, Link & Controls) */}
          <div className="md:col-span-5 space-y-4">
            
            {/* Progress Card */}
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4] text-center">
              <div className="text-[36px] md:text-[48px] font-black text-[#F5821F] leading-none">
                {joinedCount}
                {totalCount > 0 && <span className="text-[#999999] text-2xl md:text-3xl font-bold">/{totalCount}</span>}
              </div>
              <div className="text-[11px] md:text-[12px] text-[#999999] font-bold tracking-wider uppercase mt-1">
                Players in the lobby
              </div>

              {totalCount > 0 && (
                <div className="h-2.5 bg-[#E0DBD4] rounded-full overflow-hidden mt-4">
                  <div
                    className="h-full bg-[#F5821F] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Share Invite Code Box */}
              <div className="mt-4 pt-4 border-t border-[#E0DBD4] bg-[#FAF7F2] rounded-xl p-3 text-left">
                <div className="text-[10px] font-black uppercase text-[#999999] tracking-wider mb-1">
                  Session Invite Link
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[#1A1A1A] truncate">
                    {window.location.origin}/join/{sessionId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-2.5 py-1 bg-white border border-[#E0DBD4] rounded-lg text-xs font-bold text-[#F5821F] hover:text-[#E8710A] shrink-0 cursor-pointer shadow-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </section>

            {/* Desktop Start Card */}
            <section className="hidden md:block bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4] space-y-3">
              <Button
                variant="orange"
                onClick={handleStartGame}
                disabled={isStarting || joinedCount === 0}
                className="py-4 text-base"
              >
                {isStarting ? 'Starting...' : 'Start game ›'}
              </Button>
              <p className="text-[12px] text-[#999999] text-center leading-relaxed">
                {joinedCount === 0
                  ? 'Waiting for players to join — copy the link above and send it to your team.'
                  : `${joinedCount} teammate${joinedCount === 1 ? '' : 's'} ready! Launch when everyone is assembled.`}
              </p>
            </section>

          </div>

          {/* Right Column (Live Roster Grid) */}
          <div className="md:col-span-7 flex flex-col">
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-[0_2px_0_#E0DBD4] flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555]">
                  Live Teammate Roster ({participants.length})
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#22A855] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#22A855] animate-blink" />
                  Live sync
                </div>
              </div>

              {/* Roster Container */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 max-h-[420px] md:max-h-[500px]">
                {participants.length === 0 ? (
                  <div className="py-12 text-center text-[#999999] space-y-2">
                    <span className="text-3xl block">⏳</span>
                    <p className="text-sm font-semibold text-[#1A1A1A]">No players have entered yet</p>
                    <p className="text-xs max-w-xs mx-auto">
                      Share the invite link or session code <strong className="text-[#F5821F]">{sessionId}</strong> with your teammates so they can join.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {participants.map((p) => {
                      const isJoined = p.status === 'joined';
                      return (
                        <div
                          key={p.id || p.email}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isJoined
                              ? 'bg-[#FAF7F2] border-[#F5821F]/40 shadow-xs'
                              : 'bg-neutral-50/70 border-[#E0DBD4] opacity-50'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full border-[1.5px] border-[#F5821F] flex items-center justify-center text-lg shrink-0 ${
                              isJoined ? 'bg-[#FDE8D0]' : 'bg-[#EDEAE4]'
                            }`}
                          >
                            {p.av || '🙂'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-[#1A1A1A] truncate">
                              {p.name || p.email}
                            </div>
                            <div className="text-[11px] text-[#999999] truncate">
                              {isJoined ? 'Ready in lobby' : 'Invite pending'}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isJoined ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#22A855]/10 text-[#22A855] text-[11px] font-extrabold">
                                Ready ✓
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#999999] font-medium">
                                Waiting...
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>

        {/* Mobile Sticky Footer */}
        <footer className="mt-4 pt-2 bg-[#EDEAE4] md:hidden shrink-0 space-y-2">
          <Button
            variant="orange"
            onClick={handleStartGame}
            disabled={isStarting || joinedCount === 0}
          >
            {isStarting ? 'Starting...' : 'Start game ›'}
          </Button>
          <p className="text-[12px] text-[#999999] text-center leading-relaxed">
            {joinedCount === 0
              ? 'Waiting for players to join — copy the invite link above.'
              : `${joinedCount} joined · Ready to start whenever you want.`}
          </p>
        </footer>

      </div>
    </main>
  );
}
