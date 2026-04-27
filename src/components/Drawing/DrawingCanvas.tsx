import React, { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useEditor } from '../../store/useEditor';
import { WHITEBOARD_COMPACT_BREAKPOINTS } from '../../config/whiteboard';
import type {
  SharedWhiteboardOp,
  SharedWhiteboardPoint,
  SharedWhiteboardStyle,
  SharedWhiteboardTextObject,
} from '../../collab/whiteboard/types';
import { isRasterWhiteboardOp } from '../../collab/whiteboard/ops';
import {
  initialWhiteboardHistoryState,
  whiteboardHistoryReducer,
} from '../../collab/whiteboard/reducer';
import {
  Pencil, Pen, Highlighter, Eraser, Square, Circle, Minus, Type,
  Undo2, Redo2, Trash2, Download, PaintBucket, MousePointer, RotateCcw,
  Triangle, Star, ArrowRight, Diamond, Pipette, X as XIcon,
  Grid3X3, StickyNote, Database, Server, Cloud, Hexagon,
  GitBranch, Workflow, Monitor, MessageSquare, Hand,
  ZoomIn, ZoomOut, Maximize, Minimize2, SlidersHorizontal, Palette, LocateFixed,
} from 'lucide-react';

/* ─────────────────── types ─────────────────── */

type Tool =
  | 'select' | 'pencil' | 'pen' | 'marker' | 'eraser' | 'hand'
  | 'line' | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'arrow'
  | 'text' | 'fill' | 'eyedropper'
  | 'stamp-flowbox' | 'stamp-decision' | 'stamp-database' | 'stamp-server'
  | 'stamp-cloud' | 'stamp-note' | 'stamp-actor' | 'stamp-process';

interface Point { x: number; y: number }
interface TextObject extends SharedWhiteboardTextObject {}
type AssistLevel = 'off' | 'low' | 'medium' | 'high';
interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  cursorX?: number;
  cursorY?: number;
  isSharing?: boolean;
  isDrawing?: boolean;
}

type SharedShapeTool = Extract<Tool, 'line' | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'arrow'>;
type SharedFreeTool = Extract<Tool, 'pencil' | 'pen' | 'marker' | 'eraser'>;
type SharedStampTool = Extract<Tool, 'stamp-flowbox' | 'stamp-decision' | 'stamp-database' | 'stamp-server' | 'stamp-cloud' | 'stamp-note' | 'stamp-actor' | 'stamp-process'>;

/* ═══════════════════ persistent state (survives close/open) ═══════════════════ */

const CANVAS_W = 4000;
const CANVAS_H = 4000;
const EDGE_REBASE_MARGIN = 280;

let _savedImageData: ImageData | null = null;
let _savedUndos: ImageData[] = [];
let _savedRedos: ImageData[] = [];
let _savedPan: Point = { x: -CANVAS_W / 2 + 400, y: -CANVAS_H / 2 + 300 };
let _savedZoom = 1;

/* ─────────────────── shape helpers ─────────────────── */

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
}

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function hslToHex(h: number, s: number, l: number) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;

  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function drawTextObject(ctx: CanvasRenderingContext2D, t: TextObject) {
  ctx.save();
  ctx.font = `${t.size * 4 + 14}px sans-serif`;
  ctx.fillStyle = t.color;
  ctx.globalAlpha = t.opacity / 100;
  ctx.fillText(t.text, t.x, t.y);
  ctx.restore();
}

function hexToHsl(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

/* ─── draw a diagram stamp ─── */
function drawStamp(ctx: CanvasRenderingContext2D, tool: Tool, x: number, y: number, color: string, isDark: boolean, label?: string) {
  const fg = color;
  const bg = isDark ? '#2d2d2d' : '#f9f9f9';
  const textColor = isDark ? '#e0e0e0' : '#333333';

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = fg;
  ctx.fillStyle = bg;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (tool) {
    case 'stamp-flowbox': {
      const w = 140, h = 50, r = 8;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
      ctx.lineTo(x + w / 2, y + h / 2 - r);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
      ctx.lineTo(x - w / 2, y - h / 2 + r);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Process', x, y);
      break;
    }
    case 'stamp-decision': {
      const s = 60;
      ctx.beginPath();
      diamondPath(ctx, x, y, s * 2.6, s * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Condition?', x, y);
      break;
    }
    case 'stamp-database': {
      const w = 80, h = 90, ey = 14;
      ctx.beginPath();
      ctx.ellipse(x, y - h / 2 + ey, w / 2, ey, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2 + ey);
      ctx.lineTo(x - w / 2, y + h / 2 - ey);
      ctx.ellipse(x, y + h / 2 - ey, w / 2, ey, 0, Math.PI, 0, true);
      ctx.lineTo(x + w / 2, y - h / 2 + ey);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2 - ey, w / 2, ey, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Database', x, y + 5);
      break;
    }
    case 'stamp-server': {
      const w = 80, h = 100, r = 6;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
      ctx.lineTo(x + w / 2, y + h / 2 - r);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
      ctx.lineTo(x - w / 2, y - h / 2 + r);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        const ly = y - h / 2 + (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + 8, ly);
        ctx.lineTo(x + w / 2 - 8, ly);
        ctx.stroke();
      }
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Server', x, y - h / 2 + 18);
      break;
    }
    case 'stamp-cloud': {
      ctx.beginPath();
      ctx.arc(x, y - 10, 30, Math.PI * 0.9, Math.PI * 0.1);
      ctx.arc(x + 28, y + 2, 22, Math.PI * 1.3, Math.PI * 0.5);
      ctx.arc(x, y + 16, 24, 0, Math.PI, false);
      ctx.arc(x - 28, y + 2, 22, Math.PI * 0.5, Math.PI * 1.8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Cloud', x, y + 4);
      break;
    }
    case 'stamp-note': {
      const w = 140, h = 90;
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#ca8a04';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 16, y - h / 2);
      ctx.lineTo(x + w / 2 - 16, y - h / 2 + 16);
      ctx.lineTo(x + w / 2, y - h / 2 + 16);
      ctx.stroke();
      ctx.fillStyle = '#713f12';
      ctx.font = '12px sans-serif';
      ctx.fillText(label || 'Sticky Note', x, y);
      break;
    }
    case 'stamp-actor': {
      ctx.beginPath();
      ctx.arc(x, y - 35, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - 21); ctx.lineTo(x, y + 10);
      ctx.moveTo(x - 22, y - 10); ctx.lineTo(x + 22, y - 10);
      ctx.moveTo(x, y + 10); ctx.lineTo(x - 18, y + 35);
      ctx.moveTo(x, y + 10); ctx.lineTo(x + 18, y + 35);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'User', x, y + 50);
      break;
    }
    case 'stamp-process': {
      const w = 150, h = 45, r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.arc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.arc(x - w / 2 + r, y, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(label || 'Start / End', x, y);
      break;
    }
  }
  ctx.restore();
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D, style: SharedWhiteboardStyle, bgColor: string) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = style.opacity / 100;
  ctx.globalCompositeOperation = 'source-over';
  if (style.tool === 'eraser') {
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = style.size * 4;
  } else if (style.tool === 'marker') {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.size * 4;
    ctx.globalAlpha = 0.3;
  } else if (style.tool === 'pen') {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.size * 2;
  } else {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.size;
  }
  if (style.doFill) ctx.fillStyle = style.fillColor;
}

function drawShapeWithStyle(
  ctx: CanvasRenderingContext2D,
  style: SharedWhiteboardStyle,
  from: SharedWhiteboardPoint,
  to: SharedWhiteboardPoint,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const end = { x: from.x + dx, y: from.y + dy };
  ctx.beginPath();
  switch (style.tool as SharedShapeTool) {
    case 'line':
      ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke(); break;
    case 'arrow': {
      const a = Math.atan2(dy, dx), hl = Math.max(12, style.size * 4);
      ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a - Math.PI / 6), end.y - hl * Math.sin(a - Math.PI / 6));
      ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a + Math.PI / 6), end.y - hl * Math.sin(a + Math.PI / 6));
      ctx.stroke(); break;
    }
    case 'rectangle':
      if (style.doFill) ctx.fillRect(from.x, from.y, dx, dy);
      ctx.strokeRect(from.x, from.y, dx, dy); break;
    case 'circle': {
      const cx = from.x + dx / 2, cy = from.y + dy / 2;
      ctx.ellipse(cx, cy, Math.abs(dx / 2), Math.abs(dy / 2), 0, 0, Math.PI * 2);
      if (style.doFill) ctx.fill(); ctx.stroke(); break;
    }
    case 'triangle':
      ctx.moveTo(from.x + dx / 2, from.y); ctx.lineTo(end.x, end.y); ctx.lineTo(from.x, end.y);
      ctx.closePath(); if (style.doFill) ctx.fill(); ctx.stroke(); break;
    case 'diamond':
      diamondPath(ctx, from.x + dx / 2, from.y + dy / 2, Math.abs(dx), Math.abs(dy));
      if (style.doFill) ctx.fill(); ctx.stroke(); break;
    case 'star': {
      const r = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
      starPath(ctx, from.x + dx / 2, from.y + dy / 2, 5, r, r * 0.4);
      if (style.doFill) ctx.fill(); ctx.stroke(); break;
    }
  }
}

function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  style: SharedWhiteboardStyle,
  points: SharedWhiteboardPoint[],
  bgColor: string,
) {
  if (points.length === 0) return;
  applyStrokeStyle(ctx, style, bgColor);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.closePath();
  ctx.globalAlpha = 1;
}

/* ═══════════════════ toolbar button ═══════════════════ */

const Btn: React.FC<{
  active?: boolean; onClick: () => void; title: string;
  children: React.ReactNode; isDark: boolean; className?: string; disabled?: boolean;
}> = ({ active, onClick, title, children, isDark, className = '', disabled = false }) => (
  <button
    onClick={onClick} title={title} disabled={disabled}
    className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center border ${
      active 
        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
        : isDark 
          ? 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5 hover:border-white/5'
          : 'text-gray-600 border-transparent hover:text-black hover:bg-black/5 hover:border-black/5'
    } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
  >{children}</button>
);

