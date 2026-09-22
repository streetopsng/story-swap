import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import Button from '../common/Button';
import { closeGummyGumSession } from '../../lib/gummygumSession';

export default function HostFinish() {
  const navigate = useNavigate();

  useEffect(() => {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <main className="flex flex-col min-h-screen w-full mx-auto bg-[#EDEAE4] overflow-hidden items-center justify-center p-6">
      <div className="w-full max-w-[430px] md:max-w-xl">
        <section className="bg-white border-[1.5px] border-[#E0DBD4] rounded-[32px] p-8 md:p-12 text-center shadow-[0_4px_0_#E0DBD4]">
          <div className="text-6xl md:text-7xl mb-4">🏁</div>
          <div className="text-[11px] md:text-[13px] font-extrabold tracking-widest uppercase text-[#F5821F] mb-2">
            Session complete
          </div>
          <h1 className="text-[26px] md:text-[34px] font-black text-[#1A1A1A] leading-tight mb-4">
            Nice conversations, team!
          </h1>
          <p className="text-[14px] md:text-[16px] text-[#555555] leading-relaxed max-w-md mx-auto mb-8">
            All Story Swap rounds have concluded. Great job facilitating genuine connections across your team!
          </p>

          <Button
            variant="orange"
            onClick={() => closeGummyGumSession()}
            className="py-4 text-base max-w-xs mx-auto"
          >
            Done — Return to GummyGum →
          </Button>
        </section>
      </div>
    </main>
  );
}
