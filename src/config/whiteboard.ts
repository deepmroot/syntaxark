export interface WhiteboardCompactBreakpoints {
  desktop: number;
  mobile: number;
}

export const WHITEBOARD_COMPACT_BREAKPOINTS = {
  default: { desktop: 1100, mobile: 760 } as WhiteboardCompactBreakpoints,
  mainEmbedded: { desktop: 980, mobile: 860 } as WhiteboardCompactBreakpoints,
  fullscreen: { desktop: 1280, mobile: 920 } as WhiteboardCompactBreakpoints,
  collaborateEmbedded: { desktop: 1150, mobile: 920 } as WhiteboardCompactBreakpoints,
} as const;

