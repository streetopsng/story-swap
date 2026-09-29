import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HostHome from './components/host/HostHome';
import HostSetup from './components/host/HostSetup';
import HostLobby from './components/host/HostLobby';
import HostControl from './components/host/HostControl';
import HostFinish from './components/host/HostFinish';
import PlayerJoinFlow from './components/player/PlayerJoinFlow';
import { resolveGummyGumLaunch, returnToGummyGum } from './lib/gummygumSession';
import {
  getSession,
  createSession,
  subscribeSession,
  touchSessionActivity,
  markSessionAbandoned,
} from './firebase/sessionService';

import LoadingScreen from './components/common/LoadingScreen';
import SessionExpiredModal from './components/modals/SessionExpiredModal';
import { LockIcon, CheckCircleIcon } from './components/common/Icons';

const GummyGumLockedScreen = () => (
  <div className="min-h-screen w-full bg-[#EDEAE4] text-[#1A1A1A] flex items-center justify-center p-6">
    <div className="max-w-md w-full p-8 text-center space-y-4 bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] shadow-sm">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FDE8D0] border border-[#F5821F]/30 text-[#F5821F] flex items-center justify-center">
        <LockIcon className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-black text-[#1A1A1A]">Launch from GummyGum</h1>
      <p className="text-[#555] text-sm leading-relaxed">
        This experience is exclusively available through the GummyGum Hub. Open it from your GummyGum dashboard to start or join a session.
      </p>
      <a href="https://gummygum.app" className="inline-block mt-3 px-6 py-3 rounded-xl bg-[#F5821F] text-[#1A1A1A] font-extrabold hover:bg-[#E07212] transition-colors shadow-sm">
        Go to GummyGum
      </a>
    </div>
  </div>
);

const GummyGumCancelledScreen = ({ isHost = false }) => (
  <div className="min-h-screen w-full bg-[#EDEAE4] text-[#1A1A1A] flex items-center justify-center p-6">
    <div className="max-w-md w-full p-8 text-center space-y-4 bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] shadow-sm">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FDE8D0] border border-[#F5821F]/30 text-[#F5821F] flex items-center justify-center">
        <CheckCircleIcon className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-black text-[#1A1A1A]">Session Ended</h1>
      <p className="text-[#555] text-sm leading-relaxed">
        {isHost
          ? 'This session was ended. You can return to GummyGum to launch another experience.'
          : 'This session was ended by the host. You can safely close this tab now.'}
      </p>
      {isHost ? (
        <button
          onClick={() => returnToGummyGum()}
          className="inline-block mt-3 px-6 py-3 rounded-xl bg-[#F5821F] text-[#1A1A1A] font-extrabold hover:bg-[#E07212] transition-colors shadow-sm cursor-pointer"
        >
          Return to GummyGum
        </button>
      ) : (
        <button
          onClick={() => {
            try { window.close(); } catch {}
          }}
          className="inline-block mt-3 px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 border border-[#E0DBD4] text-stone-700 font-bold transition-colors cursor-pointer text-sm"
        >
          Close Tab
        </button>
      )}
    </div>
  </div>
);

// Hours, not the lobby's 20 min: a round can legitimately run long, but an
// in-progress session with no connected client this long is abandoned.
const ABANDON_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

const toMillis = (value) => (value?.toMillis ? value.toMillis() : value);

function AppCoordinator({ setGgSessionState, setGgCancelled, setGgExpired }) {
  const navigate = useNavigate();
  const location = useLocation();
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    resolveGummyGumLaunch().then(async (session) => {
      setGgSessionState(session);
      if (routedRef.current) return;
      const params = new URLSearchParams(window.location.search);
      const code = session?.roomCode || params.get('pin') || params.get('sessionId') || params.get('code') || params.get('room');
      const isHost = session?.isHost ?? (
        params.get('host') === 'true' ||
        params.get('isHost') === 'true' ||
        params.get('role') === 'host'
      );
      const queryInvited = params.get('invitedCount');
      const invitedCount = session?.invitedCount || (queryInvited ? parseInt(queryInvited, 10) : null);

      if (code) {
        routedRef.current = true;
        setGgExpired(false);

        let existing = null;
        try {
          existing = await getSession(code);
        } catch (err) {
          console.error('Session lookup failed:', err);
        }

        // Checked before this client's heartbeat starts so a returning
        // client can't mask a genuinely abandoned session.
        if (existing?.status === 'in-progress') {
          const lastActivity =
            toMillis(existing.lastActivity) ||
            toMillis(existing.updatedAt) ||
            existing.roundStartedAt ||
            toMillis(existing.createdAt);
          if (lastActivity && Date.now() - lastActivity >= ABANDON_THRESHOLD_MS) {
            await markSessionAbandoned(code);
          }
        }

        let latestStatus = null;
        setInterval(() => {
          if (latestStatus === 'in-progress') touchSessionActivity(code);
        }, HEARTBEAT_INTERVAL_MS);

        // Listen to session for cancellation and lobby expiration
        subscribeSession(code, (sessData) => {
          latestStatus = sessData?.status || null;
          if (!sessData || sessData.status === 'cancelled' || sessData.status === 'ended') {
            setGgCancelled(true);
            return;
          }
          if (sessData.status === 'expired') {
            setGgExpired(sessData.abandoned ? 'game' : 'lobby');
            return;
          }
          // Idle lobby sessions expire after 20 minutes of inactivity.
          // Firestore returns createdAt as a Timestamp instance (no numeric
          // coercion), so it must be converted to millis before comparing.
          const createdAtMs = sessData.createdAt?.toMillis
            ? sessData.createdAt.toMillis()
            : sessData.createdAt;
          if (sessData.status === 'lobby' && createdAtMs && Date.now() - createdAtMs >= 20 * 60 * 1000) {
            setGgExpired('lobby');
            return;
          }
        });

        if (isHost) {
          try {
            // Never recreate an existing session here, even if ended/expired —
            // that would silently resurrect a cancelled room instead of letting
            // the subscribeSession listener above route away from it.
            if (!existing) {
              const hostName = session?.player?.name || params.get('name') || 'Team';
              await createSession({
                sessionId: code,
                name: `${hostName}'s Story Swap`,
                roundCount: 3,
                invitedCount,
              });
            }
          } catch (err) {
            console.error('Auto session ensure failed:', err);
          }
          navigate(`/host/${code}/lobby`, { replace: true });
        } else {
          const search = window.location.search;
          navigate(`/join/${code}${search}`, { replace: true });
        }
      }
    });
  }, [navigate, location, setGgSessionState, setGgCancelled, setGgExpired]);

  return null;
}

