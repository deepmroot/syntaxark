export interface SharedWhiteboardPoint {
  x: number;
  y: number;
}

export interface SharedWhiteboardStyle {
  tool: 'pencil' | 'pen' | 'marker' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'arrow';
  color: string;
  fillColor: string;
  size: number;
  opacity: number;
  doFill: boolean;
}

export interface SharedWhiteboardTextObject {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  opacity: number;
}

export interface SharedWhiteboardStamp {
  tool: 'stamp-flowbox' | 'stamp-decision' | 'stamp-database' | 'stamp-server' | 'stamp-cloud' | 'stamp-note' | 'stamp-actor' | 'stamp-process';
  x: number;
  y: number;
  color: string;
  label?: string;
}

export type SharedWhiteboardOp =
  | {
      opId: string;
      kind: 'clear';
      createdAt?: number;
      createdBy?: string;
    }
  | {
      opId: string;
      kind: 'text_upsert';
      textObject: SharedWhiteboardTextObject;
      createdAt?: number;
      createdBy?: string;
    }
  | {
      opId: string;
      kind: 'stroke';
      style: SharedWhiteboardStyle;
      points: SharedWhiteboardPoint[];
      createdAt?: number;
      createdBy?: string;
    }
  | {
      opId: string;
      kind: 'shape';
      style: SharedWhiteboardStyle;
      from: SharedWhiteboardPoint;
      to: SharedWhiteboardPoint;
      createdAt?: number;
      createdBy?: string;
    }
  | {
      opId: string;
      kind: 'stamp';
      stamp: SharedWhiteboardStamp;
      createdAt?: number;
      createdBy?: string;
    };
