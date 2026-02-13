import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { CHALLENGES } from '../../data/challenges';
import type { Challenge } from '../../data/challenges';
import { useFileSystem } from '../../store/useFileSystem';
import type { ChallengeMeta } from '../../types/vfs';
import { Trophy, ChevronRight, Target, ArrowUpWideNarrow, Filter, Search, Share2, MessageCircle, CheckCircle2, Users } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useCollabSession } from '../../store/useCollabSession';
import { CHALLENGE_LANGUAGES, resolveChallengeLanguage, type ChallengeLanguage } from '../../data/challengeLanguages';

type SortKey = 'trending' | 'likes' | 'title' | 'difficulty' | 'newest';
type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
type SourceFilter = 'all' | 'builtin' | 'leetcode' | 'ai' | 'community';
type ProgressFilter = 'all' | 'solved' | 'unsolved';
type ChallengeSource = 'builtin' | 'leetcode' | 'ai' | 'community';
type ActivityStats = Record<string, { tried: number; accepted: number; active: number }>;
type MyActivityStats = Record<string, { tries: number; accepted: boolean; lastActiveAt: number | null }>;

const MAX_LEETCODE_ITEMS = 400;
const ROW_HEIGHT = 194;
const OVERSCAN_ROWS = 7;
let cachedLeetCodeQuestions: LeetCodeQuestion[] | null = null;

interface LeetCodeQuestion {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  likes: number;
  dislikes: number;
  isPaidOnly: boolean;
  url: string;
}

interface LeetCodeProblemDetail {
  content?: string;
  hints?: string[];
  topicTags?: Array<{ name?: string; slug?: string }>;
  companyTags?: Array<{ name?: string; slug?: string }>;
  difficulty?: string;
  likes?: number;
  dislikes?: number;
  url?: string;
}

interface ChallengeSolutionRecord {
  _id: string;
  challengeKey: string;
  language: string;
  fileName: string;
  code: string;
  passed: boolean;
  totalCases: number;
  passedCases: number;
  submittedAt: number;
}

interface CommunityChallengePost {
  _id: string;
  title: string;
  content: string;
  likes: number;
  timestamp: number;
  tags?: string[];
  language?: string;
  codeSnippet?: string;
}

interface AIChallengeTemplate {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  functionName: string;
  tags: string[];
  companyTags: string[];
  demandScore: number;
  starterCode: string;
}

interface UnifiedChallenge {
  key: string;
  source: ChallengeSource;
  title: string;
  difficulty: string;
  description: string;
  likes: number;
  demandScore: number;
  createdAt: number;
  tags: string[];
  companyTags: string[];
  externalUrl?: string;
  builtIn?: Challenge;
  leetCode?: LeetCodeQuestion;
  aiTemplate?: AIChallengeTemplate;
  communityPost?: CommunityChallengePost;
}

const AI_CHALLENGES: AIChallengeTemplate[] = [
  {
    id: 'ai-two-pointers-window',
    title: 'Session Peak Users',
    difficulty: 'Medium',
    description: 'Given login/logout events, return the max number of concurrent users at any time.',
    functionName: 'maxConcurrentUsers',
    tags: ['arrays', 'sweep-line', 'sorting'],
    companyTags: ['meta', 'uber', 'doordash'],
    demandScore: 88,
    starterCode: `function maxConcurrentUsers(events) {\n  // events: [[login, logout], ...]\n  // return max concurrent users\n  return 0;\n}`,
  },
  {
    id: 'ai-graph-service-reachability',
    title: 'Service Reachability Count',
    difficulty: 'Medium',
    description: 'Count how many services are reachable from a start node in a directed graph.',
    functionName: 'reachableCount',
    tags: ['graphs', 'bfs', 'dfs'],
    companyTags: ['netflix', 'airbnb', 'uber'],
    demandScore: 85,
    starterCode: `function reachableCount(n, edges, start) {\n  // n: number of nodes, edges: [from, to][]\n  // return count reachable from start\n  return 0;\n}`,
  },
  {
    id: 'ai-greedy-cdn-cache',
    title: 'CDN Cache Hits',
    difficulty: 'Easy',
    description: 'Given request URLs and cache size, return total cache hits using LRU policy.',
    functionName: 'countCacheHits',
    tags: ['hashmap', 'linked-list', 'simulation'],
    companyTags: ['amazon', 'cloudflare', 'google'],
    demandScore: 80,
    starterCode: `function countCacheHits(requests, capacity) {\n  // return number of requests served from cache\n  return 0;\n}`,
  },
];

const SOURCE_LABEL: Record<ChallengeSource, string> = {
  builtin: 'Built-in',
  leetcode: 'LeetCode',
  ai: 'AI',
  community: 'Community',
};

