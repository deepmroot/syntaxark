export interface ChallengeLanguage {
  key: string;
  label: string;
  extension: string;
}

export const CHALLENGE_LANGUAGES: ChallengeLanguage[] = [
  { key: 'javascript', label: 'JavaScript', extension: 'js' },
  { key: 'typescript', label: 'TypeScript', extension: 'ts' },
  { key: 'python', label: 'Python', extension: 'py' },
  { key: 'java', label: 'Java', extension: 'java' },
  { key: 'cpp', label: 'C++', extension: 'cpp' },
  { key: 'c', label: 'C', extension: 'c' },
  { key: 'csharp', label: 'C#', extension: 'cs' },
  { key: 'go', label: 'Go', extension: 'go' },
  { key: 'rust', label: 'Rust', extension: 'rs' },
  { key: 'kotlin', label: 'Kotlin', extension: 'kt' },
  { key: 'swift', label: 'Swift', extension: 'swift' },
  { key: 'php', label: 'PHP', extension: 'php' },
  { key: 'ruby', label: 'Ruby', extension: 'rb' },
  { key: 'scala', label: 'Scala', extension: 'scala' },
  { key: 'dart', label: 'Dart', extension: 'dart' },
  { key: 'lua', label: 'Lua', extension: 'lua' },
  { key: 'r', label: 'R', extension: 'r' },
  { key: 'sql', label: 'SQL', extension: 'sql' },
  { key: 'bash', label: 'Bash', extension: 'sh' },
];

export const DEFAULT_CHALLENGE_LANGUAGE = 'javascript';

export const resolveChallengeLanguage = (key?: string): ChallengeLanguage =>
  CHALLENGE_LANGUAGES.find((lang) => lang.key === key) || CHALLENGE_LANGUAGES[0];
