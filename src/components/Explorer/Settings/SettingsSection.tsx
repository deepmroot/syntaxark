import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ icon: Icon, title, children }) => (
  <section className="mb-10 animate-in fade-in slide-in-from-left-2 duration-500">
    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
      <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
        <Icon size={14} className="text-blue-500/60" />
      </div>
      {title}
    </h3>
    <div className="space-y-4 px-1">
      {children}
    </div>
  </section>
);
