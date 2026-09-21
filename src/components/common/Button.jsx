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
    'w-full py-3.5 px-5 rounded-full text-[15px] font-extrabold cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 select-none';

  const variants = {
    orange:
      'bg-[#F5821F] text-[#1A1A1A] shadow-[0_4px_0_#E8710A] active:translate-y-[2px] active:shadow-[0_2px_0_#E8710A] hover:brightness-105',
    dark:
      'bg-[#1A1A1A] text-white shadow-[0_4px_0_#000000] active:translate-y-[2px] active:shadow-[0_2px_0_#000000] hover:bg-[#2a2a2a]',
    outline:
      'bg-white text-[#1A1A1A] border-2 border-[#E0DBD4] shadow-[0_3px_0_#E0DBD4] active:translate-y-[2px] active:shadow-[0_1px_0_#E0DBD4] hover:bg-neutral-50',
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
