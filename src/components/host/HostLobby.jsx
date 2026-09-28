import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../common/Navbar';
import Button from '../common/Button';
import Toast from '../common/Toast';
import {
  subscribeSession,
  subscribeParticipants,
  startSession,
  endSession,
} from '../../firebase/sessionService';
import {
  sendSessionInvitation,
  sendBulkSessionInvitations,
  isBrevoConfigured,
} from '../../services/emailService';
import {
  getGummyGumSession,
  closeGummyGumSession,
  returnToGummyGum,
} from '../../lib/gummygumSession';

export default function HostLobby() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [sendingEmails, setSendingEmails] = useState({});
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [recentlySent, setRecentlySent] = useState({});
  const ggSession = getGummyGumSession();

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

  const queryParams = new URLSearchParams(window.location.search);
  const queryInvited = queryParams.get('invitedCount');
  const joinedParticipants = participants.filter((p) => p.status === 'joined');
  const joinedCount = joinedParticipants.length;
  const targetInvited =
    session?.invitedCount ||
    ggSession?.invitedCount ||
    (queryInvited ? parseInt(queryInvited, 10) : null) ||
    Math.max(participants.length, 1);
  const totalCount = targetInvited;
  const progressPercent = Math.min(100, Math.round((joinedCount / totalCount) * 100));

  const pendingParticipants = participants.filter(
    (p) => p.status !== 'joined' && (p.email || p.id?.includes('@'))
  );
  const pendingCount = pendingParticipants.length;

  const handleSendSingleInvite = async (participant) => {
    const pEmail = participant.email || (participant.id?.includes('@') ? participant.id : null);
    if (!pEmail) {
      showToast('No email address found for this teammate');
      return;
    }
    const key = pEmail.toLowerCase();
    setSendingEmails((prev) => ({ ...prev, [key]: true }));
    try {
      await sendSessionInvitation({
        recipient: { ...participant, email: pEmail },
        sessionName: session?.name || 'Team Bonding',
        sessionId,
      });
      setRecentlySent((prev) => ({ ...prev, [key]: true }));
      showToast(`Invitation sent to ${pEmail}!`);
    } catch (err) {
      console.error('Failed to send email:', err);
      showToast(`Email error: ${err.message}`);
    } finally {
      setSendingEmails((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSendBulkInvites = async () => {
    if (pendingCount === 0) {
      showToast('No pending teammates with email addresses found');
      return;
    }
    setIsBulkSending(true);
    try {
      const res = await sendBulkSessionInvitations({
        recipients: pendingParticipants,
        sessionName: session?.name || 'Team Bonding',
        sessionId,
      });
      const newSent = {};
      pendingParticipants.forEach((p) => {
        const e = (p.email || p.id)?.toLowerCase();
        if (e) newSent[e] = true;
      });
      setRecentlySent((prev) => ({ ...prev, ...newSent }));
      showToast(`Sent ${res.sent} invitation email${res.sent === 1 ? '' : 's'}!`);
    } catch (err) {
      console.error('Failed bulk emails:', err);
      showToast('Error sending email invitations');
    } finally {
      setIsBulkSending(false);
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
      <Navbar contextText={session?.name || 'Story Swap'} sessionId={sessionId} maxWidthClass="max-w-[430px] md:max-w-5xl" />

      <Toast message={toastMsg} />

      {/* Main Container: Mobile = max-w-[430px]; Desktop = max-w-5xl */}
      <div className="flex-1 w-full max-w-[430px] md:max-w-5xl mx-auto px-4 md:px-6 py-2 md:py-6 flex flex-col justify-between">
        
        <div className="md:grid md:grid-cols-12 md:gap-6 space-y-4 md:space-y-0 flex-1">
          
          {/* Left Column (Stats, Link & Controls) */}
          <div className="md:col-span-5 space-y-4">
            
            {/* Progress Card */}
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-sm text-center">
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
            </section>

            {/* Desktop Start Card */}
            <section className="hidden md:block bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-sm space-y-3">
              <Button
                variant="orange"
                onClick={handleStartGame}
                disabled={isStarting || joinedCount === 0}
                className="py-4 text-base"
              >
                {isStarting ? 'Starting...' : 'Start game ›'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('End this session and return to GummyGum?')) {
                    endSession(sessionId).finally(() => closeGummyGumSession());
                  }
                }}
                className="w-full py-2.5 rounded-full border border-[#E0DBD4] hover:border-red-300 text-xs font-bold text-[#777] hover:text-red-600 bg-white hover:bg-red-50/50 transition-all cursor-pointer shadow-xs"
              >
                Close Session & Return to GummyGum
              </button>
              <p className="text-[12px] text-[#999999] text-center leading-relaxed">
                {joinedCount === 0
                  ? 'Waiting for players to join via their GummyGum invite.'
                  : `${joinedCount} teammate${joinedCount === 1 ? '' : 's'} ready! Launch when everyone is assembled.`}
              </p>
            </section>

          </div>

          {/* Right Column (Live Roster Grid) */}
          <div className="md:col-span-7 flex flex-col">
            <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[20px] p-5 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555]">
                    Live Teammate Roster ({participants.length})
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-[#22A855] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#22A855] animate-blink" />
                    Live sync
                  </div>
                </div>

                {isBrevoConfigured && pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSendBulkInvites}
                    disabled={isBulkSending}
                    className="px-2.5 py-1 bg-[#FAF7F2] border border-[#F5821F]/40 hover:border-[#F5821F] text-[#F5821F] hover:text-[#E8710A] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Send email invitation to all pending teammates via Brevo"
                  >
                    <span>✉️</span>
                    <span>{isBulkSending ? 'Sending emails...' : `Email pending (${pendingCount})`}</span>
                  </button>
                )}
              </div>

              {/* Roster Container */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 max-h-[420px] md:max-h-[500px]">
                {participants.length === 0 ? (
                  <div className="py-12 text-center text-[#999999] space-y-2">
                    <span className="text-3xl block">⏳</span>
                    <p className="text-sm font-semibold text-[#1A1A1A]">No players have entered yet</p>
                    <p className="text-xs max-w-xs mx-auto">
                      Teammates join via their GummyGum invite.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {participants.map((p) => {
                      const isJoined = p.status === 'joined';
                      const pEmailKey = (p.email || p.id)?.toLowerCase();
                      return (
                        <div
                          key={p.id || p.email}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isJoined
                              ? 'bg-[#FAF7F2] border-[#F5821F]/40 shadow-xs'
                              : 'bg-neutral-50/70 border-[#E0DBD4] opacity-75'
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
                              {isJoined ? 'Ready in lobby' : (p.email || 'Invite pending')}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isJoined ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#22A855]/10 text-[#22A855] text-[11px] font-extrabold">
                                Ready ✓
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-[#999999] font-medium hidden sm:inline">
                                  Waiting...
                                </span>
                                {isBrevoConfigured && (p.email || p.id?.includes('@')) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendSingleInvite(p)}
                                    disabled={sendingEmails[pEmailKey]}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FAF7F2] border border-[#E0DBD4] text-[#F5821F] hover:border-[#F5821F] cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                                    title={`Send invitation email to ${p.email || p.id}`}
                                  >
                                    {sendingEmails[pEmailKey]
                                      ? '...'
                                      : recentlySent[pEmailKey]
                                      ? 'Sent ✓'
                                      : 'Invite ✉️'}
                                  </button>
                                )}
                              </div>
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
          <button
            type="button"
            onClick={() => {
              if (confirm('End this session and return to GummyGum?')) {
                endSession(sessionId).finally(() => closeGummyGumSession());
              }
            }}
            className="w-full py-2.5 rounded-full border border-[#E0DBD4] text-xs font-bold text-[#777] bg-white cursor-pointer shadow-xs"
          >
            Close Session & Return to GummyGum
          </button>
          <p className="text-[12px] text-[#999999] text-center leading-relaxed">
            {joinedCount === 0
              ? 'Waiting for players to join via their GummyGum invite.'
              : `${joinedCount} joined · Ready to start whenever you want.`}
          </p>
        </footer>

      </div>
    </main>
  );
}
