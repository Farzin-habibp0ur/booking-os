'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { X, Settings } from 'lucide-react';
import type { WorkflowNodeData } from './workflow-node';

interface NodeConfigModalProps {
  node: WorkflowNodeData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, any>) => void;
}

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function NodeConfigModal({ node, isOpen, onClose, onSave }: NodeConfigModalProps) {
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) setConfig({ ...node.config });
  }, [node]);

  if (!isOpen || !node) return null;

  const update = (key: string, value: any) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave(node.id, config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg w-96 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="node-config-modal"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Configure: {node.label}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Label</label>
            <input
              type="text"
              value={config.label || node.label}
              onChange={(e) => update('label', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
            />
          </div>

          {/* Trigger-specific fields */}
          {node.type === 'TRIGGER' && node.subtype === 'BOOKING_UPCOMING' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Hours before</label>
              <input
                type="number"
                min={1}
                max={72}
                value={config.hoursBefore || 24}
                onChange={(e) => update('hoursBefore', parseInt(e.target.value) || 24)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'TRIGGER' && node.subtype === 'STATUS_CHANGED' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">New status</label>
              <select
                value={config.newStatus || ''}
                onChange={(e) => update('newStatus', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              >
                <option value="">Any status</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Condition-specific fields */}
          {node.type === 'CONDITION' && node.subtype === 'IF_STATUS' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Status equals</label>
              <select
                value={config.status || ''}
                onChange={(e) => update('status', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              >
                <option value="">Select status</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {node.type === 'CONDITION' && node.subtype === 'IF_TAG' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tag contains</label>
              <input
                type="text"
                value={config.tag || ''}
                onChange={(e) => update('tag', e.target.value)}
                placeholder="e.g. vip"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'CONDITION' && node.subtype === 'IF_AMOUNT' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Amount greater than ($)</label>
              <input
                type="number"
                min={0}
                value={config.amount || ''}
                onChange={(e) => update('amount', parseFloat(e.target.value) || 0)}
                placeholder="100"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'CONDITION' && node.subtype === 'IF_TIME_SINCE' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Hours since last activity</label>
              <input
                type="number"
                min={1}
                value={config.timeSince || ''}
                onChange={(e) => update('timeSince', parseInt(e.target.value) || 1)}
                placeholder="48"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'CONDITION' && node.subtype === 'IF_SERVICE' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Service name contains</label>
              <input
                type="text"
                value={config.service || ''}
                onChange={(e) => update('service', e.target.value)}
                placeholder="e.g. Facial"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'CONDITION' && node.subtype === 'IF_STAFF' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Staff name</label>
              <input
                type="text"
                value={config.staff || ''}
                onChange={(e) => update('staff', e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {/* Action-specific fields */}
          {node.type === 'ACTION' && (node.subtype === 'SEND_TEMPLATE' || node.subtype === 'SEND_NOTIFICATION') && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Template / Message</label>
                <input
                  type="text"
                  value={config.category || ''}
                  onChange={(e) => update('category', e.target.value)}
                  placeholder="e.g. BOOKING_CONFIRMATION"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Channel</label>
                <select
                  value={config.channel || 'WHATSAPP'}
                  onChange={(e) => update('channel', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>
            </>
          )}

          {node.type === 'ACTION' && node.subtype === 'SEND_EMAIL' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email template</label>
              <input
                type="text"
                value={config.category || ''}
                onChange={(e) => update('category', e.target.value)}
                placeholder="e.g. FOLLOW_UP"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'ACTION' && node.subtype === 'UPDATE_STATUS' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">New status</label>
              <select
                value={config.status || ''}
                onChange={(e) => update('status', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              >
                <option value="">Select status</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {node.type === 'ACTION' && node.subtype === 'ASSIGN_STAFF' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Staff ID</label>
              <input
                type="text"
                value={config.staffId || ''}
                onChange={(e) => update('staffId', e.target.value)}
                placeholder="Staff ID"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'ACTION' && node.subtype === 'ADD_TAG' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tag name</label>
              <input
                type="text"
                value={config.tag || ''}
                onChange={(e) => update('tag', e.target.value)}
                placeholder="e.g. vip"
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'ACTION' && node.subtype === 'CREATE_ACTION_CARD' && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Card title</label>
                <input
                  type="text"
                  value={config.title || ''}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="Follow up required"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea
                  value={config.description || ''}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Action card description..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none resize-none"
                />
              </div>
            </>
          )}

          {/* Delay-specific fields */}
          {node.type === 'DELAY' && (node.subtype === 'WAIT_MINUTES' || node.subtype === 'WAIT_HOURS') && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Duration ({node.subtype === 'WAIT_MINUTES' ? 'minutes' : 'hours'})
              </label>
              <input
                type="number"
                min={1}
                value={config.duration || ''}
                onChange={(e) => {
                  update('duration', parseInt(e.target.value) || 1);
                  update('unit', node.subtype === 'WAIT_MINUTES' ? 'minutes' : 'hours');
                }}
                placeholder={node.subtype === 'WAIT_MINUTES' ? '30' : '2'}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}

          {node.type === 'DELAY' && node.subtype === 'WAIT_UNTIL' && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Wait until time (HH:mm)</label>
              <input
                type="time"
                value={config.until || '09:00'}
                onChange={(e) => update('until', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors"
            data-testid="config-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
