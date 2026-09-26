import React from 'react';

export default function LoadingScreen({ message = 'Loading experience...' }) {
  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FDE8D0] border-2 border-[#F5821F]/30 flex items-center justify-center text-3xl animate-bounce">
          📖
        </div>
        <div className="absolute -inset-1 rounded-2xl border-2 border-[#F5821F] border-t-transparent animate-spin" />
      </div>
      <div className="text-sm font-black uppercase tracking-wider text-[#F5821F] mb-1">
        Story Swap
      </div>
      <p className="text-xs font-semibold text-[#888]">{message}</p>
    </div>
  );
}
