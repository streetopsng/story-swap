import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import Navbar from '../common/Navbar';
import EndSessionButton from '../common/EndSessionButton';
import { CheckCircleIcon } from '../common/Icons';

export default function HostFinish() {
  const { sessionId } = useParams();

  useEffect(() => {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-hidden">
      <Navbar contextText="Session complete" sessionId={sessionId} maxWidthClass="max-w-[430px] md:max-w-5xl" />
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[430px] md:max-w-xl">
        <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[32px] p-8 md:p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FDE8D0] border border-[#F5821F]/30 text-[#F5821F] flex items-center justify-center">
            <CheckCircleIcon className="w-8 h-8" />
          </div>
          <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#F5821F] mb-2">
            Session complete
          </div>
          <h1 className="text-[26px] md:text-[34px] font-black text-[#1A1A1A] leading-tight mb-4">
            Nice conversations, team!
          </h1>
          <p className="text-[14px] md:text-[16px] text-[#555555] leading-relaxed max-w-md mx-auto mb-8">
            All Story Swap rounds have concluded. Great job facilitating genuine connections across your team!
          </p>

          <div className="max-w-xs mx-auto">
            <EndSessionButton sessionId={sessionId} variant="block" />
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
