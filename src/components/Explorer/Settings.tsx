import React from 'react';
import { EditorThemeSection, EditorFontSection, AppUISection, EditorBehaviorSection, KeyboardShortcutsSection, InfoBanner } from './Settings/index';

export const Settings: React.FC = () => {
  return (
    <div className="h-full bg-[#252526] flex flex-col select-none overflow-hidden">
      <div className="p-3 uppercase text-[11px] font-bold text-gray-500 tracking-wider border-b border-[#333]">
        Settings
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 text-gray-300">
        <EditorThemeSection />
        <EditorFontSection />
        <EditorBehaviorSection />
        <AppUISection />
        <KeyboardShortcutsSection />

        <InfoBanner title="Status: Ready">
          SyntaxArk is running in **Session Mode**. 
          All files and packages are stored in local cache.
        </InfoBanner>
      </div>
    </div>
  );
};