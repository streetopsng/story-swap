import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { AVATAR_OPTIONS } from '../../utils/questionBank';

export default function AvatarPickerModal({ isOpen, onClose, selectedAvatar, onSelect }) {
  const [tempAv, setTempAv] = useState(selectedAvatar || '🙂');

  const handleConfirm = () => {
    onSelect(tempAv);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose your avatar">
      <div className="grid grid-cols-4 gap-3 my-4">
        {AVATAR_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setTempAv(emoji)}
            className={`w-full aspect-square rounded-full flex items-center justify-center text-3xl bg-white border-3 transition-transform cursor-pointer hover:scale-105 active:scale-95 ${
              tempAv === emoji
                ? 'border-[#F5821F] scale-108 shadow-md'
                : 'border-transparent'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="flex gap-3 items-center mt-6">
        <Button variant="orange" onClick={handleConfirm} className="flex-1">
          Confirm selection
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] font-bold text-[#555555] underline cursor-pointer px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
