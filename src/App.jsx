import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HostHome from './components/host/HostHome';
import HostSetup from './components/host/HostSetup';
import HostLobby from './components/host/HostLobby';
import HostControl from './components/host/HostControl';
import HostFinish from './components/host/HostFinish';
import PlayerJoinFlow from './components/player/PlayerJoinFlow';

export default function App() {
  return (
    <div className="min-h-screen bg-[#EDEAE4] text-[#1A1A1A] flex flex-col items-center justify-start antialiased selection:bg-[#F5821F] selection:text-[#1A1A1A]">
      <BrowserRouter>
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
