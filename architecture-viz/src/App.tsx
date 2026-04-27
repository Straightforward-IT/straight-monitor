import { useEffect, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { architectureGraph } from './data/architectureGraph';
import { layoutGuidelines } from './data/layoutGuidelines';
import type { ArchitectureEdge, ArchitectureNode, ArchitectureView } from './types/architecture';
import { validateArchitectureGraph } from './utils/validateArchitecture';

const edgePalette: Record<ArchitectureEdge['kind'], { stroke: string; background: string }> = {
  access: { stroke: '#8f7245', background: '#f1ebe1' },
  http: { stroke: '#6e7f7a', background: '#edf2f0' },
  webhook: { stroke: '#9a6d62', background: '#f3ece8' },
  sync: { stroke: '#6d7a87', background: '#edf0f3' },
  scheduled: { stroke: '#857b72', background: '#f2efeb' },
  storage: { stroke: '#8a8a8a', background: '#f2f2f2' },
  reference: { stroke: '#75856c', background: '#eef1ea' },
  workflow: { stroke: '#7f6a57', background: '#f3eee8' },
};

const graphErrors = validateArchitectureGraph(architectureGraph);

function getView(viewId: string): ArchitectureView {
  return architectureGraph.views.find((view) => view.id === viewId) ?? architectureGraph.views[0];
}

function getNode(nodeId: string): ArchitectureNode | undefined {
  return architectureGraph.nodes.find((node) => node.id === nodeId);
}

function getGroupLabel(groupId: string): string {
  return architectureGraph.groups.find((group) => group.id === groupId)?.label ?? groupId;
}

function buildFlowNodes(selectedView: ArchitectureView, selectedNodeId: string): Node[] {
  return selectedView.nodeIds
    .map((nodeId) => {
      const item = getNode(nodeId);
      if (!item) {
        return null;
      }

      const position = selectedView.positions[nodeId];
      if (!position) {
        return null;
      }

      return {
        id: item.id,
        position,
        draggable: false,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: 244,
          padding: 0,
          border: 'none',
          background: 'transparent',
        },
        data: {
          label: (
            <article className={`graph-node ${selectedNodeId === item.id ? 'graph-node--selected' : ''}`}>
              <span className="graph-node__group">{getGroupLabel(item.groupId)}</span>
              <strong className="graph-node__title">{item.label}</strong>
              <p className="graph-node__summary">{item.summary}</p>
            </article>
          ),
        },
      } satisfies Node;
    })
    .filter((node): node is Node => node !== null);
}

function buildFlowEdges(selectedView: ArchitectureView): Edge[] {
  const visibleNodeIds = new Set(selectedView.nodeIds);
  const explicitEdges = new Set(selectedView.edgeIds ?? []);
  const visibleEdges = architectureGraph.edges.filter((edge) => {
    if (selectedView.edgeIds) {
      return explicitEdges.has(edge.id);
    }

    return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
  });

  return visibleEdges.map((edge) => {
    const palette = edgePalette[edge.kind];

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: palette.stroke,
      },
      style: {
        stroke: palette.stroke,
        strokeWidth: 2,
      },
      labelStyle: {
        fill: '#2b2b2b',
        fontSize: 10,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: palette.background,
        fillOpacity: 1,
        rx: 0,
        ry: 0,
      },
      labelBgPadding: [8, 4],
    } satisfies Edge;
  });
}

export default function App() {
  const [selectedViewId, setSelectedViewId] = useState(
    architectureGraph.views[0]?.id ?? 'company-overview',
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'menu' | 'detail'>('menu');

  const selectedView = getView(selectedViewId);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : undefined;
  const selectedViewRules = layoutGuidelines.viewRules[selectedView.id] ?? [];
  const nodes = buildFlowNodes(selectedView, selectedNodeId ?? '');
  const edges = buildFlowEdges(selectedView);

  useEffect(() => {
    setSelectedNodeId(null);
    setPanelMode('menu');
  }, [selectedViewId]);

  return (
    <main className="workspace">
      <section className="canvas-home" aria-label="Firmenkarte">
        <ReactFlow
          key={selectedView.id}
          nodes={nodes}
          edges={edges}
          defaultViewport={selectedView.viewport}
          minZoom={0.45}
          maxZoom={1.6}
          nodesConnectable={false}
          nodesDraggable={false}
          fitView={false}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setPanelMode('detail');
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setPanelMode('menu');
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="#ddd5c9" />
        </ReactFlow>
      </section>

      <aside className="tool-strip tool-strip--right" aria-label="Einordnung und Details">
        {panelMode === 'menu' ? (
          <>
            <p className="strip-kicker">Menü</p>
            <p className="strip-copy">{architectureGraph.summary}</p>
            {architectureGraph.views.map((view) => (
              <button
                key={view.id}
                className={`strip-button ${view.id === selectedViewId ? 'strip-button--active' : ''}`}
                onClick={() => setSelectedViewId(view.id)}
                type="button"
              >
                <strong>{view.label}</strong>
                <span>{view.summary}</span>
              </button>
            ))}
            <p className="strip-label">Aktuelle Sicht</p>
            <p className="strip-copy strip-copy--strong">{selectedView.label}</p>
            <p className="strip-copy">{selectedView.summary}</p>
            <ul className="strip-list strip-list--compact">
              {selectedView.narrative.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {selectedViewRules.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {graphErrors.length > 0 ? (
              <p className="strip-note">
                Interne Notiz: {graphErrors.length} technische Validierung(en) sind noch offen.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <button
              className="back-button"
              onClick={() => {
                setSelectedNodeId(null);
                setPanelMode('menu');
              }}
              type="button"
            >
              Zurück zum Menü
            </button>
            <p className="strip-kicker">{selectedNode ? getGroupLabel(selectedNode.groupId) : 'Details'}</p>
            <p className="detail-title">{selectedNode?.label ?? 'Keine Auswahl'}</p>
            <p className="strip-copy">
              {selectedNode?.description ?? 'Wähle einen Baustein auf der Karte aus.'}
            </p>
            {selectedNode ? (
              <ul className="tag-list">
                <li>{getGroupLabel(selectedNode.groupId)}</li>
                {(selectedNode.tags ?? []).map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}
            <p className="strip-label">Warum wichtig</p>
            <p className="strip-copy strip-copy--strong">
              {selectedNode?.summary ?? 'Kein Baustein ausgewählt.'}
            </p>
          </>
        )}
      </aside>
    </main>
  );
}
