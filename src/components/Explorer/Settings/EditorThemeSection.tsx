import React from 'react';
import { Palette } from 'lucide-react';
import { useEditor } from '../../../store/useEditor';
import { SettingsSection } from './SettingsSection';
import { OptionButton } from './OptionButton';

const THEMES = [
  { id: 'vs-dark', name: 'VS Dark', type: 'dark' },
  { id: 'light', name: 'VS Light', type: 'light' },
  { id: 'hc-black', name: 'High Contrast', type: 'dark' },
];

export const EditorThemeSection: React.FC = () => {
  const { monacoTheme, setMonacoTheme, theme, setTheme } = useEditor();

  const handleThemeChange = (id: string, type: string) => {
    setMonacoTheme(id);
    if (type === 'dark' && theme !== 'vs-dark') setTheme('vs-dark');
    if (type === 'light' && theme !== 'light') setTheme('light');
  };

  return (
    <SettingsSection icon={Palette} title="Editor Theme">
      <div className="grid grid-cols-1 gap-2">
        {THEMES.map((t) => (
          <OptionButton
            key={t.id}
            label={t.name}
            isSelected={monacoTheme === t.id}
            onClick={() => handleThemeChange(t.id, t.type)}
          />
        ))}
      </div>
    </SettingsSection>
  );
};
