'use client';

import { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: 'customers' | 'bookings';
  allFields: { key: string; label: string }[];
}

export default function ExportModal({ isOpen, onClose, entity, allFields }: ExportModalProps) {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(allFields.map((f) => f.key)),
  );
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedFields.size === allFields.length) {
      setSelectedFields(new Set([allFields[0].key]));
    } else {
      setSelectedFields(new Set(allFields.map((f) => f.key)));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (selectedFields.size < allFields.length) {
        params.set('fields', Array.from(selectedFields).join(','));
      }

      const url = `/${entity}/export${params.toString() ? `?${params}` : ''}`;
      const csv = await api.getText(url);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${entity}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast(`${entity === 'customers' ? 'Customer' : 'Booking'} data exported successfully`);
      onClose();
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-soft-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-serif font-semibold text-slate-900">
            Export {entity === 'customers' ? 'Customers' : 'Bookings'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                placeholder="To"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank to export all records</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Fields</label>
              <button
                onClick={toggleAll}
                className="text-xs text-sage-600 hover:text-sage-700"
                type="button"
              >
                {selectedFields.size === allFields.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {allFields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field.key)}
                    onChange={() => toggleField(field.key)}
                    className="rounded text-sage-600"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedFields.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
