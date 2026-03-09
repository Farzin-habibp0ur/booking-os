'use client';

import {
  Play,
  GitBranch,
  Zap,
  Clock,
  CalendarPlus,
  CalendarX,
  UserPlus,
  MessageSquare,
  RefreshCw,
  Timer,
  Tag,
  DollarSign,
  Briefcase,
  Users,
  Mail,
  Send,
  Bell,
  FileText,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export interface BlockDefinition {
  type: 'TRIGGER' | 'CONDITION' | 'ACTION' | 'DELAY';
  subtype: string;
  label: string;
  icon: any;
}

const TRIGGER_BLOCKS: BlockDefinition[] = [
  { type: 'TRIGGER', subtype: 'BOOKING_CREATED', label: 'New Booking', icon: CalendarPlus },
  { type: 'TRIGGER', subtype: 'BOOKING_CANCELLED', label: 'Booking Cancelled', icon: CalendarX },
  { type: 'TRIGGER', subtype: 'CUSTOMER_CREATED', label: 'Customer Created', icon: UserPlus },
  { type: 'TRIGGER', subtype: 'MESSAGE_RECEIVED', label: 'Message Received', icon: MessageSquare },
  { type: 'TRIGGER', subtype: 'STATUS_CHANGED', label: 'Status Changed', icon: RefreshCw },
  { type: 'TRIGGER', subtype: 'BOOKING_UPCOMING', label: 'Time-Based', icon: Timer },
];

const CONDITION_BLOCKS: BlockDefinition[] = [
  { type: 'CONDITION', subtype: 'IF_STATUS', label: 'If Status Is', icon: RefreshCw },
  { type: 'CONDITION', subtype: 'IF_TAG', label: 'If Tag Contains', icon: Tag },
  { type: 'CONDITION', subtype: 'IF_TIME_SINCE', label: 'If Time Since > X', icon: Clock },
  { type: 'CONDITION', subtype: 'IF_AMOUNT', label: 'If Amount > X', icon: DollarSign },
  { type: 'CONDITION', subtype: 'IF_SERVICE', label: 'If Service Is', icon: Briefcase },
  { type: 'CONDITION', subtype: 'IF_STAFF', label: 'If Staff Is', icon: Users },
];

const ACTION_BLOCKS: BlockDefinition[] = [
  { type: 'ACTION', subtype: 'SEND_TEMPLATE', label: 'Send Message', icon: Send },
  { type: 'ACTION', subtype: 'SEND_EMAIL', label: 'Send Email', icon: Mail },
  { type: 'ACTION', subtype: 'CREATE_ACTION_CARD', label: 'Create Action Card', icon: FileText },
  { type: 'ACTION', subtype: 'UPDATE_STATUS', label: 'Update Status', icon: RefreshCw },
  { type: 'ACTION', subtype: 'ASSIGN_STAFF', label: 'Assign Staff', icon: Users },
  { type: 'ACTION', subtype: 'ADD_TAG', label: 'Add Tag', icon: Tag },
  { type: 'ACTION', subtype: 'SEND_NOTIFICATION', label: 'Send WhatsApp', icon: Bell },
];

const DELAY_BLOCKS: BlockDefinition[] = [
  { type: 'DELAY', subtype: 'WAIT_MINUTES', label: 'Wait X Minutes', icon: Clock },
  { type: 'DELAY', subtype: 'WAIT_HOURS', label: 'Wait X Hours', icon: Hourglass },
  { type: 'DELAY', subtype: 'WAIT_UNTIL', label: 'Wait Until Time', icon: Timer },
];

const SECTION_STYLES: Record<string, { label: string; color: string }> = {
  TRIGGER: { label: 'Triggers', color: 'text-sage-700' },
  CONDITION: { label: 'Conditions', color: 'text-amber-700' },
  ACTION: { label: 'Actions', color: 'text-blue-700' },
  DELAY: { label: 'Delays', color: 'text-slate-700' },
};

const BLOCK_BG: Record<string, string> = {
  TRIGGER: 'bg-sage-50 border-sage-200 hover:bg-sage-100',
  CONDITION: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  ACTION: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  DELAY: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
};

function BlockItem({ block }: { block: BlockDefinition }) {
  const Icon = block.icon;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/workflow-block', JSON.stringify(block));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-grab active:cursor-grabbing transition-colors',
        BLOCK_BG[block.type],
      )}
      data-testid={`block-${block.subtype}`}
    >
      <Icon size={14} className="shrink-0" />
      <span>{block.label}</span>
    </div>
  );
}

export function WorkflowSidebar() {
  const sections = [
    { key: 'TRIGGER', blocks: TRIGGER_BLOCKS },
    { key: 'CONDITION', blocks: CONDITION_BLOCKS },
    { key: 'ACTION', blocks: ACTION_BLOCKS },
    { key: 'DELAY', blocks: DELAY_BLOCKS },
  ];

  return (
    <div className="w-64 border-r border-slate-200 bg-white flex flex-col h-full overflow-y-auto" data-testid="workflow-sidebar">
      <div className="p-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blocks</p>
      </div>
      <div className="p-3 space-y-4 flex-1">
        {sections.map(({ key, blocks }) => {
          const s = SECTION_STYLES[key];
          return (
            <div key={key}>
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-2', s.color)}>
                {s.label}
              </p>
              <div className="space-y-1.5">
                {blocks.map((block) => (
                  <BlockItem key={block.subtype} block={block} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