const SectionLabel: React.FC<{ label: string; isDark: boolean; compact?: boolean }> = ({ label, isDark, compact = false }) => (
  <div className={`text-[8px] font-black uppercase tracking-[0.16em] px-1 ${compact ? 'pt-2 pb-1' : 'pt-4 pb-1'} select-none ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
    {label}
  </div>
);

const SZ = 16;

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export const DrawingCanvas: React.FC<{
  onClose: () => void;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  canEdit?: boolean;
  initialSnapshot?: string | null;
  snapshotVersion?: number;
  snapshotUpdatedBy?: string;
  localUserId?: string;
  onSnapshotChange?: (snapshot: string) => void;
  onCursorMove?: (x: number, y: number) => void;
  remoteCursors?: RemoteCursor[];
  whiteboardOps?: SharedWhiteboardOp[];
  onAppendWhiteboardOp?: (op: SharedWhiteboardOp) => void | Promise<void>;
  onReplaceWhiteboardOps?: (ops: SharedWhiteboardOp[]) => void | Promise<void>;
  showSplitSuggestion?: boolean;
  desktopCompactBreakpoint?: number;
  mobileCompactBreakpoint?: number;
}> = ({
  onClose,
  isFullscreen,
  onFullscreen,
  canEdit = true,
  initialSnapshot,
  snapshotVersion,
  snapshotUpdatedBy,
  localUserId,
  onSnapshotChange,
  onCursorMove,
  remoteCursors = [],
  whiteboardOps = [],
  onAppendWhiteboardOp,
  onReplaceWhiteboardOps,
  showSplitSuggestion = false,
  desktopCompactBreakpoint = WHITEBOARD_COMPACT_BREAKPOINTS.default.desktop,
  mobileCompactBreakpoint = WHITEBOARD_COMPACT_BREAKPOINTS.default.mobile,
}) => {
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const bgColor = isDark ? '#1e1e1e' : '#ffffff';

  /* ─── refs ─── */
  const canvasRef = useRef<HTMLCanvasElement>(null);     // large off-screen drawing surface
  const viewRef = useRef<HTMLCanvasElement>(null);       // visible viewport (sized to wrapper)
  const overlayRef = useRef<HTMLCanvasElement>(null);    // shape preview overlay
  const wrapRef = useRef<HTMLDivElement>(null);

  /* ─── state ─── */
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(isDark ? '#ffffff' : '#000000');
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [size, setSize] = useState(3);
  const [opacity, setOpacity] = useState(100);
  const [doFill, setDoFill] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [assistLevel, setAssistLevel] = useState<AssistLevel>('off');

  const [drawing, setDrawing] = useState(false);
  const [panning, setPanning] = useState(false);
  const [isCompactUI, setIsCompactUI] = useState(false);
  const [showCompactControls, setShowCompactControls] = useState(false);
  const [showTopStylePanel, setShowTopStylePanel] = useState(false);
  const [showCompactMixer, setShowCompactMixer] = useState(false);
  const [paletteTarget, setPaletteTarget] = useState<'stroke' | 'fill'>('stroke');
  const [paletteHue, setPaletteHue] = useState(220);
  const [paletteSat, setPaletteSat] = useState(100);
  const [paletteLight, setPaletteLight] = useState(50);
  const paletteRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [textVal, setTextVal] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const textObjectsRef = useRef<TextObject[]>([]);
  const movingTextIdRef = useRef<string | null>(null);
  const textMoveOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const [draggingTextDraft, setDraggingTextDraft] = useState(false);
  const textDragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const [fullscreenToolSection, setFullscreenToolSection] = useState<'draw' | 'shape' | 'dev' | 'extra'>('draw');

  /* stamp label prompt */
  const [stampPrompt, setStampPrompt] = useState<{ tool: Tool; pos: Point } | null>(null);
  const [stampLabel, setStampLabel] = useState('');

  /* pan & zoom */
  const panRef = useRef<Point>({ ..._savedPan });
  const [pan, setPan] = useState<Point>({ ..._savedPan });
  const zoomRef = useRef(_savedZoom);
  const [zoom, setZoom] = useState(_savedZoom);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panStartPanRef = useRef<Point>({ x: 0, y: 0 });
  const ctrlHeld = useRef(false);

  const undos = useRef<ImageData[]>([..._savedUndos]);
  const redos = useRef<ImageData[]>([..._savedRedos]);
  const initDone = useRef(false);
  const lastMouseRef = useRef<Point>({ x: 0, y: 0 });
  const assistPrevPointRef = useRef<Point | null>(null);
  const assistSmoothPointRef = useRef<Point | null>(null);
  const snapshotDebounceRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const lastSnapshotSentRef = useRef('');
  const lastAppliedSnapshotVersionRef = useRef<number>(0);
  const lastLocalDrawAtRef = useRef<number>(0);
  const appliedWhiteboardOpIdsRef = useRef<Set<string>>(new Set());
  const strokePointsRef = useRef<Point[]>([]);
  const checkpointInFlightRef = useRef(false);
  const lastRemoteOpAtRef = useRef<Record<string, number>>({});
  const [historyState, dispatchHistory] = useReducer(whiteboardHistoryReducer, initialWhiteboardHistoryState);
  const [pendingLocalOps, setPendingLocalOps] = useState<SharedWhiteboardOp[]>([]);

  const isStamp = (tool as string).startsWith('stamp-');
  const isFree = ['pencil', 'pen', 'marker', 'eraser'].includes(tool);
  const isAssistableFree = ['pencil', 'pen', 'marker'].includes(tool) && assistLevel !== 'off';
  const isShp = ['line', 'rectangle', 'circle', 'triangle', 'diamond', 'star', 'arrow'].includes(tool);

  const assistCfg: Record<AssistLevel, { alpha: number; jump: number }> = {
    off: { alpha: 1, jump: 48 },
    low: { alpha: 0.7, jump: 52 },
    medium: { alpha: 0.5, jump: 48 },
    high: { alpha: 0.3, jump: 44 },
  };
  const assistOptions: AssistLevel[] = ['off', 'low', 'medium', 'high'];
  const assistLabel = assistLevel === 'off' ? 'Off' : assistLevel[0].toUpperCase() + assistLevel.slice(1);
  const makeOpId = useCallback(
    () => `${localUserId || 'local'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    [localUserId],
  );
  const getCurrentStyle = useCallback(
    (nextTool?: SharedWhiteboardStyle['tool']): SharedWhiteboardStyle => ({
      tool: nextTool || (tool as SharedWhiteboardStyle['tool']),
      color,
      fillColor,
      size,
      opacity,
      doFill,
    }),
    [tool, color, fillColor, size, opacity, doFill],
  );
  const cycleAssistLevel = () =>
    setAssistLevel((prev) => (prev === 'off' ? 'low' : prev === 'low' ? 'medium' : prev === 'medium' ? 'high' : 'off'));

  useEffect(() => {
    textObjectsRef.current = textObjects;
  }, [textObjects]);

  /* ─── convert screen coords to canvas coords ─── */
  const toCanvas = useCallback((screenX: number, screenY: number): Point => {
    const rect = viewRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left) / zoomRef.current - panRef.current.x,
      y: (screenY - rect.top) / zoomRef.current - panRef.current.y,
    };
  }, []);

  /* ─── render viewport from big canvas ─── */
  const renderView = useCallback(() => {
    const view = viewRef.current;
    const src = canvasRef.current;
    if (!view || !src) return;
    const vctx = view.getContext('2d')!;
    vctx.clearRect(0, 0, view.width, view.height);

    // background
    vctx.fillStyle = bgColor;
    vctx.fillRect(0, 0, view.width, view.height);

    const z = zoomRef.current;
    const panX = panRef.current.x;
    const panY = panRef.current.y;
    const srcX = -panX;
    const srcY = -panY;
    const srcW = view.width / z;
    const srcH = view.height / z;
    const drawSrcX = Math.max(0, srcX);
    const drawSrcY = Math.max(0, srcY);
    const drawSrcR = Math.min(src.width, srcX + srcW);
    const drawSrcB = Math.min(src.height, srcY + srcH);
    const drawSrcW = drawSrcR - drawSrcX;
    const drawSrcH = drawSrcB - drawSrcY;

    if (drawSrcW > 0 && drawSrcH > 0) {
      const dstX = (drawSrcX - srcX) * z;
      const dstY = (drawSrcY - srcY) * z;
      const dstW = drawSrcW * z;
      const dstH = drawSrcH * z;
      vctx.drawImage(src, drawSrcX, drawSrcY, drawSrcW, drawSrcH, dstX, dstY, dstW, dstH);
    }

    vctx.save();
    vctx.scale(z, z);
    vctx.translate(panX, panY);
    textObjectsRef.current.forEach((t) => drawTextObject(vctx, t));
    vctx.restore();

    // grid
    if (showGrid) {
      const gap = 20 * zoomRef.current;
      const offX = (panRef.current.x * zoomRef.current) % gap;
      const offY = (panRef.current.y * zoomRef.current) % gap;
      vctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      vctx.lineWidth = 1;
      for (let x = offX; x < view.width; x += gap) {
        vctx.beginPath(); vctx.moveTo(x, 0); vctx.lineTo(x, view.height); vctx.stroke();
      }
      for (let y = offY; y < view.height; y += gap) {
        vctx.beginPath(); vctx.moveTo(0, y); vctx.lineTo(view.width, y); vctx.stroke();
      }
    }

    remoteCursors.forEach((cursor) => {
      if (cursor.cursorX === undefined || cursor.cursorY === undefined) return;
      const sx = (cursor.cursorX + panRef.current.x) * zoomRef.current;
      const sy = (cursor.cursorY + panRef.current.y) * zoomRef.current;
      if (sx < -40 || sy < -40 || sx > view.width + 40 || sy > view.height + 40) return;
      vctx.save();
      vctx.fillStyle = cursor.color || '#60a5fa';
      vctx.beginPath();
      vctx.moveTo(sx, sy);
      vctx.lineTo(sx + 9, sy + 18);
      vctx.lineTo(sx + 3, sy + 16);
      vctx.lineTo(sx, sy + 24);
      vctx.closePath();
      vctx.fill();
      if (cursor.isDrawing) {
        vctx.strokeStyle = cursor.color || '#60a5fa';
        vctx.lineWidth = 2;
        vctx.beginPath();
        vctx.arc(sx + 2, sy + 4, 10, 0, Math.PI * 2);
        vctx.stroke();
      }
      const suffix = cursor.isDrawing ? ' (drawing)' : cursor.isSharing ? ' (sharing)' : '';
      const label = `${cursor.username}${suffix}`;
      vctx.font = '11px sans-serif';
      const tw = vctx.measureText(label).width;
      vctx.fillStyle = cursor.isDrawing ? 'rgba(37,99,235,0.85)' : 'rgba(0,0,0,0.65)';
      vctx.fillRect(sx + 12, sy + 4, tw + 8, 16);
      vctx.fillStyle = '#fff';
      vctx.fillText(label, sx + 16, sy + 16);
      vctx.restore();
    });
  }, [bgColor, isDark, showGrid, remoteCursors]);

  const scheduleRenderView = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderView();
    });
  }, [renderView]);

  useEffect(() => {
    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    renderView();
  }, [textObjects, renderView]);

  /* ─── init big canvas + restore state ─── */
  useEffect(() => {
    const c = canvasRef.current!;
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    const ctx = c.getContext('2d')!;

    if (_savedImageData) {
      ctx.putImageData(_savedImageData, 0, 0);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      undos.current = [snap];
      redos.current = [];
    }
    initDone.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialSnapshot || !snapshotVersion) return;
    if (snapshotVersion === lastAppliedSnapshotVersionRef.current) return;
    if (drawing) return;
    if (localUserId && snapshotUpdatedBy && snapshotUpdatedBy === localUserId) {
      lastAppliedSnapshotVersionRef.current = snapshotVersion;
      return;
    }
    if (initialSnapshot === lastSnapshotSentRef.current) {
      lastAppliedSnapshotVersionRef.current = snapshotVersion;
      return;
    }
    if (Date.now() - lastLocalDrawAtRef.current < 700) return;

    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const snapshot = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [snapshot];
      redos.current = [];
      lastAppliedSnapshotVersionRef.current = snapshotVersion;
      renderView();
    };
    img.src = initialSnapshot;
  }, [initialSnapshot, snapshotVersion, snapshotUpdatedBy, localUserId, drawing, bgColor, renderView]);

  /* ─── fit viewport on mount/resize ─── */
  useEffect(() => {
    const wrap = wrapRef.current;
    const view = viewRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !view || !overlay) return;

    const fit = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      const isMobileViewport =
        typeof window !== 'undefined' &&
        (window.innerWidth <= 900 || window.matchMedia('(pointer: coarse)').matches);
      const compact = w < (isMobileViewport ? mobileCompactBreakpoint : desktopCompactBreakpoint);
      setIsCompactUI(compact);
      if (!compact) {
        setShowCompactControls(false);
      }
      view.width = w; view.height = h;
      overlay.width = w; overlay.height = h;
      renderView();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderView, desktopCompactBreakpoint, mobileCompactBreakpoint]);

  /* re-render on pan/zoom/grid changes */
  useEffect(() => { renderView(); }, [pan, zoom, showGrid, renderView]);

  const buildBaseSnapshot = useCallback(() => {
    const base = canvasRef.current;
    if (!base) return null;
    return base.toDataURL('image/png');
  }, []);

  const buildMergedSnapshot = useCallback(() => {
    const base = canvasRef.current;
    if (!base) return null;
    const temp = document.createElement('canvas');
    temp.width = base.width;
    temp.height = base.height;
    const tctx = temp.getContext('2d');
    if (!tctx) return null;
    tctx.drawImage(base, 0, 0);
    textObjectsRef.current.forEach((t) => drawTextObject(tctx, t));
    return temp.toDataURL('image/png');
  }, []);

  const sharedOpsEnabled = Boolean(onAppendWhiteboardOp && onReplaceWhiteboardOps);
  const effectiveWhiteboardOps = useMemo(() => {
    if (!sharedOpsEnabled) return whiteboardOps;
    const acknowledgedIds = new Set(whiteboardOps.map((op) => op.opId));
    const merged = [
      ...whiteboardOps,
      ...pendingLocalOps.filter((op) => !acknowledgedIds.has(op.opId)),
    ];
    return [...merged].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [pendingLocalOps, sharedOpsEnabled, whiteboardOps]);

  const emitSnapshotChange = useCallback(() => {
    if (!onSnapshotChange) return;
    if (snapshotDebounceRef.current) window.clearTimeout(snapshotDebounceRef.current);
    snapshotDebounceRef.current = window.setTimeout(() => {
      const snapshot = buildBaseSnapshot();
      if (!snapshot || snapshot === lastSnapshotSentRef.current) return;
      lastSnapshotSentRef.current = snapshot;
      onSnapshotChange(snapshot);
    }, 300);
  }, [onSnapshotChange, buildBaseSnapshot]);

  const countRasterOps = useCallback(
    (ops: SharedWhiteboardOp[]) => ops.filter(isRasterWhiteboardOp).length,
    [],
  );

  const requestCheckpoint = useCallback(async (ops: SharedWhiteboardOp[]) => {
    if (!sharedOpsEnabled || !onSnapshotChange || checkpointInFlightRef.current) return;
    if (countRasterOps(ops) < 8) return;
    const snapshot = buildBaseSnapshot();
    if (!snapshot) return;
    checkpointInFlightRef.current = true;
    lastSnapshotSentRef.current = snapshot;
    try {
      await Promise.resolve(onSnapshotChange(snapshot));
      dispatchHistory({ type: 'checkpoint_retain_text' });
    } finally {
      window.setTimeout(() => {
        checkpointInFlightRef.current = false;
      }, 400);
    }
  }, [buildBaseSnapshot, countRasterOps, onSnapshotChange, sharedOpsEnabled]);

  const appendWhiteboardOp = useCallback((op: SharedWhiteboardOp) => {
    if (!sharedOpsEnabled) return;
    appliedWhiteboardOpIdsRef.current.add(op.opId);
    setPendingLocalOps((prev) => (prev.some((item) => item.opId === op.opId) ? prev : [...prev, op]));
    const nextHistory = [...historyState.history, op];
    dispatchHistory({ type: 'append', op });
    void requestCheckpoint(nextHistory);
    void onAppendWhiteboardOp?.(op);
  }, [historyState.history, onAppendWhiteboardOp, requestCheckpoint, sharedOpsEnabled]);

  const applyWhiteboardOp = useCallback((op: SharedWhiteboardOp) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;

    if (op.kind === 'clear') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, c.width, c.height);
      setTextObjects([]);
      const baseline = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [baseline];
      redos.current = [];
      renderView();
      return;
    }

    if (op.kind === 'text_upsert') {
      setTextObjects((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === op.textObject.id);
        if (existingIndex === -1) return [...prev, op.textObject];
        const next = [...prev];
        next[existingIndex] = op.textObject;
        return next;
      });
      renderView();
      return;
    }

    if (op.kind === 'stroke') {
      drawStrokePath(ctx, op.style, op.points, bgColor);
      const snapshot = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [snapshot];
      redos.current = [];
      renderView();
      return;
    }

    if (op.kind === 'shape') {
      applyStrokeStyle(ctx, op.style, bgColor);
      drawShapeWithStyle(ctx, op.style, op.from, op.to);
      const snapshot = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [snapshot];
      redos.current = [];
      renderView();
      return;
    }

    if (op.kind === 'stamp') {
      drawStamp(ctx, op.stamp.tool as SharedStampTool, op.stamp.x, op.stamp.y, op.stamp.color, isDark, op.stamp.label);
      const snapshot = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [snapshot];
      redos.current = [];
      renderView();
    }
  }, [bgColor, isDark, renderView]);

  const rebuildFromSnapshotAndOps = useCallback(async (ops: SharedWhiteboardOp[]) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;

    const applyOps = () => {
      setTextObjects([]);
      appliedWhiteboardOpIdsRef.current = new Set();
      ops.forEach((op) => {
        appliedWhiteboardOpIdsRef.current.add(op.opId);
        applyWhiteboardOp(op);
      });
      dispatchHistory({ type: 'sync', ops });
      const baseline = ctx.getImageData(0, 0, c.width, c.height);
      undos.current = [baseline];
      redos.current = [];
      renderView();
    };

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);

    if (!initialSnapshot) {
      applyOps();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);
      applyOps();
    };
    img.src = initialSnapshot;
  }, [applyWhiteboardOp, bgColor, initialSnapshot, renderView]);

  useEffect(() => {
    if (!sharedOpsEnabled) {
      if (pendingLocalOps.length > 0) setPendingLocalOps([]);
      return;
    }
    const acknowledgedIds = new Set(whiteboardOps.map((op) => op.opId));
    setPendingLocalOps((prev) => {
      const next = prev.filter((op) => !acknowledgedIds.has(op.opId));
      return next.length === prev.length ? prev : next;
    });
  }, [pendingLocalOps.length, sharedOpsEnabled, whiteboardOps]);

  useEffect(() => {
    const nextIds = effectiveWhiteboardOps.map((op) => op.opId);
    const appliedIds = Array.from(appliedWhiteboardOpIdsRef.current);

    const needsFullRebuild =
      nextIds.length < appliedIds.length ||
      appliedIds.some((id) => !nextIds.includes(id));

    if (needsFullRebuild) {
      void rebuildFromSnapshotAndOps(effectiveWhiteboardOps);
      return;
    }

    effectiveWhiteboardOps.forEach((op) => {
      if (appliedWhiteboardOpIdsRef.current.has(op.opId)) return;
      appliedWhiteboardOpIdsRef.current.add(op.opId);
      if (op.createdBy && localUserId && op.createdBy !== localUserId) {
        lastRemoteOpAtRef.current[op.createdBy] = op.createdAt || Date.now();
      }
      applyWhiteboardOp(op);
    });
    dispatchHistory({ type: 'sync', ops: effectiveWhiteboardOps });
  }, [applyWhiteboardOp, effectiveWhiteboardOps, localUserId, rebuildFromSnapshotAndOps]);

  /* ─── save state on unmount ─── */
  useEffect(() => {
    return () => {
      const c = canvasRef.current;
      if (c && c.width > 0 && c.height > 0) {
        _savedImageData = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
        _savedUndos = [...undos.current];
        _savedRedos = [...redos.current];
        _savedPan = { ...panRef.current };
        _savedZoom = zoomRef.current;
      }
    };
  }, []);

  /* ─── history ─── */
  const snap = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    undos.current.push(c.getContext('2d')!.getImageData(0, 0, c.width, c.height));
    if (undos.current.length > 50) undos.current.shift();
    redos.current = [];
    lastLocalDrawAtRef.current = Date.now();
    renderView();
    if (!sharedOpsEnabled) {
      emitSnapshotChange();
    }
  }, [emitSnapshotChange, renderView, sharedOpsEnabled]);

  const undo = useCallback(() => {
    if (sharedOpsEnabled && onReplaceWhiteboardOps && localUserId) {
      const targetIndex = [...historyState.history]
        .map((op, index) => ({ op, index }))
        .reverse()
        .find(({ op }) => op.createdBy === localUserId)?.index;
      if (targetIndex === undefined) return;
      const nextHistory = historyState.history.filter((_, index) => index !== targetIndex);
      dispatchHistory({ type: 'undo_user', userId: localUserId });
      void Promise.resolve(onReplaceWhiteboardOps(nextHistory)).then(() => rebuildFromSnapshotAndOps(nextHistory));
      return;
    }

    const c = canvasRef.current;
    if (!c || undos.current.length <= 1) return;
    redos.current.push(undos.current.pop()!);
    c.getContext('2d')!.putImageData(undos.current[undos.current.length - 1], 0, 0);
    renderView();
  }, [historyState.history, localUserId, onReplaceWhiteboardOps, rebuildFromSnapshotAndOps, renderView, sharedOpsEnabled]);

  const redo = useCallback(() => {
    if (sharedOpsEnabled && onReplaceWhiteboardOps) {
      const nextOp = historyState.redo[0];
      if (!nextOp) return;
      const nextHistory = [...historyState.history, nextOp];
      dispatchHistory({ type: 'redo' });
      void Promise.resolve(onReplaceWhiteboardOps(nextHistory)).then(() => rebuildFromSnapshotAndOps(nextHistory));
      return;
    }

    const c = canvasRef.current;
    if (!c || redos.current.length === 0) return;
    const e = redos.current.pop()!;
    undos.current.push(e);
    c.getContext('2d')!.putImageData(e, 0, 0);
    renderView();
  }, [historyState.history, historyState.redo, onReplaceWhiteboardOps, rebuildFromSnapshotAndOps, renderView, sharedOpsEnabled]);

  /* ─── keyboard ─── */
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Control') ctrlHeld.current = true;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (mod && key === '0') {
        e.preventDefault();
        const view = viewRef.current;
        if (view) {
          zoomRef.current = 1;
          const newPan = { x: -CANVAS_W / 2 + view.width / 2, y: -CANVAS_H / 2 + view.height / 2 };
          panRef.current = newPan;
          setZoom(1);
          setPan(newPan);
        }
      }
      if (mod && key === 'f' && onFullscreen) { e.preventDefault(); onFullscreen(); }
      if (e.key === ' ') { e.preventDefault(); setTool(prev => prev === 'hand' ? 'pencil' : 'hand'); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') ctrlHeld.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [undo, redo, onFullscreen]);

  /* ─── zoom helper ─── */
  const doZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;

    const oldZ = zoomRef.current;
    const newZ = Math.max(0.1, Math.min(5, oldZ + delta));

    // keep the cursor/center anchored while zooming
    const newPanX = panRef.current.x + (cx / newZ - cx / oldZ);
    const newPanY = panRef.current.y + (cy / newZ - cy / oldZ);

    zoomRef.current = newZ;
    panRef.current = { x: newPanX, y: newPanY };
    setZoom(newZ);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  const rebaseWorkspaceIfNeeded = useCallback((point: Point): { point: Point; shifted: boolean } => {
    const c = canvasRef.current;
    if (!c) return { point, shifted: false };

    let shiftX = 0;
    let shiftY = 0;

    if (point.x < EDGE_REBASE_MARGIN) shiftX = Math.round(EDGE_REBASE_MARGIN - point.x);
    else if (point.x > c.width - EDGE_REBASE_MARGIN) shiftX = Math.round((c.width - EDGE_REBASE_MARGIN) - point.x);

    if (point.y < EDGE_REBASE_MARGIN) shiftY = Math.round(EDGE_REBASE_MARGIN - point.y);
    else if (point.y > c.height - EDGE_REBASE_MARGIN) shiftY = Math.round((c.height - EDGE_REBASE_MARGIN) - point.y);

    if (!shiftX && !shiftY) return { point, shifted: false };

    const temp = document.createElement('canvas');
    temp.width = c.width;
    temp.height = c.height;
    const tctx = temp.getContext('2d');
    const ctx = c.getContext('2d');
    if (!tctx || !ctx) return { point, shifted: false };

    tctx.drawImage(c, 0, 0);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(temp, shiftX, shiftY);

    const nextPan = { x: panRef.current.x - shiftX, y: panRef.current.y - shiftY };
    panRef.current = nextPan;
    setPan(nextPan);
    setOrigin((prev) => (prev ? { x: prev.x + shiftX, y: prev.y + shiftY } : prev));
    setTextPos((prev) => (prev ? { x: prev.x + shiftX, y: prev.y + shiftY } : prev));
    setStampPrompt((prev) => (prev ? { ...prev, pos: { x: prev.pos.x + shiftX, y: prev.pos.y + shiftY } } : prev));
    lastMouseRef.current = { x: lastMouseRef.current.x + shiftX, y: lastMouseRef.current.y + shiftY };
    renderView();

    return { point: { x: point.x + shiftX, y: point.y + shiftY }, shifted: true };
  }, [bgColor, renderView]);

  const resetView = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    zoomRef.current = 1;
    const newPan = { x: -CANVAS_W / 2 + view.width / 2, y: -CANVAS_H / 2 + view.height / 2 };
    panRef.current = newPan;
    setZoom(1);
    setPan(newPan);
  }, []);

  /* ─── wheel ─── */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // zoom
        const delta = e.deltaY > 0 ? -0.07 : 0.07;
        const rect = view.getBoundingClientRect();
        doZoom(delta, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        // pan
        panRef.current = {
          x: panRef.current.x - e.deltaX / zoomRef.current,
          y: panRef.current.y - e.deltaY / zoomRef.current,
        };
        setPan({ ...panRef.current });
      }
    };
    view.addEventListener('wheel', handler, { passive: false });
    return () => view.removeEventListener('wheel', handler);
  }, [doZoom]);

  /* ─── setup drawing ctx ─── */
  const setupCtx = useCallback((ctx: CanvasRenderingContext2D) => {
    applyStrokeStyle(ctx, {
      tool: tool as SharedWhiteboardStyle['tool'],
      color,
      fillColor,
      size,
      opacity,
      doFill,
    }, bgColor);
  }, [tool, color, fillColor, size, opacity, doFill, bgColor]);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    let dx = to.x - from.x;
    let dy = to.y - from.y;

    if (assistLevel !== 'off') {
      if (tool === 'line' || tool === 'arrow') {
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);
        const step = Math.PI / 12; // 15deg snapping
        const snapped = Math.round(angle / step) * step;
        dx = Math.cos(snapped) * len;
        dy = Math.sin(snapped) * len;
      } else if (tool === 'rectangle' || tool === 'circle' || tool === 'triangle' || tool === 'diamond' || tool === 'star') {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * m;
        dy = Math.sign(dy || 1) * m;
      }
    }

    const end = { x: from.x + dx, y: from.y + dy };
    ctx.beginPath();
    switch (tool) {
      case 'line':
        ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke(); break;
      case 'arrow': {
        const a = Math.atan2(dy, dx), hl = Math.max(12, size * 4);
        ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a - Math.PI / 6), end.y - hl * Math.sin(a - Math.PI / 6));
        ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a + Math.PI / 6), end.y - hl * Math.sin(a + Math.PI / 6));
        ctx.stroke(); break;
      }
      case 'rectangle':
        if (doFill) ctx.fillRect(from.x, from.y, dx, dy);
        ctx.strokeRect(from.x, from.y, dx, dy); break;
      case 'circle': {
        const cx = from.x + dx / 2, cy = from.y + dy / 2;
        ctx.ellipse(cx, cy, Math.abs(dx / 2), Math.abs(dy / 2), 0, 0, Math.PI * 2);
        if (doFill) ctx.fill(); ctx.stroke(); break;
      }
      case 'triangle':
        ctx.moveTo(from.x + dx / 2, from.y); ctx.lineTo(end.x, end.y); ctx.lineTo(from.x, end.y);
        ctx.closePath(); if (doFill) ctx.fill(); ctx.stroke(); break;
      case 'diamond':
        diamondPath(ctx, from.x + dx / 2, from.y + dy / 2, Math.abs(dx), Math.abs(dy));
        if (doFill) ctx.fill(); ctx.stroke(); break;
      case 'star': {
        const r = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
        starPath(ctx, from.x + dx / 2, from.y + dy / 2, 5, r, r * 0.4);
        if (doFill) ctx.fill(); ctx.stroke(); break;
      }
    }
  }, [tool, size, doFill, assistLevel]);

  /* ─── flood fill ─── */
  const floodFill = useCallback((sx: number, sy: number, hex: string) => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const ix = Math.round(sx), iy = Math.round(sy);
    if (ix < 0 || ix >= c.width || iy < 0 || iy >= c.height) return;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const w = c.width, h = c.height;
    const idx = (px: number, py: number) => (py * w + px) * 4;
    const ti = idx(ix, iy);
    const t = [d[ti], d[ti + 1], d[ti + 2], d[ti + 3]];
    const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
    if (t[0] === cr && t[1] === cg && t[2] === cb && t[3] === 255) return;
    const match = (i: number) =>
      Math.abs(d[i] - t[0]) < 25 && Math.abs(d[i + 1] - t[1]) < 25 &&
      Math.abs(d[i + 2] - t[2]) < 25 && Math.abs(d[i + 3] - t[3]) < 25;
    const stk: [number, number][] = [[ix, iy]];
    const vis = new Uint8Array(w * h);
    while (stk.length) {
      const [px, py] = stk.pop()!;
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      const pi = py * w + px;
      if (vis[pi]) continue;
      const ci = pi * 4;
      if (!match(ci)) continue;
      vis[pi] = 1;
      d[ci] = cr; d[ci + 1] = cg; d[ci + 2] = cb; d[ci + 3] = 255;
      stk.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const findTopTextAt = useCallback((p: Point): TextObject | null => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return null;
    const padX = 8;
    const padTop = 18;
    const padBottom = 8;
    for (let i = textObjectsRef.current.length - 1; i >= 0; i -= 1) {
      const t = textObjectsRef.current[i];
      ctx.font = `${t.size * 4 + 14}px sans-serif`;
      const width = ctx.measureText(t.text).width;
      const height = t.size * 4 + 14;
      const left = t.x - padX;
      const right = t.x + width + padX;
      const top = t.y - height - padTop;
      const bottom = t.y + padBottom;
      if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) return t;
    }
    return null;
  }, []);

  /* ─── mouse handlers ─── */
  const onDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    const screenP = { x: e.clientX, y: e.clientY };
    const rawPoint = toCanvas(e.clientX, e.clientY);

    // Ctrl+click or hand tool → pan
    if (tool === 'hand' || ctrlHeld.current) {
      setPanning(true);
      panStartRef.current = screenP;
      panStartPanRef.current = { ...panRef.current };
      return;
    }
    const p = rebaseWorkspaceIfNeeded(rawPoint).point;

    if (tool === 'eyedropper') {
      const c = canvasRef.current!;
      const ix = Math.round(p.x), iy = Math.round(p.y);
      if (ix >= 0 && ix < c.width && iy >= 0 && iy < c.height) {
        const px = c.getContext('2d')!.getImageData(ix, iy, 1, 1).data;
        setColor('#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
      }
      setTool('pencil');
      return;
    }
    if (tool === 'fill') {
      floodFill(p.x, p.y, fillColor);
      snap();
      return;
    }
    if (tool === 'text') {
      if (textPos && textVal.trim()) commitText();
      setTextPos(p);
      setTextVal('');
      return;
    }
    if (tool === 'select') {
      const hit = findTopTextAt(p);
      if (hit) {
        movingTextIdRef.current = hit.id;
        textMoveOffsetRef.current = { x: p.x - hit.x, y: p.y - hit.y };
      }
      return;
    }

    if (isStamp) {
      // show label prompt
      setStampPrompt({ tool, pos: p });
      setStampLabel('');
      return;
    }

    setDrawing(true);
    setOrigin(p);
    lastMouseRef.current = p;
    strokePointsRef.current = [p];

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      setupCtx(ctx);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      assistPrevPointRef.current = p;
      assistSmoothPointRef.current = p;
      renderView();
    }
  };

  const onMove = (e: React.MouseEvent) => {
    const screenP = { x: e.clientX, y: e.clientY };
    let rebased = { point: toCanvas(e.clientX, e.clientY), shifted: false };
    if (drawing && canEdit && isFree) rebased = rebaseWorkspaceIfNeeded(rebased.point);
    const p = rebased.point;
    const prevMouse = lastMouseRef.current;
    if (onCursorMove) onCursorMove(p.x, p.y);

    if (panning) {
      const dx = (screenP.x - panStartRef.current.x) / zoomRef.current;
      const dy = (screenP.y - panStartRef.current.y) / zoomRef.current;
      panRef.current = { x: panStartPanRef.current.x + dx, y: panStartPanRef.current.y + dy };
      setPan({ ...panRef.current });
      lastMouseRef.current = p;
      return;
    }

    if (!drawing || !canEdit) {
      if (movingTextIdRef.current) {
        const id = movingTextIdRef.current;
        const nextX = p.x - textMoveOffsetRef.current.x;
        const nextY = p.y - textMoveOffsetRef.current.y;
        setTextObjects((prev) => prev.map((t) => (t.id === id ? { ...t, x: nextX, y: nextY } : t)));
      }
      lastMouseRef.current = p;
      return;
    }

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      if (rebased.shifted) {
        setupCtx(ctx);
        ctx.beginPath();
        ctx.moveTo(prevMouse.x, prevMouse.y);
        assistPrevPointRef.current = prevMouse;
        assistSmoothPointRef.current = prevMouse;
      }
      strokePointsRef.current.push(p);
      if (isAssistableFree) {
        const prevRaw = assistPrevPointRef.current ?? p;
        const smoothPrev = assistSmoothPointRef.current ?? prevRaw;
        const jump = Math.hypot(p.x - prevRaw.x, p.y - prevRaw.y);
        if (jump > assistCfg[assistLevel].jump) {
          // If events are sparse (fast movement), bridge with a direct segment first.
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          assistPrevPointRef.current = p;
          assistSmoothPointRef.current = p;
          scheduleRenderView();
          lastMouseRef.current = p;
          return;
        }
        const smoothNext = {
          x: smoothPrev.x + (p.x - smoothPrev.x) * assistCfg[assistLevel].alpha,
          y: smoothPrev.y + (p.y - smoothPrev.y) * assistCfg[assistLevel].alpha,
        };
        const mid = {
          x: (smoothPrev.x + smoothNext.x) / 2,
          y: (smoothPrev.y + smoothNext.y) / 2,
        };
        ctx.quadraticCurveTo(smoothPrev.x, smoothPrev.y, mid.x, mid.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        assistPrevPointRef.current = p;
        assistSmoothPointRef.current = smoothNext;
      } else {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      }
      scheduleRenderView();
    }

    if (isShp && origin) {
      const o = overlayRef.current!;
      const ctx = o.getContext('2d')!;
      ctx.clearRect(0, 0, o.width, o.height);
      ctx.save();
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(panRef.current.x, panRef.current.y);
      setupCtx(ctx);
      drawShape(ctx, origin, p);
      ctx.restore();
    }
    lastMouseRef.current = p;
  };

  const onUp = () => {
    if (panning) { setPanning(false); return; }
    if (movingTextIdRef.current) {
      const movedId = movingTextIdRef.current;
      movingTextIdRef.current = null;
      const movedText = textObjectsRef.current.find((item) => item.id === movedId);
      if (movedText) {
        appendWhiteboardOp({
          opId: makeOpId(),
          kind: 'text_upsert',
          textObject: movedText,
          createdBy: localUserId,
          createdAt: Date.now(),
        });
      }
      lastLocalDrawAtRef.current = Date.now();
      renderView();
      if (!sharedOpsEnabled) {
        emitSnapshotChange();
      }
      return;
    }
    if (!drawing) return;
    setDrawing(false);

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.closePath(); ctx.globalAlpha = 1;
      appendWhiteboardOp({
        opId: makeOpId(),
        kind: 'stroke',
        style: getCurrentStyle(tool as SharedFreeTool),
        points: strokePointsRef.current,
        createdBy: localUserId,
        createdAt: Date.now(),
      });
      strokePointsRef.current = [];
      assistPrevPointRef.current = null;
      assistSmoothPointRef.current = null;
      snap();
    }

    if (isShp && origin) {
      const ctx = canvasRef.current!.getContext('2d')!;
      setupCtx(ctx);
      drawShape(ctx, origin, lastMouseRef.current);

      const o = overlayRef.current!;
      o.getContext('2d')!.clearRect(0, 0, o.width, o.height);

      appendWhiteboardOp({
        opId: makeOpId(),
        kind: 'shape',
        style: getCurrentStyle(tool as SharedShapeTool),
        from: origin,
        to: lastMouseRef.current,
        createdBy: localUserId,
        createdAt: Date.now(),
      });

      setOrigin(null);
      snap();
    }
  };

  useEffect(() => {
    if (tool !== 'text' || !textPos) return;
    const raf = window.requestAnimationFrame(() => {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [tool, textPos]);

  useEffect(() => {
    if (!draggingTextDraft || !textPos) return;
    const onMoveDraft = (e: MouseEvent) => {
      const p = toCanvas(e.clientX, e.clientY);
      setTextPos({
        x: p.x - textDragOffsetRef.current.x,
        y: p.y - textDragOffsetRef.current.y,
      });
    };
    const onStopDraft = () => setDraggingTextDraft(false);
    window.addEventListener('mousemove', onMoveDraft);
    window.addEventListener('mouseup', onStopDraft);
    return () => {
      window.removeEventListener('mousemove', onMoveDraft);
      window.removeEventListener('mouseup', onStopDraft);
    };
  }, [draggingTextDraft, textPos, toCanvas]);

  /* ─── stamp prompt submit ─── */
  const commitStamp = () => {
    if (!stampPrompt) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const label = stampLabel.trim() || undefined;
    drawStamp(ctx, stampPrompt.tool, stampPrompt.pos.x, stampPrompt.pos.y, color, isDark, label);
    appendWhiteboardOp({
      opId: makeOpId(),
      kind: 'stamp',
      stamp: {
        tool: stampPrompt.tool as SharedStampTool,
        x: stampPrompt.pos.x,
        y: stampPrompt.pos.y,
        color,
        label,
      },
      createdBy: localUserId,
      createdAt: Date.now(),
    });
    snap();
    setStampPrompt(null);
    setStampLabel('');
  };

  const commitText = () => {
    if (!textPos || !textVal.trim()) { setTextPos(null); setTextVal(''); return; }
    const next: TextObject = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      text: textVal,
      x: textPos.x,
      y: textPos.y,
      color,
      size,
      opacity,
    };
    setTextObjects((prev) => [...prev, next]);
    appendWhiteboardOp({
      opId: makeOpId(),
      kind: 'text_upsert',
      textObject: next,
      createdBy: localUserId,
      createdAt: Date.now(),
    });
    lastLocalDrawAtRef.current = Date.now();
    renderView();
    if (!sharedOpsEnabled) {
      emitSnapshotChange();
    }
    setTextPos(null);
    setTextVal('');
  };

  const clearCanvas = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    setTextObjects([]);
    appendWhiteboardOp({
      opId: makeOpId(),
      kind: 'clear',
      createdBy: localUserId,
      createdAt: Date.now(),
    });
    snap();
  };

  const resetAll = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    const baseline = ctx.getImageData(0, 0, c.width, c.height);
    undos.current = [baseline];
    redos.current = [];

    setTool('pencil');
    setTextObjects([]);
    setTextPos(null);
    setTextVal('');
    setStampPrompt(null);
    setStampLabel('');

    const view = viewRef.current;
    if (view) {
      zoomRef.current = 1;
      const newPan = { x: -CANVAS_W / 2 + view.width / 2, y: -CANVAS_H / 2 + view.height / 2 };
      panRef.current = newPan;
      setZoom(1);
      setPan(newPan);
    }

    appendWhiteboardOp({
      opId: makeOpId(),
      kind: 'clear',
      createdBy: localUserId,
      createdAt: Date.now(),
    });

    lastLocalDrawAtRef.current = Date.now();
    renderView();
    if (onSnapshotChange && !sharedOpsEnabled) {
      const snapshot = c.toDataURL('image/png');
      lastSnapshotSentRef.current = snapshot;
      onSnapshotChange(snapshot);
    }
  };

  const downloadPng = () => {
    const a = document.createElement('a');
    a.download = 'drawing.png';
    a.href = buildMergedSnapshot() || canvasRef.current!.toDataURL('image/png');
    a.click();
  };

  const presets = [
    '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
    '#06b6d4', '#14b8a6', '#a855f7', '#f43f5e', '#84cc16',
  ];

  useEffect(() => {
    const source = paletteTarget === 'stroke' ? color : fillColor;
    const parsed = hexToHsl(source);
    setPaletteHue(parsed.h);
    setPaletteSat(parsed.s);
    setPaletteLight(parsed.l);
  }, [showCompactMixer, paletteTarget, color, fillColor]);

  const applyPaletteColor = useCallback((h: number, s: number, l: number) => {
    const next = hslToHex(h, s, l);
    if (paletteTarget === 'stroke') setColor(next);
    else setFillColor(next);
  }, [paletteTarget]);

  const updateColorFromPalettePoint = useCallback((clientX: number, clientY: number) => {
    const wheel = paletteRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
    const sat = (dist / radius) * 100;
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    setPaletteHue(hue);
    setPaletteSat(sat);
    applyPaletteColor(hue, sat, paletteLight);
  }, [applyPaletteColor, paletteLight]);

  const isPanning = panning || tool === 'hand' || ctrlHeld.current;
  const showExpandedTopBar = !isCompactUI;
  const cursor = (() => {
    if (!canEdit) return 'default';
    if (isPanning) return panning ? 'grabbing' : 'grab';
    if (tool === 'text') return 'text';
    if (tool === 'select') return 'default';
    if (tool === 'eraser') return 'cell';
    if (isStamp) return 'copy';
    return 'crosshair';
  })();

  /* ═══════════════════ RENDER ═══════════════════ */

  return (
    <div className={`flex h-full overflow-hidden relative ${
      isFullscreen
        ? (isDark ? 'bg-[#121417]' : 'bg-[#f2f3f5]')
        : (isDark ? 'bg-[#141417]/50 backdrop-blur-xl' : 'bg-[#f8f8f8]')
    }`}>

      {/* hidden full-size canvas (off-screen drawing surface) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── LEFT SIDEBAR ─── */}
      <div className={`${isFullscreen ? 'w-[194px]' : 'w-[60px]'} shrink-0 flex flex-col ${isFullscreen ? 'items-stretch' : 'items-center'} border-r overflow-y-auto py-3 gap-1 ${
        isFullscreen ? 'custom-scrollbar' : 'no-scrollbar'
      } ${
        isFullscreen
          ? (isDark ? 'bg-[#181c22] border-white/10' : 'bg-[#f8f9fb] border-[#d6dbe4]')
          : `backdrop-blur-2xl ${isDark ? 'bg-[#1a1a1e]/80 border-white/5' : 'bg-[#fcfcfc]/80 border-black/5'}`
      }`}>
        {isFullscreen ? (
          <>
            <div className="px-2">
              <Btn onClick={onClose} title="Close" isDark={isDark} className="text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"><XIcon size={SZ} /></Btn>
            </div>
            <div className={`mx-2 mt-1 rounded-xl border p-2 ${
              isDark
                ? 'border-white/10 bg-[#13161b]'
                : 'border-[#cfd6e0] bg-[#eef2f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
            }`}>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {(['draw', 'shape', 'dev', 'extra'] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setFullscreenToolSection(section)}
                    className={`h-7 rounded-md text-[9px] font-black uppercase tracking-wider border transition-colors ${
                      fullscreenToolSection === section
                        ? (isDark ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'bg-[#d9e9ff] text-[#1556b8] border-[#7eb0ff]')
                        : (isDark ? 'text-gray-400 border-white/10 hover:bg-white/5' : 'text-[#4b5563] border-[#c8d1dd] hover:bg-white')
                    }`}
                  >
                    {section === 'dev' ? 'Flow' : section}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1 [&>button]:h-9 [&>button]:w-full [&>button]:rounded-md [&>button]:border [&>button]:border-white/10">
                {fullscreenToolSection === 'draw' && (
                  <>
                    <Btn active={tool === 'select'} onClick={() => setTool('select')} title="Select" isDark={isDark}><MousePointer size={SZ} /></Btn>
                    <Btn active={tool === 'hand'} onClick={() => setTool('hand')} title="Hand (Space / Ctrl+drag)" isDark={isDark}><Hand size={SZ} /></Btn>
                    <Btn active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Pencil" isDark={isDark}><Pencil size={SZ} /></Btn>
                    <Btn active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen" isDark={isDark}><Pen size={SZ} /></Btn>
                    <Btn active={tool === 'marker'} onClick={() => setTool('marker')} title="Marker" isDark={isDark}><Highlighter size={SZ} /></Btn>
                    <Btn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser" isDark={isDark}><Eraser size={SZ} /></Btn>
                  </>
                )}
                {fullscreenToolSection === 'shape' && (
                  <>
                    <Btn active={tool === 'line'} onClick={() => setTool('line')} title="Line" isDark={isDark}><Minus size={SZ} /></Btn>
                    <Btn active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Arrow" isDark={isDark}><ArrowRight size={SZ} /></Btn>
                    <Btn active={tool === 'rectangle'} onClick={() => setTool('rectangle')} title="Rectangle" isDark={isDark}><Square size={SZ} /></Btn>
                    <Btn active={tool === 'circle'} onClick={() => setTool('circle')} title="Ellipse" isDark={isDark}><Circle size={SZ} /></Btn>
                    <Btn active={tool === 'triangle'} onClick={() => setTool('triangle')} title="Triangle" isDark={isDark}><Triangle size={SZ} /></Btn>
                    <Btn active={tool === 'diamond'} onClick={() => setTool('diamond')} title="Diamond" isDark={isDark}><Diamond size={SZ} /></Btn>
                    <Btn active={tool === 'star'} onClick={() => setTool('star')} title="Star" isDark={isDark}><Star size={SZ} /></Btn>
                  </>
                )}
                {fullscreenToolSection === 'dev' && (
                  <>
                    <Btn active={tool === 'stamp-flowbox'} onClick={() => setTool('stamp-flowbox')} title="Process Box" isDark={isDark}><Workflow size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-decision'} onClick={() => setTool('stamp-decision')} title="Decision Diamond" isDark={isDark}><GitBranch size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-process'} onClick={() => setTool('stamp-process')} title="Start / End" isDark={isDark}><Hexagon size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-database'} onClick={() => setTool('stamp-database')} title="Database" isDark={isDark}><Database size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-server'} onClick={() => setTool('stamp-server')} title="Server" isDark={isDark}><Server size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-cloud'} onClick={() => setTool('stamp-cloud')} title="Cloud" isDark={isDark}><Cloud size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-actor'} onClick={() => setTool('stamp-actor')} title="User / Actor" isDark={isDark}><Monitor size={SZ} /></Btn>
                    <Btn active={tool === 'stamp-note'} onClick={() => setTool('stamp-note')} title="Sticky Note" isDark={isDark}><StickyNote size={SZ} /></Btn>
                  </>
                )}
                {fullscreenToolSection === 'extra' && (
                  <>
                    <Btn active={tool === 'text'} onClick={() => setTool('text')} title="Text" isDark={isDark}><Type size={SZ} /></Btn>
                    <Btn active={tool === 'fill'} onClick={() => setTool('fill')} title="Fill Bucket" isDark={isDark}><PaintBucket size={SZ} /></Btn>
                    <Btn active={tool === 'eyedropper'} onClick={() => setTool('eyedropper')} title="Pick Color" isDark={isDark}><Pipette size={SZ} /></Btn>
                    <Btn active={assistLevel !== 'off'} onClick={cycleAssistLevel} title={`Stroke Assist (${assistLabel})`} isDark={isDark}><Palette size={SZ} /></Btn>
                    <Btn active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Toggle Grid" isDark={isDark}><Grid3X3 size={SZ} /></Btn>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Btn onClick={onClose} title="Close" isDark={isDark} className="mb-2 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"><XIcon size={SZ} /></Btn>
            {onFullscreen && (
              <Btn onClick={() => onFullscreen?.()} title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'} isDark={isDark} className="mb-2">
                {isFullscreen ? <Minimize2 size={SZ} /> : <Maximize size={SZ} />}
              </Btn>
            )}
            <SectionLabel label="Draw" isDark={isDark} />
            <Btn active={tool === 'select'} onClick={() => setTool('select')} title="Select" isDark={isDark}><MousePointer size={SZ} /></Btn>
            <Btn active={tool === 'hand'} onClick={() => setTool('hand')} title="Hand (Space / Ctrl+drag)" isDark={isDark}><Hand size={SZ} /></Btn>
            <Btn active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Pencil" isDark={isDark}><Pencil size={SZ} /></Btn>
            <Btn active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen" isDark={isDark}><Pen size={SZ} /></Btn>
            <Btn active={tool === 'marker'} onClick={() => setTool('marker')} title="Marker" isDark={isDark}><Highlighter size={SZ} /></Btn>
            <Btn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser" isDark={isDark}><Eraser size={SZ} /></Btn>
            <SectionLabel label="Shape" isDark={isDark} />
            <Btn active={tool === 'line'} onClick={() => setTool('line')} title="Line" isDark={isDark}><Minus size={SZ} /></Btn>
            <Btn active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Arrow" isDark={isDark}><ArrowRight size={SZ} /></Btn>
            <Btn active={tool === 'rectangle'} onClick={() => setTool('rectangle')} title="Rectangle" isDark={isDark}><Square size={SZ} /></Btn>
            <Btn active={tool === 'circle'} onClick={() => setTool('circle')} title="Ellipse" isDark={isDark}><Circle size={SZ} /></Btn>
            <Btn active={tool === 'triangle'} onClick={() => setTool('triangle')} title="Triangle" isDark={isDark}><Triangle size={SZ} /></Btn>
            <Btn active={tool === 'diamond'} onClick={() => setTool('diamond')} title="Diamond" isDark={isDark}><Diamond size={SZ} /></Btn>
            <Btn active={tool === 'star'} onClick={() => setTool('star')} title="Star" isDark={isDark}><Star size={SZ} /></Btn>
            <SectionLabel label="Dev" isDark={isDark} />
            <Btn active={tool === 'stamp-flowbox'} onClick={() => setTool('stamp-flowbox')} title="Process Box" isDark={isDark}><Workflow size={SZ} /></Btn>
            <Btn active={tool === 'stamp-decision'} onClick={() => setTool('stamp-decision')} title="Decision Diamond" isDark={isDark}><GitBranch size={SZ} /></Btn>
            <Btn active={tool === 'stamp-process'} onClick={() => setTool('stamp-process')} title="Start / End" isDark={isDark}><Hexagon size={SZ} /></Btn>
            <Btn active={tool === 'stamp-database'} onClick={() => setTool('stamp-database')} title="Database" isDark={isDark}><Database size={SZ} /></Btn>
            <Btn active={tool === 'stamp-server'} onClick={() => setTool('stamp-server')} title="Server" isDark={isDark}><Server size={SZ} /></Btn>
            <Btn active={tool === 'stamp-cloud'} onClick={() => setTool('stamp-cloud')} title="Cloud" isDark={isDark}><Cloud size={SZ} /></Btn>
            <Btn active={tool === 'stamp-actor'} onClick={() => setTool('stamp-actor')} title="User / Actor" isDark={isDark}><Monitor size={SZ} /></Btn>
            <Btn active={tool === 'stamp-note'} onClick={() => setTool('stamp-note')} title="Sticky Note" isDark={isDark}><StickyNote size={SZ} /></Btn>
            <SectionLabel label="Extra" isDark={isDark} />
            <Btn active={tool === 'text'} onClick={() => setTool('text')} title="Text" isDark={isDark}><Type size={SZ} /></Btn>
            <Btn active={tool === 'fill'} onClick={() => setTool('fill')} title="Fill Bucket" isDark={isDark}><PaintBucket size={SZ} /></Btn>
            <Btn active={tool === 'eyedropper'} onClick={() => setTool('eyedropper')} title="Pick Color" isDark={isDark}><Pipette size={SZ} /></Btn>
            <Btn active={assistLevel !== 'off'} onClick={cycleAssistLevel} title={`Stroke Assist (${assistLabel})`} isDark={isDark}><Palette size={SZ} /></Btn>
            <Btn active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Toggle Grid" isDark={isDark}><Grid3X3 size={SZ} /></Btn>
          </>
        )}
      </div>

      {/* ─── RIGHT SIDE ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* top controls */}
        <div className={`border-b shrink-0 ${
          isFullscreen
            ? (isDark ? 'bg-[#171a1f] border-white/10' : 'bg-[#f2f5fa] border-black/10')
            : `backdrop-blur-2xl ${isDark ? 'bg-[#1a1a1e]/80 border-white/5' : 'bg-[#fcfcfc]/80 border-black/5'}`
        }`}>
          {showExpandedTopBar ? (
            <div className="flex items-center gap-2 px-4 h-14">
              <label className="flex items-center gap-3 cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={doFill} onChange={() => setDoFill(!doFill)} className="sr-only" />
                  <div className={`w-8 h-4 rounded-full transition-colors ${doFill ? 'bg-blue-500' : 'bg-white/10'}`} />
                  <div className={`absolute left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${doFill ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-600'}`}>Fill</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Assist</span>
                <select
                  value={assistLevel}
                  onChange={(e) => setAssistLevel(e.target.value as AssistLevel)}
                  className={`h-7 rounded-md border px-2 text-[10px] font-black uppercase tracking-wider outline-none ${
                    isDark ? 'bg-[#11161e] border-white/10 text-gray-200' : 'bg-white border-black/10 text-gray-700'
                  }`}
                >
                  {assistOptions.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <div className="w-[1px] h-4 bg-white/10" />
              <Btn
                active={showTopStylePanel}
                onClick={() => {
                  setShowTopStylePanel(v => !v);
                  setShowCompactMixer(false);
                }}
                title="Style (Size / Opacity)"
                isDark={isDark}
                className="h-8 px-3 gap-1"
              >
                <SlidersHorizontal size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">Style</span>
              </Btn>
              <Btn
                active={showCompactMixer}
                onClick={() => {
                  setShowCompactMixer(v => !v);
                  setShowTopStylePanel(false);
                }}
                title="Color Palette"
                isDark={isDark}
                className="h-8 px-3 gap-1"
              >
                <Palette size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">Palette</span>
              </Btn>

              <div className="flex-1" />

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
                <Btn onClick={() => doZoom(-0.15)} title="Zoom Out" isDark={isDark} className="h-8 w-8"><ZoomOut size={14} /></Btn>
                <span className="text-[10px] font-black w-10 text-center text-gray-400 tabular-nums">{Math.round(zoom * 100)}%</span>
                <Btn onClick={() => doZoom(0.15)} title="Zoom In" isDark={isDark} className="h-8 w-8"><ZoomIn size={14} /></Btn>
                <Btn onClick={resetView} title="Reset View" isDark={isDark} className="h-8 w-8"><LocateFixed size={14} /></Btn>
                {onFullscreen && !isFullscreen && (
                  <Btn onClick={() => onFullscreen?.()} title={isFullscreen ? 'Exit Fullscreen (Ctrl+F)' : 'Fullscreen (Ctrl+F)'} isDark={isDark} className="h-8 w-8">
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize size={14} />}
                  </Btn>
                )}
              </div>

              <div className="w-[1px] h-4 mx-2 bg-white/10" />

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
                <Btn onClick={undo} title="Undo (Ctrl+Z)" isDark={isDark} className="h-8 w-8"><Undo2 size={14} /></Btn>
                <Btn onClick={redo} title="Redo (Ctrl+Y)" isDark={isDark} className="h-8 w-8"><Redo2 size={14} /></Btn>
                <Btn onClick={clearCanvas} title="Clear Canvas" isDark={isDark} className="h-8 w-8 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></Btn>
                <Btn onClick={resetAll} title="Reset All (board + view)" isDark={isDark} className="h-8 w-8 text-amber-400 hover:bg-amber-500/10"><RotateCcw size={14} /></Btn>
                <Btn onClick={downloadPng} title="Save as PNG" isDark={isDark} className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"><Download size={14} /></Btn>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2">
              <div className={`flex items-center py-0.5 ${
                isFullscreen
                  ? 'flex-wrap gap-1.5 overflow-visible'
                  : 'gap-1 overflow-x-auto no-scrollbar'
              }`}>
                <Btn active={showCompactControls} onClick={() => setShowCompactControls(v => !v)} title="Open controls" isDark={isDark} className="h-8 px-3 gap-1">
                  <SlidersHorizontal size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Controls</span>
                </Btn>
                <Btn active={showCompactMixer} onClick={() => setShowCompactMixer(v => !v)} title="Color palette" isDark={isDark} className="h-8 px-3 gap-1">
                  <Palette size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Palette</span>
                </Btn>
                <Btn active={assistLevel !== 'off'} onClick={cycleAssistLevel} title={`Stroke Assist (${assistLabel})`} isDark={isDark} className="h-8 px-3 gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Assist {assistLabel}</span>
                </Btn>
                <Btn onClick={undo} title="Undo (Ctrl+Z)" isDark={isDark} className="h-8 w-8"><Undo2 size={14} /></Btn>
                <Btn onClick={redo} title="Redo (Ctrl+Y)" isDark={isDark} className="h-8 w-8"><Redo2 size={14} /></Btn>
                <Btn onClick={resetAll} title="Reset All (board + view)" isDark={isDark} className="h-8 w-8 text-amber-400 hover:bg-amber-500/10"><RotateCcw size={14} /></Btn>
                <Btn onClick={clearCanvas} title="Clear Canvas" isDark={isDark} className="h-8 w-8 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></Btn>
                <Btn onClick={downloadPng} title="Save as PNG" isDark={isDark} className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"><Download size={14} /></Btn>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
                  <Btn onClick={() => doZoom(-0.15)} title="Zoom Out" isDark={isDark} className="h-8 w-8"><ZoomOut size={14} /></Btn>
                  <span className="text-[10px] font-black w-10 text-center text-gray-400 tabular-nums">{Math.round(zoom * 100)}%</span>
                  <Btn onClick={() => doZoom(0.15)} title="Zoom In" isDark={isDark} className="h-8 w-8"><ZoomIn size={14} /></Btn>
                  <Btn onClick={resetView} title="Reset View" isDark={isDark} className="h-8 w-8"><LocateFixed size={14} /></Btn>
                </div>
                {onFullscreen && !isFullscreen && (
                  <Btn onClick={() => onFullscreen?.()} title={isFullscreen ? 'Exit Fullscreen (Ctrl+F)' : 'Fullscreen (Ctrl+F)'} isDark={isDark} className="h-8 w-8">
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize size={14} />}
                  </Btn>
                )}
              </div>
              {showCompactMixer && (
                <div className={`mt-2 rounded-xl border p-3 space-y-3 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-white/85'}`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaletteTarget('stroke')}
                      className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        paletteTarget === 'stroke'
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                          : isDark ? 'text-gray-300 border-white/10' : 'text-gray-700 border-black/10'
                      }`}
                    >
                      Stroke
                    </button>
                    <button
                      onClick={() => setPaletteTarget('fill')}
                      className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        paletteTarget === 'fill'
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                          : isDark ? 'text-gray-300 border-white/10' : 'text-gray-700 border-black/10'
                      }`}
                    >
                      Fill
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: color }} title="Stroke" />
                      <div className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: fillColor }} title="Fill" />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div
                      ref={paletteRef}
                      className="relative w-36 h-36 rounded-full border border-white/15 cursor-crosshair"
                      style={{
                        background: 'radial-gradient(circle at center, #ffffff 0%, rgba(255,255,255,0) 62%), conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      }}
                      onMouseDown={(e) => { updateColorFromPalettePoint(e.clientX, e.clientY); }}
                      onMouseMove={(e) => { if (e.buttons === 1) updateColorFromPalettePoint(e.clientX, e.clientY); }}
                    >
                      <div
                        className="absolute w-3 h-3 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: `${50 + Math.cos((paletteHue * Math.PI) / 180) * (paletteSat / 2)}%`,
                          top: `${50 + Math.sin((paletteHue * Math.PI) / 180) * (paletteSat / 2)}%`,
                          backgroundColor: hslToHex(paletteHue, paletteSat, paletteLight),
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Lightness ({Math.round(paletteLight)}%)</div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={paletteLight}
                      onChange={e => {
                        const nextLight = +e.target.value;
                        setPaletteLight(nextLight);
                        applyPaletteColor(paletteHue, paletteSat, nextLight);
                      }}
                      className="ethereal-range w-full h-1"
                    />
                  </div>
                </div>
              )}
              {showCompactControls && (
                <div className={`mt-2 rounded-xl border p-3 space-y-3 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-white/85'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={doFill} onChange={() => setDoFill(!doFill)} className="accent-blue-500" />
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fill</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assist</span>
                      <select
                        value={assistLevel}
                        onChange={(e) => setAssistLevel(e.target.value as AssistLevel)}
                        className={`h-7 rounded-md border px-2 text-[11px] font-semibold outline-none ${
                          isDark ? 'bg-[#11161e] border-white/10 text-gray-200' : 'bg-white border-black/10 text-gray-700'
                        }`}
                      >
                        {assistOptions.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Btn onClick={clearCanvas} title="Clear Canvas" isDark={isDark} className="h-8 w-8 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></Btn>
                    <Btn onClick={downloadPng} title="Save as PNG" isDark={isDark} className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"><Download size={14} /></Btn>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 w-10">Size</span>
                      <input type="range" min={1} max={30} value={size} onChange={e => setSize(+e.target.value)} className="ethereal-range flex-1 h-1" />
                      <span className="text-[10px] font-bold w-8 text-right text-gray-400 tabular-nums">{size}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 w-10">Opac</span>
                      <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="ethereal-range flex-1 h-1" />
                      <span className="text-[10px] font-bold w-8 text-right text-gray-400 tabular-nums">{opacity}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label title="Stroke color" className="relative cursor-pointer">
                      <div className="w-7 h-7 rounded-lg border border-white/20 shadow-lg" style={{ backgroundColor: color }}>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" />
                      </div>
                    </label>
                    <label title="Fill color" className="relative cursor-pointer">
                      <div className="w-7 h-7 rounded-lg border border-white/20 shadow-lg flex items-center justify-center" style={{ backgroundColor: fillColor }}>
                        <span className="text-[8px] text-white font-black drop-shadow-md">F</span>
                        <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" />
                      </div>
                    </label>
                    {presets.slice(0, 12).map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        title={c}
                        className={`w-5 h-5 rounded-md transition-all hover:scale-110 ${color === c ? 'ring-2 ring-blue-500' : 'border border-white/10'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {showCompactMixer && !isCompactUI && (
            <div className={`mx-4 mb-3 rounded-xl border p-3 space-y-3 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-white/85'}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaletteTarget('stroke')}
                  className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    paletteTarget === 'stroke'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                      : isDark ? 'text-gray-300 border-white/10' : 'text-gray-700 border-black/10'
                  }`}
                >
                  Stroke
                </button>
                <button
                  onClick={() => setPaletteTarget('fill')}
                  className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    paletteTarget === 'fill'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                      : isDark ? 'text-gray-300 border-white/10' : 'text-gray-700 border-black/10'
                  }`}
                >
                  Fill
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: color }} title="Stroke" />
                  <div className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: fillColor }} title="Fill" />
                </div>
              </div>

              <div className="flex justify-center">
                <div
                  ref={paletteRef}
                  className="relative w-40 h-40 rounded-full border border-white/15 cursor-crosshair"
                  style={{
                    background: 'radial-gradient(circle at center, #ffffff 0%, rgba(255,255,255,0) 62%), conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  }}
                  onMouseDown={(e) => { updateColorFromPalettePoint(e.clientX, e.clientY); }}
                  onMouseMove={(e) => { if (e.buttons === 1) updateColorFromPalettePoint(e.clientX, e.clientY); }}
                >
                  <div
                    className="absolute w-3 h-3 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${50 + Math.cos((paletteHue * Math.PI) / 180) * (paletteSat / 2)}%`,
                      top: `${50 + Math.sin((paletteHue * Math.PI) / 180) * (paletteSat / 2)}%`,
                      backgroundColor: hslToHex(paletteHue, paletteSat, paletteLight),
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Lightness ({Math.round(paletteLight)}%)</div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={paletteLight}
                  onChange={e => {
                    const nextLight = +e.target.value;
                    setPaletteLight(nextLight);
                    applyPaletteColor(paletteHue, paletteSat, nextLight);
                  }}
                  className="ethereal-range w-full h-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── canvas viewport ── */}
        <div ref={wrapRef} className="flex-1 relative overflow-hidden" style={{ cursor }}>
          <canvas
            ref={viewRef}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            className="absolute inset-0"
          />
          <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />

          {/* text input on canvas */}
          {tool === 'text' && textPos && (
            <div
              className="absolute z-[120] flex items-center gap-2"
              style={{
                left: (textPos.x + panRef.current.x) * zoomRef.current,
                top: (textPos.y + panRef.current.y) * zoomRef.current - 10,
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const p = toCanvas(e.clientX, e.clientY);
                  textDragOffsetRef.current = { x: p.x - textPos.x, y: p.y - textPos.y };
                  setDraggingTextDraft(true);
                }}
                className="h-8 px-2 text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/15 text-gray-200 rounded-lg cursor-move"
                title="Drag text to reposition before placing"
              >
                Move
              </button>
              <input
                ref={textInputRef}
                autoFocus
                value={textVal}
                onChange={e => setTextVal(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setTextPos(null);
                    setTextVal('');
                  }
                }}
                className="px-3 py-1.5 glass-panel outline-none border border-blue-500/50 shadow-2xl rounded-xl animate-in fade-in zoom-in-95"
                style={{
                  fontSize: `${(size * 4 + 14) * zoomRef.current}px`,
                  color,
                  minWidth: 180,
                }}
                placeholder="Type here..."
              />
              <button
                onClick={commitText}
                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/20"
              >
                Place
              </button>
              <button
                onClick={() => { setTextPos(null); setTextVal(''); }}
                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}

          {/* stamp label prompt */}
          {stampPrompt && (
            <div
              className="absolute z-[100] flex flex-col gap-3 p-4 glass-panel border border-white/10 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-top-2 w-56"
              style={{
                left: Math.min((stampPrompt.pos.x + panRef.current.x) * zoomRef.current, (viewRef.current?.width || 300) - 240),
                top: Math.min((stampPrompt.pos.y + panRef.current.y) * zoomRef.current - 40, (viewRef.current?.height || 300) - 120),
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Stamp Label</span>
              <input
                autoFocus
                value={stampLabel}
                onChange={e => setStampLabel(e.target.value)}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitStamp(); if (e.key === 'Escape') { setStampPrompt(null); setStampLabel(''); } }}
                className="ethereal-input text-xs h-9 px-3 uppercase tracking-wider font-bold"
                placeholder="LABEL..."
              />
              <div className="flex gap-2">
                <button
                  onClick={commitStamp}
                  className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                >Place</button>
                <button
                  onClick={() => { setStampPrompt(null); setStampLabel(''); }}
                  className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-all"
                >Cancel</button>
              </div>
            </div>
          )}

          {/* hints */}
          {isStamp && !stampPrompt && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2 glass-card rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400 animate-bounce pointer-events-none">
              <MessageSquare size={12} className="inline mr-2 text-blue-400" />
              Click to place — Label Prompt will follow
            </div>
          )}

          <div className="absolute bottom-6 right-6 px-4 py-1.5 glass-panel rounded-full text-[9px] font-bold uppercase tracking-widest text-gray-500 pointer-events-none opacity-50">
            Ctrl+Drag to Pan · Ctrl+Scroll to Zoom · Assist smooths freehand
          </div>
          {showSplitSuggestion && (
            <div className="absolute top-6 right-6 px-4 py-2 glass-panel rounded-2xl text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 border border-blue-500/20 animate-pulse pointer-events-none">
              Live Pair-Work: Split screen enabled.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
