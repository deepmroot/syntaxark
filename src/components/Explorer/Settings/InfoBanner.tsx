import React from 'react';
import { Info } from 'lucide-react';

interface InfoBannerProps {
  title: string;
  children: React.ReactNode;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ title, children }) => (
  <section className="bg-blue-900/10 p-4 rounded border border-blue-900/30">
    <div className="flex items-start gap-3">
      <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-blue-300 uppercase tracking-tight">{title}</div>
        <div className="text-[11px] text-gray-400 leading-relaxed">{children}</div>
      </div>
    </div>
  </section>
);
