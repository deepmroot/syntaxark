import React from 'react';
import { Check } from 'lucide-react';

interface OptionButtonProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  fontFamily?: string;
}

export const OptionButton: React.FC<OptionButtonProps> = ({ label, isSelected, onClick, fontFamily }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-all border ${
      isSelected
        ? 'bg-blue-600/20 border-blue-600 text-white'
        : 'bg-[#2d2d2d] border-[#444] hover:border-[#666]'
    }`}
  >
    <span style={fontFamily ? { fontFamily } : undefined}>{label}</span>
    {isSelected && <Check size={14} />}
  </button>
);
