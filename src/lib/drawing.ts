import rough from 'roughjs';
import { RoughCanvas } from 'roughjs/bin/canvas';
import { DiagramNode, DiagramEdge, Position, DrawingPath } from '../types/diagram';

export class DiagramRenderer {
  private rc: RoughCanvas;
  private ctx: CanvasRenderingContext2D;
  private imageCache: Map<string, HTMLImageElement>;

  constructor(canvas: HTMLCanvasElement) {
    this.rc = rough.canvas(canvas);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    this.imageCache = new Map();
  }

  clear() {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  drawNode(node: DiagramNode, isSelected: boolean = false) {
    const { x, y } = node.position;
    const { width, height } = node.dimensions;

    const strokeColor = isSelected ? '#3b82f6' : '#1f2937';
    const strokeWidth = isSelected ? 2.5 : 1.5;

    switch (node.type) {
      case 'rectangle':
        this.rc.rectangle(x, y, width, height, {
          stroke: strokeColor,
          strokeWidth,
          fill: '#ffffff',
          fillStyle: 'solid',
          roughness: 1.2,
        });
        break;

      case 'ellipse':
        this.rc.ellipse(x + width / 2, y + height / 2, width, height, {
          stroke: strokeColor,
          strokeWidth,
          fill: '#ffffff',
          fillStyle: 'solid',
          roughness: 1.2,
        });
        break;

      case 'diamond':
        const cx = x + width / 2;
        const cy = y + height / 2;
        this.rc.polygon(
          [
            [cx, y],
            [x + width, cy],
            [cx, y + height],
            [x, cy],
          ],
          {
            stroke: strokeColor,
            strokeWidth,
            fill: '#ffffff',
            fillStyle: 'solid',
            roughness: 1.2,
          }
        );
        break;

      case 'image':
        if (node.imageUrl) {
          this.drawImage(node.imageUrl, x, y, width, height, isSelected);
        }
        break;
    }

    if (node.type !== 'image') {
      this.drawText(node.text, node);
    }
  }

  private drawText(text: string, node: DiagramNode) {
    const { x, y } = node.position;
    const { width, height } = node.dimensions;

    this.ctx.save();
    this.ctx.font = '14px Arial, sans-serif';
    this.ctx.fillStyle = '#1f2937';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    const maxWidth = width - 20;

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = this.ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      lines.push(currentLine);
    }

    const lineHeight = 18;
    const totalHeight = lines.length * lineHeight;
    const startY = y + height / 2 - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, index) => {
      this.ctx.fillText(line, x + width / 2, startY + index * lineHeight);
    });

    this.ctx.restore();
  }

  private drawImage(url: string, x: number, y: number, width: number, height: number, isSelected: boolean) {
    let img = this.imageCache.get(url);

    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      this.imageCache.set(url, img);

      img.onload = () => {
        this.ctx.save();
        this.ctx.drawImage(img!, x, y, width, height);
        if (isSelected) {
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 2.5;
          this.ctx.strokeRect(x, y, width, height);
        }
        this.ctx.restore();
      };
    } else if (img.complete) {
      this.ctx.save();
      this.ctx.drawImage(img, x, y, width, height);
      if (isSelected) {
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeRect(x, y, width, height);
      }
      this.ctx.restore();
    }
  }

  drawEdge(edge: DiagramEdge, nodes: DiagramNode[]) {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return;

    const from = this.getNodeCenter(fromNode);
    const to = this.getNodeCenter(toNode);

    this.rc.line(from.x, from.y, to.x, to.y, {
      stroke: '#1f2937',
      strokeWidth: 1.5,
      roughness: 1,
    });

    this.drawArrowHead(from, to);

    if (edge.label) {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      this.ctx.save();
      this.ctx.font = '12px Arial, sans-serif';
      this.ctx.fillStyle = '#4b5563';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const padding = 4;
      const metrics = this.ctx.measureText(edge.label);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(
        midX - metrics.width / 2 - padding,
        midY - 8,
        metrics.width + padding * 2,
        16
      );

      this.ctx.fillStyle = '#4b5563';
      this.ctx.fillText(edge.label, midX, midY);
      this.ctx.restore();
    }
  }

  private getNodeCenter(node: DiagramNode): Position {
    return {
      x: node.position.x + node.dimensions.width / 2,
      y: node.position.y + node.dimensions.height / 2,
    };
  }

  private drawArrowHead(from: Position, to: Position) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLength = 12;

    const tipX = to.x;
    const tipY = to.y;

    const leftX = tipX - arrowLength * Math.cos(angle - Math.PI / 6);
    const leftY = tipY - arrowLength * Math.sin(angle - Math.PI / 6);

    const rightX = tipX - arrowLength * Math.cos(angle + Math.PI / 6);
    const rightY = tipY - arrowLength * Math.sin(angle + Math.PI / 6);

    this.rc.polygon(
      [
        [tipX, tipY],
        [leftX, leftY],
        [rightX, rightY],
      ],
      {
        stroke: '#1f2937',
        strokeWidth: 1.5,
        fill: '#1f2937',
        fillStyle: 'solid',
        roughness: 1,
      }
    );
  }

  drawPath(path: DrawingPath) {
    if (path.points.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = path.color;
    this.ctx.lineWidth = path.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(path.points[0].x, path.points[0].y);

    for (let i = 1; i < path.points.length; i++) {
      this.ctx.lineTo(path.points[i].x, path.points[i].y);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  drawGrid(offsetX: number, offsetY: number, scale: number, canvasWidth: number, canvasHeight: number) {
    const gridSize = 20 * scale;
    const startX = (offsetX % gridSize + gridSize) % gridSize;
    const startY = (offsetY % gridSize + gridSize) % gridSize;

    this.ctx.save();
    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth = 1;

    for (let x = startX; x < canvasWidth + gridSize; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, canvasHeight);
      this.ctx.stroke();
    }

    for (let y = startY; y < canvasHeight + gridSize; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvasWidth, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}
