import React from 'react';
import Button from '../common/Button';
import { returnToGummyGum, reportGummyGumCancel } from '../../lib/gummygumSession';

export default function SessionExpiredModal({ isHost }) {
  const handleHostRehost = async () => {
    try {
      await reportGummyGumCancel();
    } catch {
      // ignore
    }
    returnToGummyGum();
  };

  const handleClose = () => {
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-[#E0DBD4] rounded-[24px] p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl animate-fadeUp flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center text-2xl mb-3 shadow-xs">
          ⏱️
        </div>
        <h3 className="text-xl font-black text-[#1A1A1A] mb-1.5">
          Session Expired
        </h3>
        <p className="text-xs sm:text-[13px] text-[#666] leading-relaxed mb-6">
          {isHost
            ? "This session was inactive in the lobby for more than 20 minutes and has expired. You can return to GummyGum to launch a fresh session."
            : "This session has expired due to inactivity. Thank you for being here — you can safely close this tab now."}
        </p>

        {isHost ? (
          <Button
            variant="orange"
            onClick={handleHostRehost}
            className="w-full py-3 rounded-xl font-bold cursor-pointer text-sm"
          >
            ← Return to GummyGum to Rehost
          </Button>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 rounded-xl font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-[#E0DBD4] active:translate-y-0.5 transition-all cursor-pointer text-sm"
          >
            Close Tab
          </button>
        )}
      </div>
    </div>
  );
}
