import React from 'react';
import { Monitor } from 'lucide-react';
import { useEditor } from '../../../store/useEditor';
import { SettingsSection } from './SettingsSection';
import { ToggleSwitch } from './ToggleSwitch';

const THEME_OPTIONS = [
  { value: 'vs-dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export const AppUISection: React.FC = () => {
  const { theme, setTheme } = useEditor();

  return (
    <SettingsSection icon={Monitor} title="Application UI">
      <div className="space-y-3">
        <ToggleSwitch
          label="Main Theme"
          options={THEME_OPTIONS}
          selected={theme}
          onSelect={(value) => setTheme(value as 'vs-dark' | 'light')}
        />
      </div>
    </SettingsSection>
  );
};
