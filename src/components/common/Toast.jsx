import React from 'react';

export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white text-[13px] font-bold py-2.5 px-5 rounded-full z-50 shadow-[0_4px_0_#000] whitespace-nowrap transition-all duration-300 animate-bounce">
      {message}
    </div>
  );
}
