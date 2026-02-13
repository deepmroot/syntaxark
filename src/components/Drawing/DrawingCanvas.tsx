import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor } from '../../store/useEditor';
import {
  Pencil, Pen, Highlighter, Eraser, Square, Circle, Minus, Type,
  Undo2, Redo2, Trash2, Download, PaintBucket, MousePointer,
  Triangle, Star, ArrowRight, Diamond, Pipette, X as XIcon,
  Grid3X3, StickyNote, Database, Server, Cloud, Hexagon,
  GitBranch, Workflow, Monitor, MessageSquare, Hand,
  ZoomIn, ZoomOut, Maximize, Minimize2,
} from 'lucide-react';

/* ─────────────────── types ─────────────────── */

type Tool =
  | 'select' | 'pencil' | 'pen' | 'marker' | 'eraser' | 'hand'
  | 'line' | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'arrow'
  | 'text' | 'fill' | 'eyedropper'
  | 'stamp-flowbox' | 'stamp-decision' | 'stamp-database' | 'stamp-server'
  | 'stamp-cloud' | 'stamp-note' | 'stamp-actor' | 'stamp-process';

interface Point { x: number; y: number }
interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  cursorX?: number;
  cursorY?: number;
  isSharing?: boolean;
}

/* ═══════════════════ persistent state (survives close/open) ═══════════════════ */

const CANVAS_W = 4000;
const CANVAS_H = 4000;

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

/* ═══════════════════ toolbar button ═══════════════════ */

