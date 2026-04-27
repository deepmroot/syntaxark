import type { SharedWhiteboardOp } from './types';

export interface WhiteboardOpRowLike {
  opId: string;
  kind: string;
  payload?: string;
  createdBy?: string;
  createdAt?: number;
}

export const isRasterWhiteboardOp = (op: SharedWhiteboardOp) =>
  op.kind === 'stroke' || op.kind === 'shape' || op.kind === 'stamp' || op.kind === 'clear';

export const encodeWhiteboardOpPayload = (op: SharedWhiteboardOp) => {
  if (op.kind === 'text_upsert') return JSON.stringify(op.textObject);
  if (op.kind === 'stroke') return JSON.stringify({ style: op.style, points: op.points });
  if (op.kind === 'shape') return JSON.stringify({ style: op.style, from: op.from, to: op.to });
  if (op.kind === 'stamp') return JSON.stringify(op.stamp);
  return undefined;
};

export const decodeWhiteboardOps = (rows: WhiteboardOpRowLike[]): SharedWhiteboardOp[] => {
  const sortedRows = [...rows].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return sortedRows.reduce<SharedWhiteboardOp[]>((acc, row) => {
    if (row.kind === 'clear') {
      acc.push({
        opId: row.opId,
        kind: 'clear',
        createdAt: row.createdAt,
        createdBy: row.createdBy ? String(row.createdBy) : undefined,
      });
      return acc;
    }
    if (!row.payload) return acc;
    try {
      const parsed = JSON.parse(row.payload);
      if (row.kind === 'text_upsert') {
        acc.push({ opId: row.opId, kind: 'text_upsert', textObject: parsed, createdAt: row.createdAt, createdBy: row.createdBy ? String(row.createdBy) : undefined });
      } else if (row.kind === 'stroke') {
        acc.push({ opId: row.opId, kind: 'stroke', style: parsed.style, points: parsed.points, createdAt: row.createdAt, createdBy: row.createdBy ? String(row.createdBy) : undefined });
      } else if (row.kind === 'shape') {
        acc.push({ opId: row.opId, kind: 'shape', style: parsed.style, from: parsed.from, to: parsed.to, createdAt: row.createdAt, createdBy: row.createdBy ? String(row.createdBy) : undefined });
      } else if (row.kind === 'stamp') {
        acc.push({ opId: row.opId, kind: 'stamp', stamp: parsed, createdAt: row.createdAt, createdBy: row.createdBy ? String(row.createdBy) : undefined });
      }
    } catch {
      return acc;
    }
    return acc;
  }, []);
};

export const getActiveDrawingUserIds = (ops: SharedWhiteboardOp[], activeWindowMs = 2500) => {
  const now = Date.now();
  return new Set(
    ops
      .filter((op) => isRasterWhiteboardOp(op) && now - (op.createdAt || 0) < activeWindowMs)
      .map((op) => op.createdBy)
      .filter((value): value is string => Boolean(value)),
  );
};
