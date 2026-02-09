import React from 'react';
import { Type } from 'lucide-react';
import { useEditor } from '../../../store/useEditor';
import { SettingsSection } from './SettingsSection';
import { OptionButton } from './OptionButton';

const EDITOR_FONTS = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Inconsolata',
  'Space Mono',
  'Ubuntu Mono',
  'Roboto Mono',
  'Consolas',
  'Courier New',
];

export const EditorFontSection: React.FC = () => {
  const { editorFont, setEditorFont } = useEditor();

  return (
    <SettingsSection icon={Type} title="Editor Font">
      <div className="grid grid-cols-1 gap-2">
        {EDITOR_FONTS.map((font) => (
          <OptionButton
            key={font}
            label={font}
            isSelected={editorFont === font}
            onClick={() => setEditorFont(font)}
            fontFamily={`'${font}', monospace`}
          />
        ))}
      </div>
    </SettingsSection>
  );
};
