'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { Play, GitBranch, Zap, Clock, X, Circle } from 'lucide-react';

export interface WorkflowNodeData {
  id: string;
  type: 'TRIGGER' | 'CONDITION' | 'ACTION' | 'DELAY';
  subtype: string;
  label: string;
  config: Record<string, any>;
  x: number;
  y: number;
}

interface WorkflowNodeProps {
  node: WorkflowNodeData;
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onConfigure: (id: string) => void;
  onConnectionStart: (nodeId: string, point: 'output') => void;
  onConnectionEnd: (nodeId: string, point: 'input') => void;
}

const NODE_STYLES: Record<string, { bg: string; border: string; icon: any; accent: string }> = {
  TRIGGER: { bg: 'bg-sage-100', border: 'border-sage-300', icon: Play, accent: 'border-l-sage-600' },
  CONDITION: { bg: 'bg-amber-50', border: 'border-amber-300', icon: GitBranch, accent: 'border-l-amber-500' },
  ACTION: { bg: 'bg-blue-50', border: 'border-blue-300', icon: Zap, accent: 'border-l-blue-500' },
  DELAY: { bg: 'bg-slate-100', border: 'border-slate-300', icon: Clock, accent: 'border-l-slate-500' },
};

function getConfigSummary(node: WorkflowNodeData): string {
  const c = node.config;
  if (!c || Object.keys(c).length === 0) return 'Click to configure';
  switch (node.type) {
    case 'TRIGGER':
      if (c.hoursBefore) return `${c.hoursBefore}h before`;
      if (c.newStatus) return `Status → ${c.newStatus}`;
      return 'Configured';
    case 'CONDITION':
      if (c.status) return `Status = ${c.status}`;
      if (c.tag) return `Tag: ${c.tag}`;
      if (c.amount) return `Amount > $${c.amount}`;
      if (c.service) return `Service: ${c.service}`;
      if (c.staff) return `Staff: ${c.staff}`;
      if (c.timeSince) return `${c.timeSince}h since last`;
      return 'Configured';
    case 'ACTION':
      if (c.category) return `Template: ${c.category}`;
      if (c.tag) return `Tag: ${c.tag}`;
      if (c.status) return `→ ${c.status}`;
      if (c.staffId) return 'Assign staff';
      if (c.channel) return `Via ${c.channel}`;
      return 'Configured';
    case 'DELAY':
      if (c.duration && c.unit) return `Wait ${c.duration} ${c.unit}`;
      if (c.until) return `Until ${c.until}`;
      return 'Configured';
    default:
      return 'Configured';
  }
}

export function WorkflowNode({
  node,
  isSelected,
  zoom,
  onSelect,
  onDelete,
  onConfigure,
  onConnectionStart,
  onConnectionEnd,
}: WorkflowNodeProps) {
  const style = NODE_STYLES[node.type] || NODE_STYLES.ACTION;
  const Icon = style.icon;
  const outputRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        'absolute select-none',
        node.type === 'CONDITION' && 'pt-2',
      )}
      style={{
        left: node.x * zoom,
        top: node.y * zoom,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onConfigure(node.id);
      }}
      data-testid={`workflow-node-${node.id}`}
      data-node-type={node.type}
    >
      {/* Input connection point */}
      {node.type !== 'TRIGGER' && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-10"
          onMouseUp={(e) => {
            e.stopPropagation();
            onConnectionEnd(node.id, 'input');
          }}
          data-testid={`node-input-${node.id}`}
        >
          <Circle
            size={10}
            className="text-slate-400 fill-white hover:fill-sage-200 cursor-pointer transition-colors"
          />
        </div>
      )}

      {/* Node body */}
      <div
        className={cn(
          'w-48 rounded-xl border-l-4 border px-3 py-2.5 cursor-pointer transition-shadow',
          style.bg,
          style.border,
          style.accent,
          isSelected && 'ring-2 ring-sage-500 shadow-md',
          node.type === 'CONDITION' && 'rotate-0',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={14} className="text-slate-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 truncate">{node.label}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
            aria-label="Delete node"
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">{getConfigSummary(node)}</p>
      </div>

      {/* Output connection point */}
      <div
        ref={outputRef}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          onConnectionStart(node.id, 'output');
        }}
        data-testid={`node-output-${node.id}`}
      >
        <Circle
          size={10}
          className="text-slate-400 fill-white hover:fill-sage-200 cursor-pointer transition-colors"
        />
      </div>
    </div>
  );
}
