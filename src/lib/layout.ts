import { DiagramNode, DiagramData } from '../types/diagram';

interface LayoutNode {
  id: string;
  node: DiagramNode;
  level: number;
  children: string[];
  parents: string[];
}

export function autoLayout(diagramData: DiagramData): DiagramData {
  const nodes = [...diagramData.nodes];
  const edges = [...diagramData.edges];

  if (nodes.length === 0) return diagramData;

  const nodeMap = new Map<string, LayoutNode>();
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      id: node.id,
      node,
      level: 0,
      children: [],
      parents: []
    });
  });

  edges.forEach(edge => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (from && to) {
      from.children.push(to.id);
      to.parents.push(from.id);
    }
  });

  const rootNodes = Array.from(nodeMap.values()).filter(n => n.parents.length === 0);
  if (rootNodes.length === 0) {
    rootNodes.push(Array.from(nodeMap.values())[0]);
  }

  const visited = new Set<string>();
  const queue: string[] = rootNodes.map(n => n.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = nodeMap.get(currentId)!;
    const parentLevels = current.parents
      .map(pid => nodeMap.get(pid)?.level ?? -1)
      .filter(l => l >= 0);

    if (parentLevels.length > 0) {
      current.level = Math.max(...parentLevels) + 1;
    }

    queue.push(...current.children);
  }

  const levelGroups = new Map<number, LayoutNode[]>();
  nodeMap.forEach(layoutNode => {
    const level = layoutNode.level;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(layoutNode);
  });

  const LEVEL_SPACING = 180;
  const NODE_SPACING = 60;
  const START_X = 100;
  const START_Y = 100;

  levelGroups.forEach((levelNodes, level) => {
    const totalWidth = levelNodes.reduce((sum, ln) => sum + ln.node.dimensions.width, 0);
    const totalSpacing = (levelNodes.length - 1) * NODE_SPACING;
    const totalRowWidth = totalWidth + totalSpacing;

    let currentX = START_X - totalRowWidth / 2;
    const y = START_Y + level * LEVEL_SPACING;

    levelNodes.forEach(layoutNode => {
      layoutNode.node.position.x = currentX;
      layoutNode.node.position.y = y;
      currentX += layoutNode.node.dimensions.width + NODE_SPACING;
    });
  });

  return {
    nodes: nodes,
    edges: edges
  };
}
