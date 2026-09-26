import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import Button from '../common/Button';
import Input from '../common/Input';
import Toast from '../common/Toast';
import AvatarPickerModal from '../common/AvatarPickerModal';
import {
  subscribeSession,
  subscribeParticipants,
  joinSession,
} from '../../firebase/sessionService';
import { returnToGummyGum, getGummyGumSession } from '../../lib/gummygumSession';

export default function PlayerJoinFlow() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const ggSession = getGummyGumSession();
  const queryEmail = (searchParams.get('email') || ggSession?.player?.email || '').toLowerCase().trim();
  const queryName = searchParams.get('name') || ggSession?.player?.name || '';

  // Persistent player identity in localStorage
  const savedIdentity = useMemo(() => {
    try {
      const data = localStorage.getItem(`story_swap_player_${sessionId}`);
      if (data) return JSON.parse(data);
      if (queryEmail) {
        const savedAv = localStorage.getItem(`story_swap_avatar_${queryEmail}`);
        const savedN = localStorage.getItem(`story_swap_name_${queryEmail}`) || queryName;
        const joined = localStorage.getItem(`story_swap_joined_${sessionId}_${queryEmail}`) === 'true';
        if (joined && savedAv) {
          return { email: queryEmail, name: savedN, avatar: savedAv };
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [sessionId, queryEmail, queryName]);

  // Player step state: directly go to 'lobby' if already joined, or 'identity' (pre-filled) to pick avatar
  const [step, setStep] = useState(savedIdentity ? 'lobby' : 'identity');

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [toastMsg, setToastMsg] = useState('');

  // Form states
  const [email, setEmail] = useState(savedIdentity?.email || queryEmail || '');
  const [name, setName] = useState(savedIdentity?.name || queryName || '');
  const [avatar, setAvatar] = useState(() => {
    if (savedIdentity?.avatar) return savedIdentity.avatar;
    if (queryEmail) {
      const savedAv = localStorage.getItem(`story_swap_avatar_${queryEmail}`);
      if (savedAv) return savedAv;
    }
    return '🙂';
  });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Turn state for current round
  const [turnIndex, setTurnIndex] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(60);
  const timerRef = useRef(null);

  // Auto-register saved identity into session if returning
  useEffect(() => {
    if (savedIdentity && sessionId) {
      joinSession(sessionId, savedIdentity).catch(() => {});
    }
  }, [savedIdentity, sessionId]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Subscribe to session
  useEffect(() => {
    if (!sessionId) return;

    const unsubSession = subscribeSession(sessionId, (data) => {
      if (!data) {
        showToast('Session not found');
        return;
      }
      setSession(data);

      if (data.status === 'completed') {
        setStep('finish');
        confetti({ particleCount: 70, spread: 60 });
      } else if (data.status === 'in-progress') {
        setStep((prev) => {
          if (prev === 'lobby' || prev === 'round') {
            return 'round';
          }
          return prev;
        });
      }
    });

    const unsubParts = subscribeParticipants(sessionId, (list) => {
      setParticipants(list);
    });

    return () => {
      unsubSession?.();
      unsubParts?.();
    };
  }, [sessionId]);

  // Track current round to reset turns when round advances
  const currentRoundIndex = session?.currentRound ?? 0;
  const prevRoundRef = useRef(currentRoundIndex);
  if (currentRoundIndex !== prevRoundRef.current) {
    prevRoundRef.current = currentRoundIndex;
    setTurnIndex(0);
    setTurnTimeLeft(60);
  }

  // Turn countdown timer
  useEffect(() => {
    if (step !== 'round') {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          setTurnIndex((t) => t + 1);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [step, turnIndex]);

  // Save identity and join session in Firestore
  const handleSaveIdentity = async () => {
    if (!name.trim()) {
      showToast('Please enter your name');
      return;
    }

    setStep('saving');

    const normEmail = email.trim().toLowerCase();
    const identity = {
      email: normEmail,
      name: name.trim(),
      avatar,
    };

    try {
      await joinSession(sessionId, identity);
      localStorage.setItem(`story_swap_player_${sessionId}`, JSON.stringify(identity));
      if (normEmail) {
        localStorage.setItem(`story_swap_avatar_${normEmail}`, avatar);
        localStorage.setItem(`story_swap_name_${normEmail}`, name.trim());
        localStorage.setItem(`story_swap_joined_${sessionId}_${normEmail}`, 'true');
      }
      setTimeout(() => {
        if (session?.status === 'in-progress') {
          setStep('round');
        } else {
          setStep('lobby');
        }
      }, 1200);
    } catch (err) {
      console.error('Error joining session:', err);
      showToast('Failed to join. Please try again.');
      setStep('identity');
    }
  };

  // Find player's assigned group for this round
  const allGroups = session?.groups || [];
  const myEmail = email.trim().toLowerCase();
  const myName = name.trim().toLowerCase();
  const foundGroup = allGroups.find((grp) =>
    grp.some(
      (m) =>
        (m.email && m.email.toLowerCase() === myEmail) ||
        (m.name && m.name.toLowerCase() === myName)
    )
  );
  const myGroup = foundGroup || allGroups[0] || [];

  const currentSpeaker = myGroup[turnIndex % (myGroup.length || 1)];
  const isMyTurn =
    currentSpeaker &&
    ((currentSpeaker.email && currentSpeaker.email.toLowerCase() === email.toLowerCase()) ||
      (currentSpeaker.name && currentSpeaker.name.toLowerCase() === name.toLowerCase()));

  const handleFinishMyTurn = () => {
    setTurnIndex((t) => t + 1);
    setTurnTimeLeft(60);
  };

  const totalRounds = session?.prompts?.length || session?.roundCount || 3;
  const currentPrompt = session?.prompts?.[currentRoundIndex] || {
    cat: 'Story Swap',
    text: 'What helps you do your best work?',
  };

  return (
    <main className="w-full flex-1 flex flex-col justify-center items-center p-0 md:p-8 bg-[#EDEAE4]">
      <Toast message={toastMsg} />

      {/* Responsive Shell: Mobile = max-w-[430px] min-h-screen; Desktop = max-w-xl lg:max-w-2xl rounded-[32px] */}
      <div className="w-full max-w-[430px] md:max-w-xl lg:max-w-2xl min-h-screen md:min-h-[580px] bg-[#EDEAE4] md:bg-white md:rounded-[32px] md:border md:border-[#E0DBD4] md:shadow-2xl flex flex-col overflow-hidden relative">

        {/* ── STEP 1: PLAYER HOME ── */}
        {step === 'home' && (
          <div className="flex-1 flex flex-col justify-between p-6 md:p-12">
            <div className="flex-1 flex items-center justify-center">
              <section className="w-full bg-white md:bg-transparent border-[1.5px] border-[#E0DBD4] md:border-none rounded-[24px] p-6 md:p-0 text-center shadow-[0_4px_0_#E0DBD4] md:shadow-none">
                <div className="text-5xl md:text-6xl mb-3 md:mb-4">🗣️</div>
                <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#F5821F]">
                  You're invited
                </div>
                <h1 className="text-[22px] md:text-[32px] font-black text-[#1A1A1A] mt-2 leading-tight">
                  You've been invited to play<br />
                  <span className="text-[#F5821F]">Story Swap</span>
                </h1>
                <p className="text-[13px] md:text-[15px] text-[#555555] mt-3 md:mt-4 leading-relaxed max-w-md mx-auto">
                  Session: <strong className="text-[#1A1A1A]">{session?.name || 'Team Bonding'}</strong><br />
                  Small-group conversations guided by a prompt each round. Just share and listen.
                </p>
              </section>
            </div>

            <footer className="space-y-2 pt-6 max-w-sm mx-auto w-full">
              <Button variant="orange" onClick={() => setStep('email')} className="py-4 text-base">
                Join the game ›
              </Button>
              <p className="text-[12px] text-[#999999] text-center">
                Takes about 20 seconds to set up
              </p>
            </footer>
          </div>
        )}

        {/* ── STEP 2: PLAYER EMAIL ── */}
        {step === 'email' && (
          <div className="flex-1 flex flex-col justify-between p-6 md:p-12">
            <div className="flex-1 flex flex-col justify-center px-2 max-w-md mx-auto w-full">
              <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#F5821F] text-center">
                Confirm it's you
              </div>
              <h1 className="text-[22px] md:text-[30px] font-black text-[#1A1A1A] text-center mt-1.5">
                What's your work email?
              </h1>
              <p className="text-[13px] md:text-[15px] text-[#555555] text-center mt-2 mb-6 leading-relaxed">
                We'll match you to the session invite for <strong className="text-[#1A1A1A]">{session?.name || 'Team Bonding'}</strong>.
              </p>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-center font-medium text-base py-3.5"
                autoFocus
              />
            </div>

            <footer className="pt-6 max-w-sm mx-auto w-full">
              <Button
                variant="orange"
                disabled={!email.trim() || !email.includes('@')}
                onClick={() => setStep('identity')}
                className="py-4 text-base"
              >
                Continue ›
              </Button>
            </footer>
          </div>
        )}

        {/* ── STEP 3: PLAYER IDENTITY (Name & Avatar) ── */}
        {step === 'identity' && (
          <div className="flex-1 flex flex-col justify-between p-4 md:p-10">
            <header className="pt-2 pb-1 flex items-center justify-between">
              <span className="text-[13px] md:text-[15px] font-black text-[#F5821F]">GummyGum</span>
              <span className="text-[11px] md:text-[12px] font-bold text-[#999999] uppercase tracking-wider truncate max-w-[200px]">
                {session?.name || 'Story Swap'}
              </span>
            </header>

            <div className="flex-1 space-y-4 pt-4 max-w-md mx-auto w-full">
              {/* Avatar Preview Card */}
              <div className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[24px] p-6 text-center shadow-[0_4px_0_#E0DBD4] md:shadow-none flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#EDEAE4] border-3 border-[#1A1A1A] flex items-center justify-center text-5xl md:text-6xl cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                >
                  {avatar}
                </button>
                <div className="text-[18px] md:text-[20px] font-extrabold text-[#1A1A1A] mt-3">
                  {name || '—'}
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="mt-3 flex items-center gap-2 bg-[#EDEAE4] hover:bg-[#E0DBD4] rounded-full py-2 px-5 text-[13px] font-bold text-[#1A1A1A] cursor-pointer"
                >
                  🎨 Choose avatar
                </button>
              </div>

              {/* Name Input Card — only if not already provided by GummyGum */}
              {!queryName && (
                <div className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[24px] p-5 shadow-[0_2px_0_#E0DBD4] md:shadow-none">
                  <label htmlFor="player-name-input-flow" className="block text-[11px] md:text-[12px] font-extrabold tracking-wider uppercase text-[#555555] mb-2">
                    Your name
                  </label>
                  <Input
                    id="player-name-input-flow"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={24}
                    className="text-base py-3"
                  />
                </div>
              )}
            </div>

            <footer className="space-y-2 pt-6 max-w-sm mx-auto w-full">
              <Button
                variant="orange"
                disabled={name.trim().length < 2}
                onClick={handleSaveIdentity}
                className="py-4 text-base"
              >
                Enter the lobby →
              </Button>
              <p className="text-[11px] text-[#999999] text-center">
                Enter your name to continue
              </p>
            </footer>

            <AvatarPickerModal
              isOpen={isAvatarModalOpen}
              onClose={() => setIsAvatarModalOpen(false)}
              selectedAvatar={avatar}
              onSelect={(newAv) => setAvatar(newAv)}
            />
          </div>
        )}

        {/* ── STEP 4: SAVING ANIMATION ── */}
        {step === 'saving' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#F5821F] flex items-center justify-center text-5xl md:text-6xl animate-pulse-soft">
              {avatar}
            </div>
            <div className="text-[18px] md:text-[22px] font-extrabold text-[#1A1A1A]">
              Saving your identity...
            </div>
            <div className="text-3xl animate-spin">🪐</div>
          </div>
        )}

        {/* ── STEP 5: PLAYER LOBBY ── */}
        {step === 'lobby' && (
          <div className="flex-1 flex flex-col justify-between p-4 md:p-8">
            <header className="pb-2 shrink-0">
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => returnToGummyGum()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E0DBD4] text-xs font-bold text-[#555] hover:text-[#1A1A1A] hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                  title="Back to GummyGum"
                >
                  <span>← Back to GummyGum</span>
                </button>
                <span className="text-[11px] font-extrabold text-[#999999] uppercase tracking-wider">
                  Story Swap
                </span>
              </div>
              <div className="text-center">
                <div className="text-[10px] md:text-[12px] font-bold tracking-widest uppercase text-[#999999]">
                  Session
                </div>
                <div className="text-[18px] md:text-[24px] font-black text-[#1A1A1A] flex items-center justify-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#F5821F]" />
                  <span>{session?.name || 'Team Bonding'}</span>
                  <span className="w-2 h-2 rounded-full bg-[#F5821F]" />
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 my-2 max-w-md mx-auto w-full">
              {/* You Card */}
              <div className="flex items-center gap-3 bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[20px] p-4 shadow-[0_2px_0_#E0DBD4] md:shadow-none">
                <div className="w-12 h-12 rounded-full bg-[#FDE8D0] border-2 border-[#F5821F] flex items-center justify-center text-2xl shrink-0">
                  {avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-extrabold text-[#1A1A1A] truncate">
                    {name} (You)
                  </div>
                  <div className="text-[12px] text-[#999999]">Ready to play</div>
                </div>
                <div className="bg-[#FDE8D0] border-[1.5px] border-[#F5821F] rounded-full py-1 px-3 text-[11px] font-extrabold text-[#E8710A]">
                  ✓ Ready
                </div>
              </div>

              {/* Other Teammates */}
              <div className="text-[11px] md:text-[12px] font-extrabold tracking-wider uppercase text-[#555555] pt-2 px-1">
                Also ready ({participants.filter((p) => p.status === 'joined').length})
              </div>

              <div className="space-y-2 max-h-52 md:max-h-64 overflow-y-auto no-scrollbar">
                {participants
                  .filter((p) => (p.email || p.name) !== (email || name))
                  .map((p) => (
                    <div
                      key={p.id || p.email}
                      className="flex items-center gap-2.5 py-2.5 px-3 bg-white md:bg-[#FAF7F2] rounded-xl border border-[#E0DBD4]"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#FDE8D0] border-[1.5px] border-[#F5821F] flex items-center justify-center text-sm shrink-0">
                        {p.av || '🙂'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#1A1A1A] truncate">
                          {p.name || p.email}
                        </div>
                      </div>
                      <div className="text-sm">🟢</div>
                    </div>
                  ))}
              </div>
            </div>

            <footer className="pt-4 shrink-0 max-w-sm mx-auto w-full">
              <div className="flex items-center gap-2 justify-center py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F5821F] animate-blink" />
                <span className="text-[13px] md:text-[14px] text-[#555555] font-semibold">
                  Waiting for the host to start...
                </span>
              </div>
            </footer>
          </div>
        )}

        {/* ── STEP 6: PLAYER ROUND ── */}
        {step === 'round' && (
          <div className="flex-1 flex flex-col justify-between p-4 md:p-8">
            <header className="text-center pt-2 pb-1 shrink-0">
              <div className="text-[10px] md:text-[12px] font-bold tracking-widest uppercase text-[#999999]">
                Round {currentRoundIndex + 1} of {totalRounds}
              </div>
              <div className="text-[18px] md:text-[22px] font-black text-[#1A1A1A] flex items-center justify-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#F5821F]" />
                <span>{session?.name || 'Team Bonding'}</span>
                <span className="w-2 h-2 rounded-full bg-[#F5821F]" />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-4 max-w-md mx-auto w-full">
              {/* Prompt & Group Section */}
              <section className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[24px] p-5 md:p-6 shadow-[0_2px_0_#E0DBD4] md:shadow-none">
                <div className="text-center text-[11px] md:text-[12px] font-extrabold tracking-wider uppercase text-[#F5821F] mb-1">
                  {currentPrompt.cat}
                </div>
                <h2 className="text-center text-[19px] md:text-[22px] font-black text-[#1A1A1A] leading-snug mb-4">
                  {currentPrompt.text}
                </h2>

                <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#555555] mb-2 text-center">
                  Your group this round
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {myGroup.map((m) => {
                    const isThisMe =
                      (m.email && m.email.toLowerCase() === email.toLowerCase()) ||
                      (m.name && m.name.toLowerCase() === name.toLowerCase());
                    return (
                      <div
                        key={m.id || m.email || m.name}
                        className="flex items-center gap-1.5 bg-[#FDE8D0] border border-[#F5821F] rounded-full py-1.5 pl-1.5 pr-3.5 text-[12px] font-bold text-[#1A1A1A]"
                      >
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs shrink-0">
                          {m.av || '🙂'}
                        </div>
                        <span>{isThisMe ? `${m.name || 'You'} (You)` : m.name}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Turn Card */}
              {turnIndex >= myGroup.length && myGroup.length > 0 ? (
                <section className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[24px] p-6 text-center shadow-[0_3px_0_#E0DBD4] md:shadow-none">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-[18px] font-black text-[#1A1A1A]">Round complete!</div>
                  <div className="text-[13px] text-[#555555] mt-1">
                    Waiting for the host to start the next round...
                  </div>
                </section>
              ) : isMyTurn ? (
                <section className="bg-[#FDE8D0] border-2 border-[#F5821F] rounded-[24px] p-6 md:p-8 text-center shadow-[0_3px_0_#F5821F]">
                  <div className="text-4xl md:text-5xl mb-2">🎤</div>
                  <div className="text-[20px] md:text-[22px] font-black text-[#1A1A1A]">Your turn!</div>
                  <div className="text-[13px] md:text-[14px] text-[#555555] mt-1">
                    Share your answer with the group
                  </div>
                  <div className="text-[32px] md:text-[40px] font-black text-[#E8710A] mt-3">
                    0:{String(turnTimeLeft).padStart(2, '0')}
                  </div>
                  <Button
                    variant="dark"
                    onClick={handleFinishMyTurn}
                    className="mt-5 py-3.5"
                  >
                    I'm done sharing ›
                  </Button>
                </section>
              ) : (
                <section className="bg-white md:bg-[#FAF7F2] border-[1.5px] border-[#E0DBD4] rounded-[24px] p-6 md:p-8 text-center shadow-[0_3px_0_#E0DBD4] md:shadow-none">
                  <div className="text-4xl md:text-5xl mb-2">👂</div>
                  <div className="text-[19px] md:text-[21px] font-black text-[#1A1A1A]">
                    It's {currentSpeaker?.name || 'teammate'}'s turn
                  </div>
                  <div className="text-[13px] md:text-[14px] text-[#555555] mt-1">
                    Listen while they share
                  </div>
                  <div className="text-[32px] md:text-[40px] font-black text-[#E8710A] mt-3">
                    0:{String(turnTimeLeft).padStart(2, '0')}
                  </div>
                  <button
                    type="button"
                    onClick={handleFinishMyTurn}
                    className="text-xs text-[#999999] hover:text-[#555555] underline cursor-pointer mt-4"
                  >
                    Next speaker ›
                  </button>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 7: PLAYER FINISH ── */}
        {step === 'finish' && (
          <div className="flex-1 flex flex-col justify-between p-6 md:p-12">
            <div className="flex-1 flex items-center justify-center">
              <section className="w-full bg-white md:bg-transparent border-[1.5px] border-[#E0DBD4] md:border-none rounded-[24px] p-8 md:p-0 text-center shadow-[0_4px_0_#E0DBD4] md:shadow-none">
                <div className="text-5xl md:text-6xl mb-3 md:mb-4">🎉</div>
                <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#F5821F]">
                  Session complete
                </div>
                <h1 className="text-[24px] md:text-[32px] font-black text-[#1A1A1A] mt-1 leading-tight">
                  That's a wrap!
                </h1>
                <p className="text-[13px] md:text-[15px] text-[#555555] mt-3 leading-relaxed max-w-md mx-auto">
                  Thanks for sharing with your team — hope you learned something new about each other.
                </p>
              </section>
            </div>

            <footer className="pt-6 max-w-sm mx-auto w-full">
              <Button variant="orange" onClick={() => returnToGummyGum()} className="py-4 text-base">
                Done — Return to GummyGum →
              </Button>
            </footer>
          </div>
        )}

      </div>
    </main>
  );
}
