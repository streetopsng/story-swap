import React from 'react';
import { useNavigate } from 'react-router-dom';
import { returnToGummyGum } from '../../lib/gummygumSession';

export default function Navbar({ contextText = 'Story Swap', showBack = false, onBack, maxWidthClass = 'max-w-[430px] md:max-w-5xl' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={`px-4 pt-4 pb-2 flex items-center justify-between shrink-0 ${maxWidthClass} w-full mx-auto`}>
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-full bg-white border border-[#E0DBD4] flex items-center justify-center text-sm font-bold text-[#1A1A1A] cursor-pointer hover:bg-neutral-100 mr-1"
            title="Back"
          >
            ←
          </button>
        )}
        <span className="text-[14px] md:text-[16px] font-black text-[#F5821F] tracking-tight">
          GummyGum
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] md:text-[12px] font-bold text-[#999999] tracking-wider uppercase truncate max-w-[160px] md:max-w-xs hidden sm:inline">
          {contextText}
        </span>
        <button
          type="button"
          onClick={() => returnToGummyGum()}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E0DBD4] text-xs font-bold text-[#555] hover:text-[#1A1A1A] hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          title="Back to GummyGum"
        >
          <span>← Back to GummyGum</span>
        </button>
      </div>
    </header>
  );
}
