import type { SharedWhiteboardOp } from './types';

export interface WhiteboardHistoryState {
  history: SharedWhiteboardOp[];
  redo: SharedWhiteboardOp[];
}

type WhiteboardHistoryAction =
  | { type: 'sync'; ops: SharedWhiteboardOp[] }
  | { type: 'append'; op: SharedWhiteboardOp }
  | { type: 'checkpoint_retain_text' }
  | { type: 'undo_user'; userId: string }
  | { type: 'redo' };

export const initialWhiteboardHistoryState: WhiteboardHistoryState = {
  history: [],
  redo: [],
};

const sameOps = (a: SharedWhiteboardOp[], b: SharedWhiteboardOp[]) =>
  a.length === b.length && a.every((op, index) => op.opId === b[index]?.opId);

const isTextOp = (op: SharedWhiteboardOp) => op.kind === 'text_upsert';

export const whiteboardHistoryReducer = (
  state: WhiteboardHistoryState,
  action: WhiteboardHistoryAction,
): WhiteboardHistoryState => {
  switch (action.type) {
    case 'sync':
      return sameOps(state.history, action.ops)
        ? state
        : { history: action.ops, redo: [] };
    case 'append':
      return {
        history: [...state.history, action.op],
        redo: [],
      };
    case 'checkpoint_retain_text':
      return {
        history: state.history.filter(isTextOp),
        redo: [],
      };
    case 'undo_user': {
      const targetIndex = [...state.history]
        .map((op, index) => ({ op, index }))
        .reverse()
        .find(({ op }) => op.createdBy === action.userId)?.index;
      if (targetIndex === undefined) return state;
      const removed = state.history[targetIndex];
      return {
        history: state.history.filter((_, index) => index !== targetIndex),
        redo: [removed, ...state.redo],
      };
    }
    case 'redo': {
      const [nextOp, ...rest] = state.redo;
      if (!nextOp) return state;
      return {
        history: [...state.history, nextOp],
        redo: rest,
      };
    }
    default:
      return state;
  }
};