const Btn: React.FC<{
  active?: boolean; onClick: () => void; title: string;
  children: React.ReactNode; isDark: boolean; className?: string;
}> = ({ active, onClick, title, children, isDark, className = '' }) => (
  <button
    onClick={onClick} title={title}
    className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center border ${
      active 
        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
        : isDark 
          ? 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5 hover:border-white/5'
          : 'text-gray-600 border-transparent hover:text-black hover:bg-black/5 hover:border-black/5'
    } ${className}`}
  >{children}</button>
);

const SectionLabel: React.FC<{ label: string; isDark: boolean }> = ({ label, isDark }) => (
  <div className={`text-[8px] font-black uppercase tracking-[0.2em] px-1 pt-4 pb-1 select-none ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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
  showSplitSuggestion?: boolean;
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
  showSplitSuggestion = false,
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

  const [drawing, setDrawing] = useState(false);
  const [panning, setPanning] = useState(false);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [textVal, setTextVal] = useState('');

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
  const snapshotDebounceRef = useRef<number | null>(null);
  const lastSnapshotSentRef = useRef('');
  const lastAppliedSnapshotVersionRef = useRef<number>(0);
  const lastLocalDrawAtRef = useRef<number>(0);

  const isStamp = (tool as string).startsWith('stamp-');
  const isFree = ['pencil', 'pen', 'marker', 'eraser'].includes(tool);
  const isShp = ['line', 'rectangle', 'circle', 'triangle', 'diamond', 'star', 'arrow'].includes(tool);

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

    vctx.save();
    vctx.scale(zoomRef.current, zoomRef.current);
    vctx.translate(panRef.current.x, panRef.current.y);
    vctx.drawImage(src, 0, 0);
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
      const label = `${cursor.username}${cursor.isSharing ? ' (sharing)' : ''}`;
      vctx.font = '11px sans-serif';
      const tw = vctx.measureText(label).width;
      vctx.fillStyle = 'rgba(0,0,0,0.65)';
      vctx.fillRect(sx + 12, sy + 4, tw + 8, 16);
      vctx.fillStyle = '#fff';
      vctx.fillText(label, sx + 16, sy + 16);
      vctx.restore();
    });
  }, [bgColor, isDark, showGrid, remoteCursors]);

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
      view.width = w; view.height = h;
      overlay.width = w; overlay.height = h;
      renderView();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderView]);

  /* re-render on pan/zoom/grid changes */
  useEffect(() => { renderView(); }, [pan, zoom, showGrid, renderView]);

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
    if (onSnapshotChange) {
      if (snapshotDebounceRef.current) window.clearTimeout(snapshotDebounceRef.current);
      snapshotDebounceRef.current = window.setTimeout(() => {
        const snapshot = canvasRef.current?.toDataURL('image/png');
        if (!snapshot || snapshot === lastSnapshotSentRef.current) return;
        lastSnapshotSentRef.current = snapshot;
        onSnapshotChange(snapshot);
      }, 350);
    }
  }, [onSnapshotChange, renderView]);

  const undo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || undos.current.length <= 1) return;
    redos.current.push(undos.current.pop()!);
    c.getContext('2d')!.putImageData(undos.current[undos.current.length - 1], 0, 0);
    renderView();
  }, [renderView]);

  const redo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || redos.current.length === 0) return;
    const e = redos.current.pop()!;
    undos.current.push(e);
    c.getContext('2d')!.putImageData(e, 0, 0);
    renderView();
  }, [renderView]);

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
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === ' ') { e.preventDefault(); setTool(prev => prev === 'hand' ? 'pencil' : 'hand'); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') ctrlHeld.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [undo, redo]);

  /* ─── zoom helper ─── */
  const doZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;

    const oldZ = zoomRef.current;
    const newZ = Math.max(0.1, Math.min(5, oldZ + delta));

    // adjust pan so zoom centers on mouse
    const newPanX = panRef.current.x - (cx / newZ - cx / oldZ);
    const newPanY = panRef.current.y - (cy / newZ - cy / oldZ);

    zoomRef.current = newZ;
    panRef.current = { x: newPanX, y: newPanY };
    setZoom(newZ);
    setPan({ x: newPanX, y: newPanY });
  }, []);

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
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = 'source-over';
    if (tool === 'eraser') {
      ctx.strokeStyle = bgColor; ctx.lineWidth = size * 4;
    } else if (tool === 'marker') {
      ctx.strokeStyle = color; ctx.lineWidth = size * 4; ctx.globalAlpha = 0.3;
    } else if (tool === 'pen') {
      ctx.strokeStyle = color; ctx.lineWidth = size * 2;
    } else {
      ctx.strokeStyle = color; ctx.lineWidth = size;
    }
    if (doFill) ctx.fillStyle = fillColor;
  }, [tool, color, fillColor, size, opacity, doFill, bgColor]);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    ctx.beginPath();
    switch (tool) {
      case 'line':
        ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); break;
      case 'arrow': {
        const a = Math.atan2(dy, dx), hl = Math.max(12, size * 4);
        ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to.x, to.y); ctx.lineTo(to.x - hl * Math.cos(a - Math.PI / 6), to.y - hl * Math.sin(a - Math.PI / 6));
        ctx.moveTo(to.x, to.y); ctx.lineTo(to.x - hl * Math.cos(a + Math.PI / 6), to.y - hl * Math.sin(a + Math.PI / 6));
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
        ctx.moveTo(from.x + dx / 2, from.y); ctx.lineTo(to.x, to.y); ctx.lineTo(from.x, to.y);
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
  }, [tool, size, doFill]);

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

  /* ─── mouse handlers ─── */
  const onDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    const screenP = { x: e.clientX, y: e.clientY };
    const p = toCanvas(e.clientX, e.clientY);

    // Ctrl+click or hand tool → pan
    if (tool === 'hand' || ctrlHeld.current) {
      setPanning(true);
      panStartRef.current = screenP;
      panStartPanRef.current = { ...panRef.current };
      return;
    }

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
    if (tool === 'text') { setTextPos(p); return; }
    if (tool === 'select') return;

    if (isStamp) {
      // show label prompt
      setStampPrompt({ tool, pos: p });
      setStampLabel('');
      return;
    }

    setDrawing(true);
    setOrigin(p);

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      setupCtx(ctx);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      renderView();
    }
  };

  const onMove = (e: React.MouseEvent) => {
    const screenP = { x: e.clientX, y: e.clientY };
    const p = toCanvas(e.clientX, e.clientY);
    if (onCursorMove) onCursorMove(p.x, p.y);
    lastMouseRef.current = p;

    if (panning) {
      const dx = (screenP.x - panStartRef.current.x) / zoomRef.current;
      const dy = (screenP.y - panStartRef.current.y) / zoomRef.current;
      panRef.current = { x: panStartPanRef.current.x + dx, y: panStartPanRef.current.y + dy };
      setPan({ ...panRef.current });
      return;
    }

    if (!drawing || !canEdit) return;

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      renderView();
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
  };

  const onUp = () => {
    if (panning) { setPanning(false); return; }
    if (!drawing) return;
    setDrawing(false);

    if (isFree) {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.closePath(); ctx.globalAlpha = 1;
      snap();
    }

    if (isShp && origin) {
      const ctx = canvasRef.current!.getContext('2d')!;
      setupCtx(ctx);
      drawShape(ctx, origin, lastMouseRef.current);

      const o = overlayRef.current!;
      o.getContext('2d')!.clearRect(0, 0, o.width, o.height);

      setOrigin(null);
      snap();
    }
  };

  /* ─── stamp prompt submit ─── */
  const commitStamp = () => {
    if (!stampPrompt) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    drawStamp(ctx, stampPrompt.tool, stampPrompt.pos.x, stampPrompt.pos.y, color, isDark, stampLabel.trim() || undefined);
    snap();
    setStampPrompt(null);
    setStampLabel('');
  };

  const commitText = () => {
    if (!textPos || !textVal.trim()) { setTextPos(null); setTextVal(''); return; }
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.font = `${size * 4 + 14}px sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity / 100;
    ctx.fillText(textVal, textPos.x, textPos.y);
    ctx.globalAlpha = 1;
    snap();
    setTextPos(null);
    setTextVal('');
  };

  const clearCanvas = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    snap();
  };

  const downloadPng = () => {
    const a = document.createElement('a');
    a.download = 'drawing.png';
    a.href = canvasRef.current!.toDataURL('image/png');
    a.click();
  };

  const presets = [
    '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
    '#06b6d4', '#14b8a6', '#a855f7', '#f43f5e', '#84cc16',
  ];

  const isPanning = panning || tool === 'hand' || ctrlHeld.current;
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
    <div className={`flex h-full overflow-hidden relative ${isDark ? 'bg-[#141417]/50 backdrop-blur-xl' : 'bg-[#f8f8f8]'}`}>

      {/* hidden full-size canvas (off-screen drawing surface) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── LEFT SIDEBAR ─── */}
      <div className={`w-[60px] shrink-0 flex flex-col items-center border-r overflow-y-auto no-scrollbar py-4 gap-1 backdrop-blur-2xl ${isDark ? 'bg-[#1a1a1e]/80 border-white/5' : 'bg-[#fcfcfc]/80 border-black/5'}`}>
        <Btn onClick={onClose} title="Close" isDark={isDark} className="mb-2 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"><XIcon size={SZ} /></Btn>
        {onFullscreen && (
          <Btn onClick={onFullscreen} title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'} isDark={isDark} className="mb-2">
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
        <Btn active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Toggle Grid" isDark={isDark}><Grid3X3 size={SZ} /></Btn>
      </div>

      {/* ─── RIGHT SIDE ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* top controls */}
        <div className={`flex items-center gap-4 px-4 h-14 border-b shrink-0 backdrop-blur-2xl ${isDark ? 'bg-[#1a1a1e]/80 border-white/5' : 'bg-[#fcfcfc]/80 border-black/5'}`}>
          <label className="flex items-center gap-3 cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">
            <div className="relative flex items-center">
              <input type="checkbox" checked={doFill} onChange={() => setDoFill(!doFill)} className="sr-only" />
              <div className={`w-8 h-4 rounded-full transition-colors ${doFill ? 'bg-blue-500' : 'bg-white/10'}`} />
              <div className={`absolute left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${doFill ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-600'}`}>Fill</span>
          </label>

          <div className="w-[1px] h-4 bg-white/10" />
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Size</span>
              <input type="range" min={1} max={30} value={size} onChange={e => setSize(+e.target.value)} className="ethereal-range w-24 h-1" />
              <span className="text-[10px] font-bold w-5 text-center text-gray-400 tabular-nums">{size}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Opac</span>
              <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="ethereal-range w-20 h-1" />
              <span className="text-[10px] font-bold w-8 text-center text-gray-400 tabular-nums">{opacity}%</span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          <div className="flex items-center gap-3">
            <label title="Stroke color" className="relative cursor-pointer group">
              <div className="w-6 h-6 rounded-lg border border-white/20 shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: color }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" />
              </div>
            </label>
            <label title="Fill color" className="relative cursor-pointer group">
              <div className="w-6 h-6 rounded-lg border border-white/20 shadow-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: fillColor }}>
                <span className="text-[8px] text-white font-black drop-shadow-md">F</span>
                <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" />
              </div>
            </label>
            <div className="flex items-center gap-1.5 ml-1">
              {presets.slice(0, 10).map(c => (
                <button key={c} onClick={() => setColor(c)} title={c}
                  className={`w-4 h-4 rounded-md transition-all hover:scale-125 active:scale-95 ${color === c ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1e1e1e]' : 'border border-white/5'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex-1" />

          {/* zoom controls */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
            <Btn onClick={() => doZoom(-0.15)} title="Zoom Out" isDark={isDark} className="h-8 w-8"><ZoomOut size={14} /></Btn>
            <span className="text-[10px] font-black w-10 text-center text-gray-400 tabular-nums">{Math.round(zoom * 100)}%</span>
            <Btn onClick={() => doZoom(0.15)} title="Zoom In" isDark={isDark} className="h-8 w-8"><ZoomIn size={14} /></Btn>
            <Btn onClick={resetView} title="Reset View" isDark={isDark} className="h-8 w-8"><Maximize size={14} /></Btn>
          </div>

          <div className="w-[1px] h-4 mx-2 bg-white/10" />

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
            <Btn onClick={undo} title="Undo (Ctrl+Z)" isDark={isDark} className="h-8 w-8"><Undo2 size={14} /></Btn>
            <Btn onClick={redo} title="Redo (Ctrl+Y)" isDark={isDark} className="h-8 w-8"><Redo2 size={14} /></Btn>
            <Btn onClick={clearCanvas} title="Clear Canvas" isDark={isDark} className="h-8 w-8 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></Btn>
            <Btn onClick={downloadPng} title="Save as PNG" isDark={isDark} className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"><Download size={14} /></Btn>
          </div>
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
            <input
              autoFocus
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setTextPos(null); setTextVal(''); } }}
              onBlur={commitText}
              onClick={e => e.stopPropagation()}
              className="absolute px-3 py-1.5 glass-panel outline-none border border-blue-500/50 shadow-2xl rounded-xl animate-in fade-in zoom-in-95"
              style={{
                left: (textPos.x + panRef.current.x) * zoomRef.current,
                top: (textPos.y + panRef.current.y) * zoomRef.current - 10,
                fontSize: `${(size * 4 + 14) * zoomRef.current}px`,
                color,
                minWidth: 150,
                zIndex: 100,
              }}
              placeholder="Type here..."
            />
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
            Ctrl+Drag to Pan · Ctrl+Scroll to Zoom
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