const difficultyRank = (difficulty: string) => {
  const d = difficulty.toLowerCase();
  if (d === 'easy') return 1;
  if (d === 'medium') return 2;
  if (d === 'hard') return 3;
  return 99;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const sourceBadgeClass: Record<ChallengeSource, string> = {
  builtin: 'bg-blue-900/30 text-blue-300',
  leetcode: 'bg-yellow-900/30 text-yellow-300',
  ai: 'bg-purple-900/30 text-purple-300',
  community: 'bg-green-900/30 text-green-300',
};

const normalizeDifficulty = (value: string): 'Easy' | 'Medium' | 'Hard' | 'Unknown' => {
  const d = value.toLowerCase();
  if (d === 'easy') return 'Easy';
  if (d === 'medium') return 'Medium';
  if (d === 'hard') return 'Hard';
  return 'Unknown';
};

const inferDifficultyFromTags = (tags?: string[]): 'Easy' | 'Medium' | 'Hard' | 'Unknown' => {
  const normalized = (tags || []).map((t) => t.toLowerCase());
  if (normalized.includes('easy')) return 'Easy';
  if (normalized.includes('medium')) return 'Medium';
  if (normalized.includes('hard')) return 'Hard';
  return 'Unknown';
};

const htmlToText = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};

const summarizeLeetCodeCardDescription = (htmlContent: string | undefined, title: string, difficulty: string): string => {
  const fallback = `Solve "${title}" (${normalizeDifficulty(difficulty)}).`;
  if (!htmlContent) return fallback;
  const text = htmlToText(htmlContent).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  const trimmed = text.slice(0, 180);
  return trimmed.length < text.length ? `${trimmed}...` : trimmed;
};

const resolveLanguage = (selected?: string): ChallengeLanguage => resolveChallengeLanguage(selected);

const starterForLanguage = (language: ChallengeLanguage, functionName?: string): string => {
  const fn = functionName || 'solve';
  if (language.extension === 'ts') return `function ${fn}(...args: unknown[]): unknown {\n  // TODO: implement\n  return null;\n}\n`;
  if (language.extension === 'py') return `def ${fn}(*args):\n    # TODO: implement\n    return None\n`;
  if (language.extension === 'java') return `public class Main {\n  public static int[] ${fn}(int[] nums, int target) {\n    // TODO: implement\n    return new int[0];\n  }\n}\n`;
  if (language.extension === 'cpp') return `#include <bits/stdc++.h>\nusing namespace std;\n\nvector<int> ${fn}(vector<int> nums, int target) {\n  // TODO: implement\n  return {};\n}\n`;
  if (language.extension === 'c') return `#include <stdio.h>\n\nint ${fn}(void* args) {\n  // TODO: implement\n  return 0;\n}\n`;
  if (language.extension === 'cs') return `using System.Collections.Generic;\n\npublic class Program {\n  public static List<int> ${fn}(List<int> nums, int target) {\n    // TODO: implement\n    return new List<int>();\n  }\n}\n`;
  if (language.extension === 'go') return `package main\n\nfunc ${fn}(nums []int, target int) []int {\n\t// TODO: implement\n\treturn []int{}\n}\n`;
  if (language.extension === 'rs') return `fn ${fn}(nums: Vec<i32>, target: i32) -> Vec<i32> {\n    // TODO: implement\n    vec![]\n}\n`;
  if (language.extension === 'kt') return `fun ${fn}(nums: List<Int>, target: Int): List<Int> {\n    // TODO: implement\n    return emptyList()\n}\n`;
  if (language.extension === 'swift') return `func ${fn}(_ nums: [Int], _ target: Int) -> [Int] {\n    // TODO: implement\n    return []\n}\n`;
  if (language.extension === 'php') return `<?php\nfunction ${fn}(...$args) {\n    // TODO: implement\n    return null;\n}\n`;
  if (language.extension === 'rb') return `def ${fn}(*args)\n  # TODO: implement\n  nil\nend\n`;
  if (language.extension === 'scala') return `object Solution {\n  def ${fn}(args: Any*): Any = {\n    // TODO: implement\n    null\n  }\n}\n`;
  if (language.extension === 'dart') return `dynamic ${fn}(List<dynamic> args) {\n  // TODO: implement\n  return null;\n}\n`;
  if (language.extension === 'lua') return `function ${fn}(nums, target)\n  -- TODO: implement\n  return {}\nend\n`;
  if (language.extension === 'r') return `${fn} <- function(nums, target) {\n  # TODO: implement\n  return(c())\n}\n`;
  if (language.extension === 'sql') return `-- ${fn}\n-- TODO: write your SQL query here\nSELECT 1;\n`;
  if (language.extension === 'sh') return `#!/bin/bash\n\n${fn}() {\n  # TODO: implement\n  :\n}\n`;
  return `function ${fn}(...args) {\n  // TODO: implement\n  return null;\n}\n`;
};

