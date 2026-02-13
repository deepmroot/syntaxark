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
    className={`flex items-center justify-between px-4 h-10 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border ${
      isSelected
        ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
        : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:border-white/10 hover:text-gray-300'
    }`}
  >
    <span style={fontFamily ? { fontFamily } : undefined}>{label}</span>
    {isSelected && (
      <div className="p-1 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]">
        <Check size={10} className="text-white" strokeWidth={4} />
      </div>
    )}
  </button>
);
