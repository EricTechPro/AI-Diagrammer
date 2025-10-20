export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export type NodeType = 'rectangle' | 'ellipse' | 'diamond' | 'image';

export interface DiagramNode {
  id: string;
  type: NodeType;
  text: string;
  position: Position;
  dimensions: Dimensions;
  imageUrl?: string;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface DrawingPath {
  id: string;
  points: Position[];
  color: string;
  width: number;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  paths?: DrawingPath[];
}

export interface SavedDiagram {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  diagram_data: DiagramData;
  created_at: string;
  updated_at: string;
}
