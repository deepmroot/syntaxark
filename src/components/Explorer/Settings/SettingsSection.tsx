import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ icon: Icon, title, children }) => (
  <section>
    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
      <Icon size={12} /> {title}
    </h3>
    {children}
  </section>
);
