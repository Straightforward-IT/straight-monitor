export type ArchitectureNodeKind =
  | 'actor'
  | 'surface'
  | 'service'
  | 'automation'
  | 'external'
  | 'store'
  | 'domain'
  | 'document';

export type ArchitectureEdgeKind =
  | 'access'
  | 'http'
  | 'webhook'
  | 'sync'
  | 'scheduled'
  | 'storage'
  | 'reference'
  | 'workflow';

export type ArchitectureTone = 'sand' | 'amber' | 'teal' | 'red' | 'slate';

export interface GraphSourceRef {
  path: string;
  note?: string;
}

export interface LiveOverlayHint {
  kind: 'registry-team' | 'api-route' | 'model' | 'routine';
  key: string;
  summary: string;
}

export interface ArchitectureGroup {
  id: string;
  label: string;
  tone: ArchitectureTone;
  summary: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: ArchitectureNodeKind;
  groupId: string;
  summary: string;
  description: string;
  tags?: string[];
  sources: GraphSourceRef[];
  liveOverlay?: LiveOverlayHint;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  kind: ArchitectureEdgeKind;
  label: string;
  summary: string;
  description?: string;
  sources: GraphSourceRef[];
}

export interface ViewPosition {
  x: number;
  y: number;
}

export interface ArchitectureZone {
  id: string;
  label: string;
  summary: string;
}

export interface ArchitectureViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ArchitectureView {
  id: string;
  label: string;
  summary: string;
  narrative: string[];
  nodeIds: string[];
  edgeIds?: string[];
  positions: Record<string, ViewPosition>;
  zones: ArchitectureZone[];
  defaultSelectedNodeId?: string;
  viewport: ArchitectureViewport;
}

export interface ArchitectureGraph {
  version: string;
  title: string;
  summary: string;
  groups: ArchitectureGroup[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  views: ArchitectureView[];
}

export interface LayoutGuidelines {
  generalRules: string[];
  readingModes: Array<{
    id: string;
    label: string;
    summary: string;
  }>;
  viewRules: Record<string, string[]>;
}