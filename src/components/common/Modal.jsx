import React, { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF7F2] rounded-t-[24px] sm:rounded-[24px] p-5 pb-8 sm:pb-6 w-full max-w-[430px] max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl transition-transform transform translate-y-0"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="text-[17px] font-extrabold text-center text-[#1A1A1A] mb-4">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
