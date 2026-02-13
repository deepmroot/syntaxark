import React from 'react';
import { FileCode, FileText, FileJson } from 'lucide-react';

interface FileIconProps {
  name: string;
  size?: number;
  className?: string;
}

const DEVICON_MAP: Record<string, string> = {
  js: 'devicon-javascript-plain colored',
  mjs: 'devicon-javascript-plain colored',
  ts: 'devicon-typescript-plain colored',
  tsx: 'devicon-react-original colored',
  jsx: 'devicon-react-original colored',
  html: 'devicon-html5-plain colored',
  css: 'devicon-css3-plain colored',
  py: 'devicon-python-plain colored',
  json: 'devicon-json-plain colored',
  java: 'devicon-java-plain colored',
  c: 'devicon-c-plain colored',
  cpp: 'devicon-cplusplus-plain colored',
  php: 'devicon-php-plain colored',
  rb: 'devicon-ruby-plain colored',
  rs: 'devicon-rust-original colored', // or devicon-rust-plain
  go: 'devicon-go-original-wordmark colored',
  lua: 'devicon-lua-plain colored',
  swift: 'devicon-swift-plain colored',
  kt: 'devicon-kotlin-plain colored',
  r: 'devicon-r-plain colored',
  sh: 'devicon-bash-plain colored',
  md: 'devicon-markdown-original colored',
  cs: 'devicon-csharp-plain colored',
  sql: 'devicon-azuresqldatabase-plain colored',
  dart: 'devicon-dart-plain colored',
};

export const FileIcon: React.FC<FileIconProps> = ({ name, size = 16, className = '' }) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  const deviconClass = DEVICON_MAP[ext];

  if (deviconClass) {
    return (
      <i 
        className={`${deviconClass} ${className}`} 
        style={{ fontSize: `${size}px`, width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
    );
  }

  // Fallbacks using Lucide
  switch (ext) {
    case 'json':
      return <FileJson size={size} className={`${className} text-amber-400/80`} />;
    case 'md':
    case 'markdown':
      return <FileText size={size} className={`${className} text-blue-400/80`} />;
    case 'txt':
      return <FileText size={size} className={`${className} text-gray-500/80`} />;
    default:
      return <FileCode size={size} className={`${className} text-gray-400/80`} />;
  }
};
