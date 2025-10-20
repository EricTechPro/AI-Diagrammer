import { useRef, useEffect, useState, useCallback } from 'react';
import { DiagramData, DiagramNode, NodeType, Position } from '../types/diagram';
import { DiagramRenderer } from '../lib/drawing';
import { constrainAndSnapPosition } from '../lib/boundaries';

type Tool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'pen';

interface CanvasProps {
  diagramData: DiagramData;
  setDiagramData: (data: DiagramData) => void;
  selectedNodeIds: string[];
  onNodeSelect: (nodeIds: string[]) => void;
  selectedTool: Tool;
  onToolChange: (tool: Tool) => void;
  penColor: string;
}

export function Canvas({
  diagramData,
  setDiagramData,
  selectedNodeIds,
  onNodeSelect,
  selectedTool,
  onToolChange,
  penColor,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [dragOffsets, setDragOffsets] = useState<Map<string, Position>>(new Map());
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ start: Position; end: Position } | null>(null);
  const [currentPath, setCurrentPath] = useState<Position[]>([]);
  const [editingTextNode, setEditingTextNode] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [tempNodePositions, setTempNodePositions] = useState<Map<string, Position>>(new Map());

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new DiagramRenderer(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    renderer.drawGrid(offset.x, offset.y, scale, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    if (diagramData.paths) {
      diagramData.paths.forEach(path => {
        renderer.drawPath(path);
      });
    }

    diagramData.edges.forEach(edge => {
      renderer.drawEdge(edge, diagramData.nodes);
    });

    diagramData.nodes.forEach(node => {
      const tempPos = tempNodePositions.get(node.id);
      const nodeToRender = tempPos ? { ...node, position: tempPos } : node;
      renderer.drawNode(nodeToRender, selectedNodeIds.includes(node.id));
    });

    if (currentPath.length > 0) {
      renderer.drawPath({
        id: 'temp',
        points: currentPath,
        color: penColor,
        width: 2,
      });
    }

    ctx.restore();

    if (selectionBox && isSelecting) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      const x = Math.min(selectionBox.start.x, selectionBox.end.x) * scale + offset.x;
      const y = Math.min(selectionBox.start.y, selectionBox.end.y) * scale + offset.y;
      const width = Math.abs(selectionBox.end.x - selectionBox.start.x) * scale;
      const height = Math.abs(selectionBox.end.y - selectionBox.start.y) * scale;

      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
  }, [diagramData, offset, scale, selectedNodeIds, selectionBox, isSelecting, currentPath, penColor, tempNodePositions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !editingTextNode && e.target === document.body) {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        onToolChange('select');
        onNodeSelect([]);
        setEditingTextNode(null);
        setSelectionBox(null);
        setIsSelecting(false);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0 && !editingTextNode) {
        e.preventDefault();
        const newNodes = diagramData.nodes.filter(n => !selectedNodeIds.includes(n.id));
        const newEdges = diagramData.edges.filter(
          e => !selectedNodeIds.includes(e.from) && !selectedNodeIds.includes(e.to)
        );
        setDiagramData({ ...diagramData, nodes: newNodes, edges: newEdges });
        onNodeSelect([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, diagramData, setDiagramData, onNodeSelect, onToolChange, editingTextNode]);

  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offset.x) / scale,
      y: (screenY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  const findNodeAtPosition = useCallback((x: number, y: number): DiagramNode | null => {
    for (let i = diagramData.nodes.length - 1; i >= 0; i--) {
      const node = diagramData.nodes[i];
      if (
        x >= node.position.x &&
        x <= node.position.x + node.dimensions.width &&
        y >= node.position.y &&
        y <= node.position.y + node.dimensions.height
      ) {
        return node;
      }
    }
    return null;
  }, [diagramData.nodes]);

  const getNodesInBox = useCallback((box: { start: Position; end: Position }): string[] => {
    const minX = Math.min(box.start.x, box.end.x);
    const maxX = Math.max(box.start.x, box.end.x);
    const minY = Math.min(box.start.y, box.end.y);
    const maxY = Math.max(box.start.y, box.end.y);

    return diagramData.nodes
      .filter(node => {
        const nodeRight = node.position.x + node.dimensions.width;
        const nodeBottom = node.position.y + node.dimensions.height;
        return (
          node.position.x >= minX &&
          nodeRight <= maxX &&
          node.position.y >= minY &&
          nodeBottom <= maxY
        );
      })
      .map(node => node.id);
  }, [diagramData.nodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const clickedNode = findNodeAtPosition(canvasPos.x, canvasPos.y);
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isSpacePressed) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (selectedTool === 'select') {
      if (clickedNode) {
        if (isCtrlOrCmd) {
          if (selectedNodeIds.includes(clickedNode.id)) {
            onNodeSelect(selectedNodeIds.filter(id => id !== clickedNode.id));
          } else {
            onNodeSelect([...selectedNodeIds, clickedNode.id]);
          }
        } else {
          const nodesToDrag = selectedNodeIds.includes(clickedNode.id)
            ? selectedNodeIds
            : [clickedNode.id];

          if (!selectedNodeIds.includes(clickedNode.id)) {
            onNodeSelect([clickedNode.id]);
          }

          setIsDragging(true);
          const offsets = new Map<string, Position>();
          nodesToDrag.forEach(id => {
            const node = diagramData.nodes.find(n => n.id === id);
            if (node) {
              offsets.set(id, {
                x: canvasPos.x - node.position.x,
                y: canvasPos.y - node.position.y,
              });
            }
          });
          setDragOffsets(offsets);
        }
      } else {
        if (!isCtrlOrCmd) {
          onNodeSelect([]);
        }
        setIsSelecting(true);
        setSelectionBox({ start: canvasPos, end: canvasPos });
      }
    } else if (selectedTool === 'pen') {
      setIsDrawing(true);
      setCurrentPath([canvasPos]);
    } else if (selectedTool === 'text') {
      if (!clickedNode) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setTextInputPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setEditingTextNode('new');
        setTextInput('');
      }
    } else {
      setIsDrawing(true);
      setDrawStart(canvasPos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isDragging && selectedNodeIds.length > 0) {
      const newTempPositions = new Map<string, Position>();
      diagramData.nodes.forEach(node => {
        if (selectedNodeIds.includes(node.id)) {
          const dragOffset = dragOffsets.get(node.id);
          if (dragOffset) {
            const newPosition = {
              x: canvasPos.x - dragOffset.x,
              y: canvasPos.y - dragOffset.y,
            };
            const constrainedPosition = constrainAndSnapPosition(newPosition, node.dimensions);
            newTempPositions.set(node.id, constrainedPosition);
          }
        }
      });
      setTempNodePositions(newTempPositions);
    } else if (isSelecting && selectionBox) {
      setSelectionBox({ ...selectionBox, end: canvasPos });
    } else if (isDrawing && selectedTool === 'pen') {
      setCurrentPath(prev => [...prev, canvasPos]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && tempNodePositions.size > 0) {
      const updatedNodes = diagramData.nodes.map(node => {
        const tempPos = tempNodePositions.get(node.id);
        return tempPos ? { ...node, position: tempPos } : node;
      });
      setDiagramData({ ...diagramData, nodes: updatedNodes });
      setTempNodePositions(new Map());
    }

    if (isDrawing && selectedTool === 'pen' && currentPath.length > 2) {
      const newPath = {
        id: `path-${Date.now()}`,
        points: currentPath,
        color: penColor,
        width: 2,
      };
      setDiagramData({
        ...diagramData,
        paths: [...(diagramData.paths || []), newPath],
      });
      setCurrentPath([]);
    } else if (isDrawing && selectedTool !== 'select' && selectedTool !== 'text' && selectedTool !== 'pen') {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);

      const width = Math.abs(canvasPos.x - drawStart.x);
      const height = Math.abs(canvasPos.y - drawStart.y);

      if (width > 20 && height > 20) {
        const x = Math.min(drawStart.x, canvasPos.x);
        const y = Math.min(drawStart.y, canvasPos.y);

        const position = constrainAndSnapPosition(
          { x, y },
          { width, height }
        );

        const newNode: DiagramNode = {
          id: `node-${Date.now()}`,
          type: selectedTool as NodeType,
          text: selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1),
          position,
          dimensions: { width, height },
        };

        setDiagramData({
          ...diagramData,
          nodes: [...diagramData.nodes, newNode],
        });

        onToolChange('select');
      }
    } else if (isSelecting && selectionBox) {
      const nodesInBox = getNodesInBox(selectionBox);
      if (nodesInBox.length > 0) {
        onNodeSelect(nodesInBox);
      }
      setSelectionBox(null);
      setIsSelecting(false);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsDrawing(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (selectedTool !== 'select') return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const clickedNode = findNodeAtPosition(canvasPos.x, canvasPos.y);

    if (clickedNode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setTextInputPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setEditingTextNode(clickedNode.id);
      setTextInput(clickedNode.text);
    }
  };

  const handleTextSubmit = () => {
    if (editingTextNode === 'new' && textInput.trim()) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasPos = screenToCanvas(textInputPos.x + rect.left, textInputPos.y + rect.top);

      const position = constrainAndSnapPosition(
        canvasPos,
        { width: 150, height: 60 }
      );

      const newNode: DiagramNode = {
        id: `node-${Date.now()}`,
        type: 'rectangle',
        text: textInput.trim(),
        position,
        dimensions: { width: 150, height: 60 },
      };

      setDiagramData({
        ...diagramData,
        nodes: [...diagramData.nodes, newNode],
      });

      onToolChange('select');
    } else if (editingTextNode && editingTextNode !== 'new') {
      const updatedNodes = diagramData.nodes.map(n =>
        n.id === editingTextNode ? { ...n, text: textInput.trim() || n.text } : n
      );
      setDiagramData({ ...diagramData, nodes: updatedNodes });
    }

    setEditingTextNode(null);
    setTextInput('');
  };

  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed && !isPanning) return 'grab';
    if (isDragging) return 'move';
    if (selectedTool === 'select') return 'default';
    if (selectedTool === 'text') return 'text';
    if (selectedTool === 'pen') return 'crosshair';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: getCursorStyle() }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />

      {selectedNodeIds.length > 0 && (
        <div className="absolute top-4 right-4 bg-white px-3 py-2 rounded shadow-md text-sm text-gray-700 border border-gray-200">
          {selectedNodeIds.length} item{selectedNodeIds.length > 1 ? 's' : ''} selected
        </div>
      )}

      {editingTextNode && (
        <div
          className="absolute"
          style={{
            left: textInputPos.x,
            top: textInputPos.y,
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTextSubmit();
              } else if (e.key === 'Escape') {
                setEditingTextNode(null);
                setTextInput('');
              }
            }}
            onBlur={handleTextSubmit}
            autoFocus
            className="px-3 py-2 border border-blue-500 rounded shadow-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter text..."
          />
        </div>
      )}
    </div>
  );
}