const splitTopLevel = (text: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1;
    if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const parseLooseLiteral = (value: string): any => {
  const raw = value.trim();
  if (!raw) return raw;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  if (/^null$/i.test(raw)) return null;

  const candidates = [
    raw,
    raw.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null'),
    raw.replace(/'/g, '"'),
    raw.replace(/'/g, '"').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null'),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue fallback attempts.
    }
  }
  return raw;
};

const parseExampleInputArgs = (inputLine: string): any[] => {
  const normalizedInput = inputLine
    .replace(/\r/g, '\n')
    .replace(/\n+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!normalizedInput) return [];
  const parts = splitTopLevel(normalizedInput);
  const values = parts.map((part) => {
    const eqIndex = part.indexOf('=');
    const rhs = eqIndex >= 0 ? part.slice(eqIndex + 1).trim() : part.trim();
    return parseLooseLiteral(rhs);
  });
  if (values.length === 0) return [inputLine.trim()];
  return values;
};

const buildLeetCodeTestCases = (problemText: string) => {
  const matches = Array.from(problemText.matchAll(/Input:\s*([\s\S]*?)\s*Output:\s*([^\n\r]+)/gi));
  if (matches.length === 0) {
    return [
      { name: 'Case 1', input: ['sample input'], expected: 'sample output' },
    ];
  }
  return matches.slice(0, 8).map((match, index) => ({
    name: `Example ${index + 1}`,
    input: parseExampleInputArgs(match[1] || ''),
    expected: parseLooseLiteral(match[2] || ''),
  }));
};
export const ChallengesPanel: React.FC = () => {
  const apiAny = api as any;
  const { createNode, setActiveFile, nodes } = useFileSystem();
  const { user, updateProfile } = useAuth();
  const { roomId } = useCollabSession();

  const communityPosts = (useQuery(api.community.getPosts) || []) as unknown as CommunityChallengePost[];
  const createCommunityPost = useMutation(api.community.createPost);
  const sendRoomMessage = useMutation(api.rooms.sendMessage);
  const touchActivity = useMutation(api.challenges.touchActivity);
  const updateProfileMutation = useMutation(api.users.updateProfile);

  const [leetCodeQuestions, setLeetCodeQuestions] = useState<LeetCodeQuestion[]>([]);
  const [loadingLeetCode, setLoadingLeetCode] = useState(true);
  const [_leetCodeError, setLeetCodeError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('All');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('trending');
  const [searchText, setSearchText] = useState('');
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, LeetCodeProblemDetail>>({});
  const [leetCodeSummaryCache, setLeetCodeSummaryCache] = useState<Record<string, string>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLanguage || 'javascript');
  const [feedback, setFeedback] = useState('');
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [deepLinkChallengeKey, setDeepLinkChallengeKey] = useState<string | null>(null);
  const consumedDeepLinksRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(''), 1800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (user?.preferredLanguage) {
      setSelectedLanguage(user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);

  useEffect(() => {
    if (cachedLeetCodeQuestions && cachedLeetCodeQuestions.length > 0) {
      setLeetCodeQuestions(cachedLeetCodeQuestions);
      setLoadingLeetCode(false);
      return;
    }

    const controller = new AbortController();
    const mapLeetCodeQuestion = (raw: any): LeetCodeQuestion | null => {
      const id = String(raw?.questionFrontendId ?? raw?.questionId ?? raw?.frontend_id ?? raw?.frontendId ?? raw?.id ?? '');
      const title = String(raw?.title ?? '').trim();
      const slug = String(raw?.titleSlug ?? raw?.title_slug ?? raw?.slug ?? '').trim();
      if (!id || !title || !slug) return null;

      return {
        id,
        title,
        slug,
        difficulty: String(raw?.difficulty ?? 'Unknown'),
        likes: Number(raw?.likes ?? raw?.acRate ?? 0),
        dislikes: Number(raw?.dislikes ?? 0),
        isPaidOnly: Boolean(raw?.isPaidOnly ?? raw?.paid_only),
        url: String(raw?.url ?? `https://leetcode.com/problems/${slug}/`),
      };
    };

    const fetchLeetCode = async () => {
      const endpoints = ['https://leetcode-api-pied.vercel.app/problems', 'https://leetcode-api-pied.vercel.app/'];
      setLoadingLeetCode(true);
      setLeetCodeError(null);

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { signal: controller.signal });
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.problems)
              ? data.problems
              : Array.isArray(data?.items)
                ? data.items
                : [];

          const normalized = list.map(mapLeetCodeQuestion).filter((q: LeetCodeQuestion | null): q is LeetCodeQuestion => q !== null);
          if (normalized.length > 0) {
            const limited = normalized.slice(0, MAX_LEETCODE_ITEMS);
            cachedLeetCodeQuestions = limited;
            setLeetCodeQuestions(limited);
            setLoadingLeetCode(false);
            return;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }

      setLeetCodeError('Could not load LeetCode questions.');
      setLoadingLeetCode(false);
    };

    void fetchLeetCode();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [sourceFilter, difficultyFilter, progressFilter, sortBy, searchText]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncDeepLinkFromHash = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const raw = params.get('challenge');
      const challenge = raw || null;
      setDeepLinkChallengeKey(challenge);
    };
    syncDeepLinkFromHash();
    window.addEventListener('hashchange', syncDeepLinkFromHash);
    return () => window.removeEventListener('hashchange', syncDeepLinkFromHash);
  }, []);

  const upsertOpenFile = (name: string, content: string, challengeId: string, challengeMeta: ChallengeMeta, activate: boolean) => {
    const existing = Object.values(nodes).find((n) => n.challengeId === challengeId && n.name === name);
    if (existing) {
      if (activate) setActiveFile(existing.id);
      return existing.id;
    }
    const id = createNode(name, 'file', null, content, challengeId, challengeMeta);
    if (activate) setActiveFile(id);
    return id;
  };

  const openChallengeWorkspace = (params: {
    challengeKey: string;
    title: string;
    prompt: string;
    language: ChallengeLanguage;
    difficulty?: string;
    functionName?: string;
    tags?: string[];
    companyTags?: string[];
    externalUrl?: string;
    testCases?: any[];
    preferredStarter?: string;
  }) => {
    const slug = slugify(params.title) || 'challenge';

    const challengeMeta: ChallengeMeta = {
      source: params.challengeKey.startsWith('leetcode:') ? 'leetcode'
        : params.challengeKey.startsWith('ai:') ? 'ai'
          : params.challengeKey.startsWith('community:') ? 'community'
            : 'builtin',
      title: params.title,
      description: params.prompt,
      difficulty: params.difficulty,
      functionName: params.functionName,
      testCases: params.testCases as any,
      externalUrl: params.externalUrl,
      tags: params.tags || [],
      companyTags: params.companyTags || [],
    };

    const promptFilename = `${slug}.problem.md`;
    const solutionFilename = `${slug}.${params.language.extension}`;
    const defaultStarter = params.preferredStarter || starterForLanguage(params.language, params.functionName);
    const solutionContent = `// ${params.title}\n// Language: ${params.language.label}\n\n${defaultStarter}`;

    upsertOpenFile(promptFilename, params.prompt, params.challengeKey, challengeMeta, false);
    upsertOpenFile(solutionFilename, solutionContent, params.challengeKey, challengeMeta, true);
  };

  const openBuiltInChallenge = (challenge: Challenge, key: string, language: ChallengeLanguage) => {
    const prompt = `# ${challenge.title}\n\nDifficulty: ${challenge.difficulty}\n\n${challenge.description}`;
    const preferredStarter = language.extension === 'js' ? challenge.initialCode : starterForLanguage(language, challenge.functionName);
    openChallengeWorkspace({
      challengeKey: key,
      title: challenge.title,
      prompt,
      language,
      difficulty: challenge.difficulty,
      functionName: challenge.functionName,
      testCases: challenge.testCases,
      tags: ['syntaxark'],
      preferredStarter,
    });
  };

  const openLeetCodeChallenge = async (question: LeetCodeQuestion, key: string, language: ChallengeLanguage) => {
    let detail = detailCache[question.slug];
    if (!detail) {
      try {
        const res = await fetch(`https://leetcode-api-pied.vercel.app/problem/${question.slug}`);
        if (res.ok) {
          detail = await res.json();
          setDetailCache((prev) => ({ ...prev, [question.slug]: detail! }));
        }
      } catch {
        // fallback below
      }
    }
    const fullPrompt = detail?.content ? htmlToText(detail.content) : `Open this link for the full problem statement:\n${question.url}`;
    const hints = Array.isArray(detail?.hints) ? detail!.hints!.filter(Boolean) : [];
    const topicTags = Array.isArray(detail?.topicTags)
      ? detail!.topicTags!.map((t) => t?.name).filter((t): t is string => Boolean(t))
      : [];
    const companyTags = Array.isArray(detail?.companyTags)
      ? detail!.companyTags!.map((t) => t?.name).filter((t): t is string => Boolean(t))
      : [];
    const mergedDifficulty = normalizeDifficulty(String(detail?.difficulty ?? question.difficulty));
    const mergedUrl = String(detail?.url ?? question.url);

    const prompt = `# ${question.id}. ${question.title}

- Source: LeetCode
- Difficulty: ${mergedDifficulty}
- Likes: ${Number(detail?.likes ?? question.likes)}
- Dislikes: ${Number(detail?.dislikes ?? question.dislikes)}
- URL: ${mergedUrl}
${topicTags.length > 0 ? `- Topics: ${topicTags.join(', ')}` : ''}
${companyTags.length > 0 ? `- Companies: ${companyTags.join(', ')}` : ''}

## Problem
${fullPrompt}

${hints.length > 0 ? `## Hints\n${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n` : ''}`;
    const testCases = buildLeetCodeTestCases(fullPrompt);
    const starter = starterForLanguage(language, 'solve');

    openChallengeWorkspace({
      challengeKey: key,
      title: `${question.id}-${question.title}`,
      prompt,
      language,
      difficulty: mergedDifficulty,
      functionName: 'solve',
      testCases,
      externalUrl: mergedUrl,
      tags: topicTags,
      companyTags,
      preferredStarter: starter,
    });
  };

  const openAiChallenge = (template: AIChallengeTemplate, key: string, language: ChallengeLanguage) => {
    const prompt = `# ${template.title}

- Source: AI Challenge
- Difficulty: ${template.difficulty}
- Tags: ${template.tags.join(', ')}
- Company Focus: ${template.companyTags.join(', ')}

## Problem
${template.description}
`;
    openChallengeWorkspace({
      challengeKey: key,
      title: template.title,
      prompt,
      language,
      difficulty: template.difficulty,
      functionName: template.functionName,
      testCases: [{ name: 'Case 1', input: ['sample input'], expected: 'sample output' }],
      tags: template.tags,
      companyTags: template.companyTags,
      preferredStarter: language.extension === 'js' ? template.starterCode : starterForLanguage(language, template.functionName),
    });
  };

  const openCommunityChallenge = (post: CommunityChallengePost, key: string, language: ChallengeLanguage) => {
    const prompt = `# ${post.title}

- Source: Community
- Likes: ${post.likes}
- Posted: ${new Date(post.timestamp).toLocaleDateString()}

## Description
${post.content}
`;
    const functionName = 'solve';
    const preferredStarter = post.codeSnippet
      ? post.codeSnippet
      : starterForLanguage(language, functionName);

    openChallengeWorkspace({
      challengeKey: key,
      title: post.title,
      prompt,
      language,
      difficulty: inferDifficultyFromTags(post.tags),
      functionName,
      testCases: [{ name: 'Case 1', input: ['sample input'], expected: 'sample output' }],
      tags: post.tags || [],
      preferredStarter,
    });
  };

  const unifiedChallenges = useMemo<UnifiedChallenge[]>(() => {
    const builtIn: UnifiedChallenge[] = CHALLENGES.map((c) => ({
      key: `builtin:${c.id}`,
      source: 'builtin',
      title: c.title,
      difficulty: c.difficulty,
      description: c.description,
      likes: 0,
      demandScore: 70,
      createdAt: 0,
      tags: ['syntaxark'],
      companyTags: [],
      builtIn: c,
    }));

    const leetCode: UnifiedChallenge[] = leetCodeQuestions.map((q) => ({
      key: `leetcode:${q.id}:${q.slug}`,
      source: 'leetcode',
      title: q.title,
      difficulty: normalizeDifficulty(q.difficulty),
      description: leetCodeSummaryCache[q.slug] || `Solve "${q.title}" (${normalizeDifficulty(q.difficulty)}).`,
      likes: q.likes,
      demandScore: Math.min(100, Math.max(30, Math.floor(q.likes / 20))),
      createdAt: 0,
      tags: q.isPaidOnly ? ['premium'] : [],
      companyTags: [],
      externalUrl: q.url,
      leetCode: q,
    }));

    const ai: UnifiedChallenge[] = AI_CHALLENGES.map((a) => ({
      key: `ai:${a.id}`,
      source: 'ai',
      title: a.title,
      difficulty: a.difficulty,
      description: a.description,
      likes: 0,
      demandScore: a.demandScore,
      createdAt: Date.now(),
      tags: a.tags,
      companyTags: a.companyTags,
      aiTemplate: a,
    }));

    const community: UnifiedChallenge[] = communityPosts
      .filter((p: any) => p.type === 'challenge')
      .map((p: any) => ({
        key: `community:${String(p._id ?? p.id)}`,
        source: 'community',
        title: String(p.title ?? 'Untitled Community Challenge'),
        difficulty: inferDifficultyFromTags(p.tags),
        description: String(p.content ?? ''),
        likes: Number(p.likes ?? 0),
        demandScore: Math.min(100, Math.max(20, Number(p.likes ?? 0) * 5)),
        createdAt: Number(p.timestamp ?? 0),
        tags: Array.isArray(p.tags) ? p.tags : [],
        companyTags: [],
        communityPost: p,
      }));

    return [...builtIn, ...leetCode, ...ai, ...community];
  }, [communityPosts, leetCodeQuestions, leetCodeSummaryCache]);

  const allChallengeKeys = useMemo(() => unifiedChallenges.map((row) => row.key).slice(0, 800), [unifiedChallenges]);
  const myActivityStats = (useQuery(
    apiAny.challenges.getMyActivityForKeys,
    allChallengeKeys.length > 0 && user && !user.isGuest ? { challengeKeys: allChallengeKeys } : 'skip',
  ) || {}) as MyActivityStats;

  const visibleChallenges = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let rows = unifiedChallenges.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (difficultyFilter !== 'All' && row.difficulty !== difficultyFilter) return false;
      if (!query) return true;
      const hay = `${row.title} ${row.description} ${row.tags.join(' ')} ${row.companyTags.join(' ')}`.toLowerCase();
      return hay.includes(query);
    });

    if (progressFilter !== 'all' && user && !user.isGuest) {
      rows = rows.filter((row) => {
        const accepted = Boolean(myActivityStats?.[row.key]?.accepted);
        return progressFilter === 'solved' ? accepted : !accepted;
      });
    }

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'likes') return b.likes - a.likes;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'difficulty') return difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      return (b.likes + b.demandScore) - (a.likes + a.demandScore);
    });

    return rows;
  }, [difficultyFilter, myActivityStats, progressFilter, searchText, sortBy, sourceFilter, unifiedChallenges, user]);

  const challengeKeysForStats = useMemo(() => visibleChallenges.map((row) => row.key).slice(0, 500), [visibleChallenges]);
  const mySolutions = (useQuery(
    apiAny.challenges.listMySolutions,
    user && !user.isGuest ? { limit: 60 } : 'skip',
  ) || []) as ChallengeSolutionRecord[];
  const activityStats = (useQuery(
    api.challenges.getActivityForKeys,
    challengeKeysForStats.length > 0 ? { challengeKeys: challengeKeysForStats } : 'skip',
  ) || {}) as ActivityStats;

  const { startIndex, renderedChallenges, totalHeight } = useMemo(() => {
    const total = visibleChallenges.length;
    if (total === 0) {
      return { startIndex: 0, renderedChallenges: [] as UnifiedChallenge[], totalHeight: 0 };
    }
    const estimatedVisible = Math.max(1, Math.ceil(viewportHeight / ROW_HEIGHT));
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
    const end = Math.min(total, start + estimatedVisible + OVERSCAN_ROWS * 2);
    return {
      startIndex: start,
      renderedChallenges: visibleChallenges.slice(start, end),
      totalHeight: total * ROW_HEIGHT,
    };
  }, [visibleChallenges, scrollTop, viewportHeight]);

  useEffect(() => {
    const pending = renderedChallenges
      .filter((item) => item.source === 'leetcode' && item.leetCode)
      .map((item) => item.leetCode!)
      .filter((q) => !leetCodeSummaryCache[q.slug]);
    if (pending.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const q of pending.slice(0, 10)) {
        try {
          const res = await fetch(`https://leetcode-api-pied.vercel.app/problem/${q.slug}`);
          if (!res.ok) continue;
          const detail = await res.json();
          const summary = summarizeLeetCodeCardDescription(detail?.content, q.title, q.difficulty);
          if (cancelled) return;
          setLeetCodeSummaryCache((prev) => (prev[q.slug] ? prev : { ...prev, [q.slug]: summary }));
        } catch {
          // ignore
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [renderedChallenges, leetCodeSummaryCache]);

  const openChallenge = async (item: UnifiedChallenge, language: ChallengeLanguage) => {
    setOpeningKey(item.key);
    try {
      if (item.source === 'builtin' && item.builtIn) openBuiltInChallenge(item.builtIn, item.key, language);
      if (item.source === 'leetcode' && item.leetCode) await openLeetCodeChallenge(item.leetCode, item.key, language);
      if (item.source === 'ai' && item.aiTemplate) openAiChallenge(item.aiTemplate, item.key, language);
      if (item.source === 'community' && item.communityPost) openCommunityChallenge(item.communityPost, item.key, language);

      if (user && !user.isGuest) {
        void touchActivity({ challengeKey: item.key, event: 'open' }).catch(() => {});
      }
    } finally {
      setOpeningKey(null);
    }
  };

  const requestOpenChallenge = (item: UnifiedChallenge) => {
    void openChallenge(item, resolveLanguage(selectedLanguage));
  };
  const reopenFromSubmission = (solution: ChallengeSolutionRecord) => {
    const item = unifiedChallenges.find((row) => row.key === solution.challengeKey);
    if (!item) {
      setFeedback('Challenge not found for this submission');
      return;
    }
    void openChallenge(item, resolveLanguage(solution.language));
  };
  const shareChallengeLink = async (item: UnifiedChallenge) => {
    const url = `${window.location.origin}${window.location.pathname}#challenge=${encodeURIComponent(item.key)}`;
    await navigator.clipboard.writeText(url);
    setFeedback('Challenge link copied');
  };

  useEffect(() => {
    if (!deepLinkChallengeKey) return;
    if (consumedDeepLinksRef.current.has(deepLinkChallengeKey)) return;
    if (openingKey) return;
    const match = unifiedChallenges.find((item) => item.key === deepLinkChallengeKey);
    if (!match) return;

    consumedDeepLinksRef.current.add(deepLinkChallengeKey);
    void openChallenge(match, resolveLanguage(selectedLanguage));
  }, [deepLinkChallengeKey, openingKey, unifiedChallenges, selectedLanguage]);

  const shareToCommunity = async (item: UnifiedChallenge) => {
    if (!user || user.isGuest) {
      setFeedback('Sign in to share');
      return;
    }
    const link = `${window.location.origin}${window.location.pathname}#challenge=${encodeURIComponent(item.key)}`;
    await createCommunityPost({
      authorId: user.id as any,
      authorName: user.username,
      authorAvatar: user.avatar,
      type: 'challenge',
      title: `Shared: ${item.title}`,
      content: `${item.description}\n\nOpen: ${link}`,
      tags: ['shared', item.source, item.difficulty.toLowerCase()],
      language: undefined,
      codeSnippet: undefined,
    });
    setFeedback('Shared to community');
  };

  const shareToRoom = async (item: UnifiedChallenge) => {
    if (!user || user.isGuest || !roomId) {
      setFeedback('Join a collaboration room first');
      return;
    }
    const link = `${window.location.origin}${window.location.pathname}#challenge=${encodeURIComponent(item.key)}`;
    await sendRoomMessage({
      roomId: roomId as any,
      senderId: user.id as any,
      senderName: user.username,
      content: `Challenge: ${item.title}\n${link}`,
    });
    setFeedback('Shared to room chat');
  };

  const handleLanguageChange = async (languageKey: string) => {
    setSelectedLanguage(languageKey);
    if (!user || user.isGuest) return;
    updateProfile({ preferredLanguage: languageKey });
    try {
      await updateProfileMutation({ userId: user.id as any, preferredLanguage: languageKey });
    } catch {
      // Keep local preference even if remote save fails.
    }
  };

  const languagePreview = resolveLanguage(selectedLanguage);

  return (
    <div className="h-full bg-[#1e1e1e]/50 backdrop-blur-xl flex flex-col select-none overflow-hidden relative border-r border-white/5">
      <div className="p-3 md:p-4 uppercase text-[10px] font-bold text-gray-400 tracking-[0.16em] md:tracking-[0.2em] flex items-center justify-between gap-2 border-b border-white/5 bg-white/5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Trophy size={14} className="text-yellow-500" />
          </div>
          <span className="truncate">Algorithm Challenges</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {feedback && (
            <span className="text-[10px] text-emerald-400 normal-case bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-in fade-in slide-in-from-top-1">
              {feedback}
            </span>
          )}
          {user && !user.isGuest && (
            <button
              onClick={() => setShowSubmissions((s) => !s)}
              className="text-[10px] normal-case px-2 py-1 rounded-full border border-white/15 text-gray-300 hover:text-white hover:border-white/30"
            >
              {showSubmissions ? 'Hide Submissions' : 'My Submissions'}
            </button>
          )}
        </div>
      </div>

      {showSubmissions && user && !user.isGuest && (
        <div className="border-b border-white/5 max-h-44 overflow-y-auto custom-scrollbar bg-white/[0.02]">
          {mySolutions.length === 0 ? (
            <div className="px-4 py-3 text-[11px] text-gray-500">No submissions yet. Run tests to record attempts.</div>
          ) : (
            mySolutions.map((s) => (
              <div key={s._id} className="px-4 py-2 border-b border-white/5 text-[11px] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-gray-200 truncate">{s.challengeKey}</div>
                  <div className="text-gray-500">
                    {s.language.toUpperCase()} • {s.passedCases}/{s.totalCases} • {new Date(s.submittedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => reopenFromSubmission(s)}
                  className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300 hover:text-white text-[10px]"
                >
                  Reopen
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="p-3 md:p-4 border-b border-white/5 space-y-3 md:space-y-4 bg-white/[0.02]">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search challenges, tags, companies..."
            className="ethereal-input w-full h-10 pl-10 pr-4 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Source</label>
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select 
                value={sourceFilter} 
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} 
                className="ethereal-input w-full h-9 pl-9 pr-2 text-xs appearance-none"
              >
                <option value="all">All Sources</option>
                <option value="builtin">Built-in</option>
                <option value="leetcode">LeetCode</option>
                <option value="ai">AI</option>
                <option value="community">Community</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Difficulty</label>
            <div className="relative">
              <Target size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select 
                value={difficultyFilter} 
                onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)} 
                className="ethereal-input w-full h-9 pl-9 pr-2 text-xs appearance-none"
              >
                <option value="All">All Levels</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Sort By</label>
            <div className="relative">
              <ArrowUpWideNarrow size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortKey)} 
                className="ethereal-input w-full h-9 pl-9 pr-2 text-xs appearance-none"
              >
                <option value="trending">Trending</option>
                <option value="likes">Likes</option>
                <option value="difficulty">Difficulty</option>
                <option value="newest">Newest</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Language</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <div className="w-3 h-3 rounded-full border border-gray-500 flex items-center justify-center text-[8px] font-bold">
                  {languagePreview.extension.slice(0,1).toUpperCase()}
                </div>
              </div>
              <select 
                value={selectedLanguage} 
                onChange={(e) => { void handleLanguageChange(e.target.value); }} 
                className="ethereal-input w-full h-9 pl-9 pr-2 text-xs appearance-none"
              >
                {CHALLENGE_LANGUAGES.map((lang) => (
                  <option key={lang.key} value={lang.key}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-start sm:items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="relative">
            <select 
              value={progressFilter} 
              onChange={(e) => setProgressFilter(e.target.value as ProgressFilter)} 
              className="ethereal-input h-7 px-3 text-[10px] appearance-none min-w-[100px]"
            >
              <option value="all">All Progress</option>
              <option value="solved">Solved</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </div>
          {user && !user.isGuest && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Solved {allChallengeKeys.filter((key) => Boolean(myActivityStats?.[key]?.accepted)).length}
              </span>
            </div>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4" onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}>
        {loadingLeetCode && (
          <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl glass-card animate-pulse">
            <div className="w-4 h-4 rounded-full bg-white/10" />
            <div className="h-3 w-32 bg-white/10 rounded" />
          </div>
        )}
        
        {visibleChallenges.length > 0 ? (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {renderedChallenges.map((item, idx) => {
              const absoluteIndex = startIndex + idx;
              const stats = activityStats[item.key] || { tried: 0, accepted: 0, active: 0 };
              const solvedByMe = Boolean(myActivityStats?.[item.key]?.accepted);
              return (
                <div
                  key={item.key}
                  style={{ 
                    position: 'absolute', 
                    left: 0, 
                    right: 0, 
                    top: absoluteIndex * ROW_HEIGHT, 
                    height: ROW_HEIGHT - 12
                  }}
                  onClick={() => { requestOpenChallenge(item); }}
                  className="group glass-card p-4 cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3 gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                      <div className={`p-2 rounded-xl transition-colors ${solvedByMe ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20'}`}>
                        <Target size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            item.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : item.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : item.difficulty === 'Hard' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-white/5 text-gray-400 border-white/10'
                          }`}>
                            {item.difficulty}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${sourceBadgeClass[item.source]} border-current/20`}>
                            {SOURCE_LABEL[item.source]}
                          </span>
                          {solvedByMe && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500 text-black border border-emerald-500/20">
                              Solved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed group-hover:text-gray-400 transition-colors">
                    {item.description}
                  </p>

                  <div className="mt-4 flex items-start sm:items-center justify-between text-[10px] text-gray-500 gap-3 border-t border-white/5 pt-3 flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5" title="Active users">
                        <Users size={12} className="text-blue-400/60" />
                        <span className="font-bold text-gray-400">{stats.active}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Success rate">
                        <CheckCircle2 size={12} className="text-emerald-400/60" />
                        <span className="font-bold text-gray-400">
                          {stats.tried > 0 ? Math.round((stats.accepted / stats.tried) * 100) : 0}%
                        </span>
                      </div>
                      {item.likes > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Trophy size={12} className="text-amber-400/60" />
                          <span className="font-bold text-gray-400">{item.likes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 sm:translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); void shareChallengeLink(item); }} 
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Copy Link"
                        >
                          <Share2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); void shareToCommunity(item); }} 
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Share to Community"
                        >
                          <MessageCircle size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); void shareToRoom(item); }} 
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Share to Room"
                        >
                          <Users size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-blue-400 font-bold uppercase tracking-wider text-[9px] group-hover:text-blue-300">
                        <span>{openingKey === item.key ? 'Opening' : 'Solve'}</span>
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !loadingLeetCode && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 glass-card border-dashed">
              <div className="p-4 rounded-full bg-white/5 mb-4">
                <Filter size={32} className="text-gray-600" />
              </div>
              <h3 className="text-gray-300 font-bold mb-1">No challenges found</h3>
              <p className="text-[11px] text-gray-500 max-w-[200px]">
                Try adjusting your filters or search query to find more algorithms.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