export default function App() {
  const [ggChecked, setGgChecked] = useState(false);
  const [ggSession, setGgSession] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  // false, or the phase that expired: 'lobby' | 'game'
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const handleGgSession = (sess) => {
    setGgSession(sess);
    setGgChecked(true);
  };

  return (
    <div className="min-h-screen bg-[#EDEAE4] text-[#1A1A1A] flex flex-col items-center justify-start antialiased selection:bg-[#F5821F] selection:text-[#1A1A1A]">
      <BrowserRouter>
        <AppCoordinator setGgSessionState={handleGgSession} setGgCancelled={setIsCancelled} setGgExpired={setIsSessionExpired} />
        {!ggChecked ? (
          <LoadingScreen message="Connecting to GummyGum..." />
        ) : isCancelled ? (
          <GummyGumCancelledScreen isHost={Boolean(ggSession?.isHost)} />
        ) : !ggSession ? (
          <GummyGumLockedScreen />
        ) : (
          <Routes>
            {/* Host Routes */}
            <Route path="/" element={<HostHome />} />
            <Route path="/host/setup" element={<HostSetup />} />
            <Route path="/host/:sessionId/lobby" element={<HostLobby />} />
            <Route path="/host/:sessionId/control" element={<HostControl />} />
            <Route path="/host/:sessionId/finish" element={<HostFinish />} />

            {/* Player Join Routes */}
            <Route path="/join/:sessionId" element={<PlayerJoinFlow />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
        {isSessionExpired && (
          <SessionExpiredModal isHost={Boolean(ggSession?.isHost)} context={isSessionExpired} />
        )}
      </BrowserRouter>
    </div>
  );
}
