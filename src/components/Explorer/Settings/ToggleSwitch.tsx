import React from 'react';

interface ToggleSwitchProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, options, selected, onSelect }) => (
  <div className="flex items-center justify-between bg-[#2d2d2d] p-3 rounded border border-[#444]">
    <span className="text-sm">{label}</span>
    <div className="flex bg-[#1e1e1e] p-1 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={`px-3 py-1 text-xs rounded transition-all ${
            selected === opt.value
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);
