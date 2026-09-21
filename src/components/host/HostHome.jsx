import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../common/Button';
import Input from '../common/Input';

export default function HostHome() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  const handleJoinWithCode = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/join/${joinCode.trim().toUpperCase()}`);
    }
  };

  return (
    <main className="w-full flex-1 flex flex-col justify-center items-center p-0 md:p-8">
      {/* Container: Mobile = max-w-[430px] min-h-screen; Desktop = max-w-5xl rounded-[32px] overflow-hidden shadow-2xl */}
      <div className="w-full max-w-[430px] md:max-w-5xl min-h-screen md:min-h-[580px] bg-[#EDEAE4] md:bg-white md:rounded-[32px] md:border md:border-[#E0DBD4] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
        
        {/* Left Column (Brand Hero) */}
        <section className="bg-[#F5821F] px-6 pt-12 pb-16 md:p-12 text-center md:text-left md:w-1/2 flex flex-col justify-between shrink-0">
          <div>
            <div className="text-[12px] md:text-[13px] font-black tracking-widest text-black/60 uppercase">
              GummyGum
            </div>
            <h1 className="text-[32px] md:text-[44px] font-black text-[#1A1A1A] mt-3 md:mt-4 leading-tight tracking-tight">
              Story Swap
            </h1>
            <p className="text-[13px] md:text-[16px] text-black/75 mt-2.5 md:mt-4 max-w-[320px] md:max-w-md leading-relaxed font-medium">
              Guided small-group conversations that help your team understand how each other works.
            </p>

            {/* Desktop Feature Highlights */}
            <div className="hidden md:grid grid-cols-1 gap-3 mt-8 max-w-md">
              <div className="bg-black/10 rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-xs">
                <span className="text-xl">🎲</span>
                <div>
                  <div className="text-[13px] font-extrabold text-[#1A1A1A]">Smart Grouping</div>
                  <div className="text-[12px] text-black/70">Automatic 2–3 person breakouts with new pairings every round.</div>
                </div>
              </div>
              <div className="bg-black/10 rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-xs">
                <span className="text-xl">💡</span>
                <div>
                  <div className="text-[13px] font-extrabold text-[#1A1A1A]">Curated Prompt Bank</div>
                  <div className="text-[12px] text-black/70">Thoughtful work-culture questions tailored for genuine connection.</div>
                </div>
              </div>
              <div className="bg-black/10 rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-xs">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="text-[13px] font-extrabold text-[#1A1A1A]">Zero Prep for Teammates</div>
                  <div className="text-[12px] text-black/70">Teammates click one link to enter, pick an avatar, and start sharing.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block text-[12px] text-black/50 font-bold pt-6">
            Story Swap by GummyGum · Real-time team conversations
          </div>
        </section>

        {/* Right Column (Actions & Join) */}
        <section className="flex-1 bg-white rounded-t-[28px] md:rounded-none -mt-6 md:mt-0 px-6 pt-8 pb-12 md:p-12 flex flex-col justify-between shadow-lg md:shadow-none">
          <div className="space-y-6 md:space-y-8 my-auto max-w-md mx-auto w-full">
            <div>
              <div className="hidden md:block text-[11px] font-extrabold tracking-widest text-[#F5821F] uppercase mb-1">
                Host a session
              </div>
              <div className="hidden md:block text-[22px] font-black text-[#1A1A1A] mb-4">
                Ready to bring your team closer?
              </div>
              <Button
                variant="orange"
                onClick={() => navigate('/host/setup')}
                className="text-base py-4"
              >
                Create a game ›
              </Button>
            </div>

            <p className="text-center text-[12px] md:text-[13px] text-[#999999] leading-relaxed">
              Employees join via an email invite sent by GummyGum or a direct link — no code or download needed on their end.
            </p>

            <div className="border-t border-[#E0DBD4] pt-6">
              <div className="text-[11px] font-extrabold tracking-widest text-[#555555] uppercase text-center mb-3">
                Have a session link or code?
              </div>
              <form onSubmit={handleJoinWithCode} className="flex gap-2">
                <Input
                  placeholder="Enter 6-char code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={8}
                  className="text-center font-bold uppercase tracking-wider"
                />
                <Button
                  type="submit"
                  variant="dark"
                  disabled={!joinCode.trim()}
                  className="w-auto px-6 whitespace-nowrap"
                >
                  Join ›
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center text-[11px] text-[#999999] pt-8 md:hidden">
            Story Swap by GummyGum · Real-time team conversations
          </div>
        </section>
      </div>
    </main>
  );
}
