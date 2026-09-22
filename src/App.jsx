import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HostHome from './components/host/HostHome';
import HostSetup from './components/host/HostSetup';
import HostLobby from './components/host/HostLobby';
import HostControl from './components/host/HostControl';
import HostFinish from './components/host/HostFinish';
import PlayerJoinFlow from './components/player/PlayerJoinFlow';
import { resolveGummyGumLaunch } from './lib/gummygumSession';
import { getSession, createSession } from './firebase/sessionService';

function AppCoordinator() {
  const navigate = useNavigate();
  const location = useLocation();
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    resolveGummyGumLaunch().then(async (session) => {
      if (routedRef.current) return;
      const params = new URLSearchParams(window.location.search);
      const code = session?.roomCode || params.get('pin') || params.get('sessionId') || params.get('code') || params.get('room');
      const isHost = session?.isHost ?? (
        params.get('host') === 'true' ||
        params.get('isHost') === 'true' ||
        params.get('role') === 'host'
      );

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
              });
            }
          } catch (err) {
            console.error('Auto session ensure failed:', err);
          }
          navigate(`/host/${code}/lobby`, { replace: true });
        } else {
          // Carry forward search params so PlayerJoinFlow has email & name
          const search = window.location.search;
          navigate(`/join/${code}${search}`, { replace: true });
        }
      }
    });
  }, [navigate, location]);

  return null;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#EDEAE4] text-[#1A1A1A] flex flex-col items-center justify-start antialiased selection:bg-[#F5821F] selection:text-[#1A1A1A]">
      <BrowserRouter>
        <AppCoordinator />
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
      </BrowserRouter>
    </div>
  );
}
