import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HostLobby from './components/host/HostLobby';
import HostControl from './components/host/HostControl';
import HostFinish from './components/host/HostFinish';
import PlayerJoinFlow from './components/player/PlayerJoinFlow';
import { resolveGummyGumLaunch, returnToGummyGum, hostExitInProgressRef, watchHubSessionStatus } from './lib/gummygumSession';
import {
  getSession,
  createSession,
  subscribeSession,
  touchSessionActivity,
  markSessionAbandoned,
  endSession,
  reopenLobby,
  CLOSED_STATUSES,
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

const GummyGumCancelledScreen = ({ isHost = false, completed = false }) => (
  <div className="min-h-screen w-full bg-[#EDEAE4] text-[#1A1A1A] flex items-center justify-center p-6">
    <div className="max-w-md w-full p-8 text-center space-y-4 bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] shadow-sm">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FDE8D0] border border-[#F5821F]/30 text-[#F5821F] flex items-center justify-center">
        <CheckCircleIcon className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-black text-[#1A1A1A]">{completed ? 'Session Complete' : 'Session Ended'}</h1>
      <p className="text-[#555] text-sm leading-relaxed">
        {isHost
          ? 'This session was ended. You can return to GummyGum to launch another experience.'
          : completed
          ? 'Thanks for playing! The session is complete. You can close this tab now.'
          : 'The host ended this session. You can close this tab now.'}
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

const LOBBY_IDLE_MS = 20 * 60 * 1000;

// Firestore Timestamp, millis, Date or ISO string -> millis; null when missing or
// still pending (serverTimestamp() reads back as null until the server acks it).
const toMillis = (value) => {
  if (value == null) return null;
  let ms;
  if (typeof value.toMillis === 'function') ms = value.toMillis();
  else if (typeof value === 'number') ms = value;
  else if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'string') ms = Date.parse(value);
  else if (typeof value.seconds === 'number') ms = value.seconds * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

const latestMillis = (...values) => {
  const valid = values.map(toMillis).filter((ms) => ms !== null);
  return valid.length ? Math.max(...valid) : null;
};

const isIdleLobby = (sess, now = Date.now()) => {
  if (sess?.status !== 'lobby') return false;
  const openedMs = latestMillis(sess.createdAt, sess.lobbyOpenedAt);
  return openedMs !== null && now - openedMs >= LOBBY_IDLE_MS;
};

const isAbandonedGame = (sess, now = Date.now()) => {
  if (sess?.status !== 'in-progress') return false;
  const last = latestMillis(sess.lastActivity, sess.updatedAt, sess.roundStartedAt, sess.createdAt);
  return last !== null && now - last >= ABANDON_THRESHOLD_MS;
};

// The hub reuses a PIN for "run again" rounds, so a doc under this PIN may belong
// to an earlier room; that one must be replaced, never shown as expired/ended.
const isFromEarlierRoom = (sess, hostedSessionId) => {
  if (!sess || !hostedSessionId) return false;
  if (sess.hostedSessionId) return sess.hostedSessionId !== hostedSessionId;
  return sess.status === 'completed' || CLOSED_STATUSES.includes(sess.status) || isIdleLobby(sess);
};

function AppCoordinator({ setGgSessionState, setGgCancelled, setGgExpired }) {
  const navigate = useNavigate();
  const location = useLocation();
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    const isFreshLaunch = new URLSearchParams(window.location.search).has('ggt');
    resolveGummyGumLaunch().then(async (session) => {
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

        if (isHost) {
          try {
            // Only replace a room that isn't this launch's; an ended/expired room of this
            // same launch must stay ended so a duplicate tab can't resurrect it.
            if (!existing || isFromEarlierRoom(existing, session?.hostedSessionId)) {
              const hostName = session?.player?.name || params.get('name') || 'Team';
              const config = session?.config || {};
              const configRounds = Number(config.roundCount);
              await createSession({
                sessionId: code,
                name: (typeof config.name === 'string' && config.name.trim()) || `${hostName}'s Story Swap`,
                roundCount: Number.isInteger(configRounds) && configRounds > 0 ? configRounds : 3,
                invitedCount,
                hostedSessionId: session?.hostedSessionId || null,
              });
              existing = null;
            } else if (isFreshLaunch && existing.status === 'lobby') {
              await reopenLobby(code);
            }
          } catch (err) {
            console.error('Auto session ensure failed:', err);
          }
        }

        // Checked before this client's heartbeat starts so a returning
        // client can't mask a genuinely abandoned session.
        if (isAbandonedGame(existing)) {
          await markSessionAbandoned(code);
        }

        let latestStatus = null;
        setInterval(() => {
          if (latestStatus === 'in-progress') touchSessionActivity(code);
        }, HEARTBEAT_INTERVAL_MS);

        let seenDoc = false;
        let hubEnded = false;
        subscribeSession(code, (sessData) => {
          if (hostExitInProgressRef.current || hubEnded) return;
          latestStatus = sessData?.status || null;
          // A missing doc only means "ended" once it has existed; before that it's still being created.
          if (!sessData) {
            if (seenDoc) setGgCancelled('ended');
            return;
          }
          seenDoc = true;
          if (sessData.status === 'cancelled' || sessData.status === 'ended') {
            setGgCancelled(sessData.completed ? 'completed' : 'ended');
            return;
          }
          if (sessData.status === 'expired') {
            setGgExpired(sessData.abandoned ? 'game' : 'lobby');
            return;
          }
          setGgExpired(isIdleLobby(sessData) ? 'lobby' : false);
        });

        // The host may end the session from the hub, which never touches this room.
        const hostedSessionId = session?.hostedSessionId;
        watchHubSessionStatus({
          pin: session ? code : null,
          hostedSessionId,
          onEnded: async (hubSession) => {
            if (hostExitInProgressRef.current || hubEnded) return;
            hubEnded = true;
            const completed = latestStatus === 'completed';
            if (!isHost) {
              setGgExpired(false);
              setGgCancelled(completed ? 'completed' : 'ended');
              return;
            }
            // Our own natural-finish report ends the hosted session; keep the host on the finish screen.
            if (completed && String(hubSession.id) === String(hostedSessionId) && hubSession.status === 'Ended') return;
            hostExitInProgressRef.current = true;
            // A newer re-run owns the PIN's room now, so only mark it ended if it is still ours.
            if (String(hubSession.id) === String(hostedSessionId)) {
              await Promise.race([
                endSession(code, { completed }).catch(() => {}),
                new Promise((resolve) => setTimeout(resolve, 5000)),
              ]);
            }
            returnToGummyGum();
          },
        });

        if (isHost) {
          navigate(`/host/${code}/lobby`, { replace: true });
        } else {
          const search = window.location.search;
          navigate(`/join/${code}${search}`, { replace: true });
        }
        // Revealed only after routing, so the standalone create screen at "/" never flashes.
        setGgSessionState(session);
      } else {
        setGgSessionState(session);
      }
    });
  }, [navigate, location, setGgSessionState, setGgCancelled, setGgExpired]);

  return null;
}

export default function App() {
  const [ggChecked, setGgChecked] = useState(false);
  const [ggSession, setGgSession] = useState(null);
  // false, or 'ended' | 'completed'
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
          <GummyGumCancelledScreen isHost={Boolean(ggSession?.isHost)} completed={isCancelled === 'completed'} />
        ) : !ggSession ? (
          <GummyGumLockedScreen />
        ) : (
          <Routes>
            {/* Host Routes */}
            {/* Story Swap only runs from a GummyGum launch, which routes to a lobby or join screen. */}
            <Route path="/" element={ggSession.roomCode ? <LoadingScreen message="Connecting to GummyGum..." /> : <GummyGumLockedScreen />} />
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
