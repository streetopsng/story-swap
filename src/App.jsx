import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HostHome from './components/host/HostHome';
import HostSetup from './components/host/HostSetup';
import HostLobby from './components/host/HostLobby';
import HostControl from './components/host/HostControl';
import HostFinish from './components/host/HostFinish';
import PlayerJoinFlow from './components/player/PlayerJoinFlow';
import { resolveGummyGumLaunch, returnToGummyGum } from './lib/gummygumSession';
import { getSession, createSession, subscribeSession } from './firebase/sessionService';

const GummyGumLockedScreen = () => (
  <div className="min-h-screen w-full bg-[#EDEAE4] text-[#1A1A1A] flex items-center justify-center p-6">
    <div className="max-w-md w-full p-8 text-center space-y-4 bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] shadow-[0_4px_0_#E0DBD4]">
      <div className="text-5xl">🔒</div>
      <h1 className="text-2xl font-black text-[#1A1A1A]">Launch from GummyGum</h1>
      <p className="text-[#555] text-sm leading-relaxed">
        This experience is exclusively available through the GummyGum Hub. Open it from your GummyGum dashboard to start or join a session.
      </p>
      <a href="https://gummygum.app" className="inline-block mt-3 px-6 py-3 rounded-full bg-[#F5821F] text-[#1A1A1A] font-extrabold hover:bg-[#E07212] transition-colors shadow-sm">
        Go to GummyGum
      </a>
    </div>
  </div>
);

const GummyGumCancelledScreen = () => (
  <div className="min-h-screen w-full bg-[#EDEAE4] text-[#1A1A1A] flex items-center justify-center p-6">
    <div className="max-w-md w-full p-8 text-center space-y-4 bg-white border-[1.5px] border-[#E0DBD4] rounded-[24px] shadow-[0_4px_0_#E0DBD4]">
      <div className="text-5xl">👋</div>
      <h1 className="text-2xl font-black text-[#1A1A1A]">Session Ended</h1>
      <p className="text-[#555] text-sm leading-relaxed">
        This session was ended by the host. You can safely close this tab now.
      </p>
      <button
        onClick={() => returnToGummyGum()}
        className="inline-block mt-3 px-6 py-3 rounded-full bg-[#F5821F] text-[#1A1A1A] font-extrabold hover:bg-[#E07212] transition-colors shadow-sm cursor-pointer"
      >
        Return to GummyGum
      </button>
    </div>
  </div>
);

function AppCoordinator({ setGgSessionState, setGgCancelled }) {
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
        if (isHost) {
          try {
            const existing = await getSession(code);
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
          // Listen to session to detect cancellation
          subscribeSession(code, (sessData) => {
            if (!sessData || sessData.status === 'cancelled' || sessData.status === 'ended') {
              setGgCancelled(true);
            }
          });
          const search = window.location.search;
          navigate(`/join/${code}${search}`, { replace: true });
        }
      }
    });
  }, [navigate, location, setGgSessionState, setGgCancelled]);

  return null;
}

export default function App() {
  const [ggChecked, setGgChecked] = useState(false);
  const [ggSession, setGgSession] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const handleGgSession = (sess) => {
    setGgSession(sess);
    setGgChecked(true);
  };

  return (
    <div className="min-h-screen bg-[#EDEAE4] text-[#1A1A1A] flex flex-col items-center justify-start antialiased selection:bg-[#F5821F] selection:text-[#1A1A1A]">
      <BrowserRouter>
        <AppCoordinator setGgSessionState={handleGgSession} setGgCancelled={setIsCancelled} />
        {!ggChecked ? (
          <div className="min-h-screen w-full bg-[#EDEAE4]" />
        ) : isCancelled ? (
          <GummyGumCancelledScreen />
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
      </BrowserRouter>
    </div>
  );
}
