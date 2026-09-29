import React from 'react';
import { avatarUrl } from '../../lib/avatars';
import { UserIcon } from './Icons';

// Legacy emoji or missing values render a neutral silhouette instead of the glyph.
export default function Avatar({ id, className = 'w-10 h-10', alt = '' }) {
  const src = avatarUrl(id);
  if (!src) {
    return (
      <span className={`${className} rounded-full bg-[#EDEAE4] text-[#999999] flex items-center justify-center shrink-0`}>
        <UserIcon className="w-3/5 h-3/5" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`${className} rounded-full object-cover bg-[#FDE8D0] shrink-0`}
    />
  );
}
