import React from 'react';
import { Code2 } from 'lucide-react';
import { useEditor } from '../../../store/useEditor';
import { SettingsSection } from './SettingsSection';
import { ToggleSwitch } from './ToggleSwitch';

const ON_OFF = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

const BOOL_OPTS = [
  { value: 'true', label: 'On' },
  { value: 'false', label: 'Off' },
];

const TAB_SIZES = [
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
];

export const EditorBehaviorSection: React.FC = () => {
  const {
    fontSize, setFontSize,
    minimap, setMinimap,
    wordWrap, setWordWrap,
    lineNumbers, setLineNumbers,
    bracketPairs, setBracketPairs,
    autoComplete, setAutoComplete,
    tabSize, setTabSize,
    smoothScrolling, setSmoothScrolling,
  } = useEditor();

  return (
    <SettingsSection icon={Code2} title="Editor Behavior">
      <div className="space-y-2">
        <ToggleSwitch
          label="Auto Complete"
          options={BOOL_OPTS}
          selected={autoComplete ? 'true' : 'false'}
          onSelect={(v) => setAutoComplete(v === 'true')}
        />
        <ToggleSwitch
          label="Word Wrap"
          options={ON_OFF}
          selected={wordWrap}
          onSelect={(v) => setWordWrap(v as 'on' | 'off')}
        />
        <ToggleSwitch
          label="Minimap"
          options={BOOL_OPTS}
          selected={minimap ? 'true' : 'false'}
          onSelect={(v) => setMinimap(v === 'true')}
        />
        <ToggleSwitch
          label="Line Numbers"
          options={ON_OFF}
          selected={lineNumbers}
          onSelect={(v) => setLineNumbers(v as 'on' | 'off')}
        />
        <ToggleSwitch
          label="Bracket Colorization"
          options={BOOL_OPTS}
          selected={bracketPairs ? 'true' : 'false'}
          onSelect={(v) => setBracketPairs(v === 'true')}
        />
        <ToggleSwitch
          label="Smooth Scrolling"
          options={BOOL_OPTS}
          selected={smoothScrolling ? 'true' : 'false'}
          onSelect={(v) => setSmoothScrolling(v === 'true')}
        />
        <ToggleSwitch
          label="Tab Size"
          options={TAB_SIZES}
          selected={String(tabSize)}
          onSelect={(v) => setTabSize(Number(v))}
        />
        <div className="flex items-center justify-between bg-[#2d2d2d] p-3 rounded border border-[#444]">
          <span className="text-sm">Font Size</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={24}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{fontSize}px</span>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};
