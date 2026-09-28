import React from 'react';

export default function Button({
  children,
  variant = 'orange', // 'orange' | 'dark' | 'outline'
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...props
}) {
  const baseStyles =
    'w-full py-3.5 px-5 rounded-xl text-[15px] font-extrabold cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 select-none';

  const variants = {
    orange:
      'bg-[#F5821F] text-[#1A1A1A] border border-[#E8710A]/50 shadow-sm active:translate-y-px hover:brightness-105 hover:shadow-md',
    dark:
      'bg-[#1A1A1A] text-white border border-[#1A1A1A] shadow-sm active:translate-y-px hover:bg-[#2a2a2a] hover:shadow-md',
    outline:
      'bg-white text-[#1A1A1A] border-2 border-[#E0DBD4] shadow-xs active:translate-y-px hover:bg-neutral-50',
  };

  const disabledStyles = disabled
    ? 'opacity-45 pointer-events-none cursor-not-allowed active:translate-y-0 shadow-none'
    : '';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.orange} ${disabledStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
