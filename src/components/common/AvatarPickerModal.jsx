import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Avatar from './Avatar';
import { AVATAR_IDS } from '../../lib/avatars';

export default function AvatarPickerModal({ isOpen, onClose, selectedAvatar, onSelect }) {
  const [tempAv, setTempAv] = useState(selectedAvatar);

  const handleConfirm = () => {
    if (tempAv) onSelect(tempAv);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose your avatar">
      <div className="grid grid-cols-5 gap-2.5 my-4">
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTempAv(id)}
            aria-label={`Avatar ${id}`}
            className={`w-full aspect-square rounded-full bg-white border-3 transition-transform cursor-pointer hover:scale-105 active:scale-95 ${
              tempAv === id ? 'border-[#F5821F] shadow-md' : 'border-transparent'
            }`}
          >
            <Avatar id={id} className="w-full h-full" />
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
