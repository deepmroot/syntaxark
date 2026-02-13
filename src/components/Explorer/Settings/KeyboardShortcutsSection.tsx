import React from 'react';
import { Keyboard } from 'lucide-react';
import { SettingsSection } from './SettingsSection';

const SHORTCUTS: [string, string][] = [
  ['Ctrl + Enter', 'Run'],
  ['Ctrl + Shift + Enter', 'Run Tests'],
  ['Ctrl + B', 'Toggle Sidebar'],
  ['Ctrl + ,', 'Open Settings'],
  ['Ctrl + Shift + F', 'Search Files'],
  ['Ctrl + Shift + E', 'Explorer'],
  ['Ctrl + Shift + D', 'Toggle Whiteboard'],
  ['Ctrl + \\', 'Toggle Split Editor'],
  ['Ctrl + `', 'Toggle Console'],
  ['Ctrl + T', 'Toggle Console'],
  ['Ctrl + S', 'Save (auto-saved)'],
  ['Ctrl + Shift + P', 'Keyboard Shortcuts'],
  ['Space (in drawing)', 'Toggle Hand Tool'],
  ['Ctrl + drag (in drawing)', 'Pan Canvas'],
  ['Ctrl + scroll (in drawing)', 'Zoom Canvas'],
  ['Escape', 'Close Dialogs'],
];

export const KeyboardShortcutsSection: React.FC = () => (
  <SettingsSection icon={Keyboard} title="Keyboard Shortcuts">
    <div className="space-y-1">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={keys} className="flex items-center justify-between py-1.5 px-3 rounded bg-[#2d2d2d] border border-[#444]">
          <span className="text-xs text-gray-400">{action}</span>
          <kbd className="text-[10px] bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#555] font-mono text-gray-300">
            {keys}
          </kbd>
        </div>
      ))}
    </div>
  </SettingsSection>
);
