'use client';

import { cn } from '@/lib/cn';

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

interface WorkflowConnectorProps {
  connection: Connection;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  isSelected: boolean;
  onSelect: (id: string) => void;
}

interface DragConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function WorkflowConnector({
  connection,
  fromPos,
  toPos,
  isSelected,
  onSelect,
}: WorkflowConnectorProps) {
  const path = getCubicBezierPath(fromPos, toPos);

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(connection.id);
      }}
      className="cursor-pointer"
      data-testid={`connector-${connection.id}`}
    >
      {/* Invisible wider hit area */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#71907C' : '#94a3b8'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

export function DragConnector({ from, to }: DragConnectorProps) {
  const path = getCubicBezierPath(from, to);

  return (
    <path
      d={path}
      fill="none"
      stroke="#71907C"
      strokeWidth={2}
      strokeDasharray="6 3"
      className="animate-pulse"
      data-testid="drag-connector"
    />
  );
}

function getCubicBezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dy = Math.abs(to.y - from.y);
  const controlOffset = Math.max(40, dy * 0.4);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + controlOffset}, ${to.x} ${to.y - controlOffset}, ${to.x} ${to.y}`;
}

export function ConnectorDefs() {
  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="8"
        markerHeight="6"
        refX="8"
        refY="3"
        orient="auto"
      >
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
      </marker>
    </defs>
  );
}
