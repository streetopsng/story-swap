import React, { useEffect, useState } from 'react';
import { BookIcon } from './Icons';

export default function LoadingScreen({ message = 'Loading experience...' }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 8000);
    const t2 = setTimeout(() => setStage(2), 20000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FDE8D0] border-2 border-[#F5821F]/30 flex items-center justify-center text-[#F5821F]">
          <BookIcon className="w-7 h-7" />
        </div>
        <div className="absolute -inset-1 rounded-2xl border-2 border-[#F5821F] border-t-transparent animate-spin" />
      </div>
      <div className="text-sm font-black uppercase tracking-wider text-[#F5821F] mb-1">
        Story Swap
      </div>
      <p className="text-xs font-semibold text-[#888]">{stage === 0 ? message : 'Still connecting… please wait'}</p>
      {stage === 2 && (
        <p className="text-xs text-[#888] mt-2 max-w-xs">
          This is taking longer than usual — check your internet connection. We'll keep trying.
        </p>
      )}
    </div>
  );
}
