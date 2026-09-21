import React from 'react';

export default function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  maxLength,
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full bg-white border-[1.5px] border-[#E0DBD4] rounded-[10px] text-[#1A1A1A] text-[15px] px-3.5 py-3 outline-none placeholder-[#bbb] focus:border-[#F5821F] transition-colors font-sans ${className}`}
      {...props}
    />
  );
}
