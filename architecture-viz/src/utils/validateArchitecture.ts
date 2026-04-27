import type { ArchitectureGraph } from '../types/architecture';

export function validateArchitectureGraph(graph: ArchitectureGraph): string[] {
  const errors: string[] = [];
  const groupIds = new Set(graph.groups.map((group) => group.id));
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);

    if (!groupIds.has(node.groupId)) {
      errors.push(`Node ${node.id} references missing group ${node.groupId}`);
    }
  }

  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} has missing source ${edge.source}`);
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} has missing target ${edge.target}`);
    }
  }

  for (const view of graph.views) {
    for (const nodeId of view.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`View ${view.id} references missing node ${nodeId}`);
        continue;
      }

      if (!view.positions[nodeId]) {
        errors.push(`View ${view.id} is missing a position for node ${nodeId}`);
      }
    }

    if (view.edgeIds) {
      for (const edgeId of view.edgeIds) {
        if (!edgeIds.has(edgeId)) {
          errors.push(`View ${view.id} references missing edge ${edgeId}`);
        }
      }
    }
  }

  return errors;
}