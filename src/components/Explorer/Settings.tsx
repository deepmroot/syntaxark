import React from 'react';
import { EditorThemeSection, EditorFontSection, AppUISection, EditorBehaviorSection, KeyboardShortcutsSection, InfoBanner } from './Settings/index';

export const Settings: React.FC = () => {
  return (
    <div className="h-full bg-[#141417]/50 backdrop-blur-xl flex flex-col select-none overflow-hidden relative border-r border-white/5">
      <div className="p-4 uppercase text-[10px] font-black text-gray-500 tracking-[0.3em] border-b border-white/5 bg-white/5">
        Settings
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12">
        <EditorThemeSection />
        <EditorFontSection />
        <EditorBehaviorSection />
        <AppUISection />
        <KeyboardShortcutsSection />

        <div className="pt-4">
          <InfoBanner title="Status: Ready">
            SyntaxArk is running in **Session Mode**. 
            All files and packages are stored in local cache.
          </InfoBanner>
        </div>
      </div>
    </div>
  );
};