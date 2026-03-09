'use client';

import { useRef, useCallback, useState } from 'react';
import { WorkflowNode, type WorkflowNodeData } from './workflow-node';
import {
  WorkflowConnector,
  DragConnector,
  ConnectorDefs,
  type Connection,
} from './workflow-connector';

interface WorkflowCanvasProps {
  nodes: WorkflowNodeData[];
  connections: Connection[];
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  onSelectNode: (id: string | null) => void;
  onSelectConnection: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onConfigureNode: (id: string) => void;
  onAddNode: (block: any, x: number, y: number) => void;
  onAddConnection: (fromNodeId: string, toNodeId: string) => void;
  onZoom: (delta: number) => void;
  onPan: (dx: number, dy: number) => void;
}

const NODE_WIDTH = 192; // w-48 = 12rem = 192px
const NODE_HEIGHT = 56;

export function WorkflowCanvas({
  nodes,
  connections,
  selectedNodeId,
  selectedConnectionId,
  zoom,
  pan,
  onSelectNode,
  onSelectConnection,
  onDeleteNode,
  onConfigureNode,
  onAddNode,
  onAddConnection,
  onZoom,
  onPan,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragMouse, setDragMouse] = useState<{ x: number; y: number } | null>(null);

  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [zoom, pan],
  );

  const getScreenCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // Node center positions for connectors
  const getNodeOutputPos = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      return {
        x: node.x * zoom + (NODE_WIDTH * zoom) / 2 + pan.x,
        y: node.y * zoom + NODE_HEIGHT * zoom + pan.y,
      };
    },
    [nodes, zoom, pan],
  );

  const getNodeInputPos = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      return {
        x: node.x * zoom + (NODE_WIDTH * zoom) / 2 + pan.x,
        y: node.y * zoom + pan.y,
      };
    },
    [nodes, zoom, pan],
  );

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        onZoom(delta);
      }
    },
    [onZoom],
  );

  // Pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas) {
        onSelectNode(null);
        onSelectConnection(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan, onSelectNode, onSelectConnection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        onPan(e.clientX - panStart.x, e.clientY - panStart.y);
      }
      if (connectingFrom) {
        const screen = getScreenCoords(e.clientX, e.clientY);
        setDragMouse(screen);
      }
    },
    [isPanning, panStart, onPan, connectingFrom, getScreenCoords],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setConnectingFrom(null);
    setDragMouse(null);
  }, []);

  // Drop handler
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/workflow-block');
      if (!data) return;
      try {
        const block = JSON.parse(data);
        const coords = getCanvasCoords(e.clientX, e.clientY);
        onAddNode(block, coords.x - NODE_WIDTH / 2, coords.y - NODE_HEIGHT / 2);
      } catch {
        // invalid data
      }
    },
    [getCanvasCoords, onAddNode],
  );

  // Connection handlers
  const handleConnectionStart = useCallback((nodeId: string) => {
    setConnectingFrom(nodeId);
  }, []);

  const handleConnectionEnd = useCallback(
    (nodeId: string) => {
      if (connectingFrom && connectingFrom !== nodeId) {
        onAddConnection(connectingFrom, nodeId);
      }
      setConnectingFrom(null);
      setDragMouse(null);
    },
    [connectingFrom, onAddConnection],
  );

  // Keyboard delete for selected connection
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedConnectionId) {
          onSelectConnection(null);
        }
      }
    },
    [selectedConnectionId, onSelectConnection],
  );

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative overflow-hidden cursor-crosshair"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundColor: '#f8fafc',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-canvas="true"
      data-testid="workflow-canvas"
    >
      {/* SVG layer for connectors */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <ConnectorDefs />
        <g className="pointer-events-auto">
          {connections.map((conn) => (
            <WorkflowConnector
              key={conn.id}
              connection={conn}
              fromPos={getNodeOutputPos(conn.fromNodeId)}
              toPos={getNodeInputPos(conn.toNodeId)}
              isSelected={selectedConnectionId === conn.id}
              onSelect={onSelectConnection}
            />
          ))}
          {connectingFrom && dragMouse && (
            <DragConnector from={getNodeOutputPos(connectingFrom)} to={dragMouse} />
          )}
        </g>
      </svg>

      {/* Nodes layer */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, zIndex: 2 }}
      >
        {nodes.map((node) => (
          <WorkflowNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            zoom={zoom}
            onSelect={onSelectNode}
            onDelete={onDeleteNode}
            onConfigure={onConfigureNode}
            onConnectionStart={handleConnectionStart}
            onConnectionEnd={handleConnectionEnd}
          />
        ))}
      </div>

      {/* Zoom indicator */}
      <div
        className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-white/80 px-2 py-1 rounded-lg"
        style={{ zIndex: 3 }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
