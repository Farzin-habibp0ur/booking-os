'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';
import { Upload, FileText, Users, Download, Loader2 } from 'lucide-react';

export default function AccountSettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; phone: string; email: string; tags: string }>>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

  // Conversation import
  const [includeMessages, setIncludeMessages] = useState(true);
  const [convImporting, setConvImporting] = useState(false);
  const [convResult, setConvResult] = useState<{ created: number; updated: number } | null>(null);

  const handleCsvSelect = (file: File) => {
    setCsvFile(file);
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = header.findIndex((h) => h === 'name');
      const phoneIdx = header.findIndex((h) => h === 'phone');
      const emailIdx = header.findIndex((h) => h === 'email');
      const tagsIdx = header.findIndex((h) => h === 'tags');
      const rows = lines.slice(1, 11).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
          phone: phoneIdx >= 0 ? cols[phoneIdx] || '' : '',
          email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
          tags: tagsIdx >= 0 ? cols[tagsIdx] || '' : '',
        };
      });
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const result = await api.upload<{ created: number; skipped: number; errors: number }>('/customers/import-csv', formData);
      setCsvResult(result);
      toast(t('import.csv_success', { created: result.created, skipped: result.skipped }));
    } catch (e: any) {
      toast(t('import.csv_failed'), 'error');
    }
    setCsvImporting(false);
  };

  const importFromConversations = async () => {
    setConvImporting(true);
    try {
      const result = await api.post<{ created: number; updated: number }>('/customers/import-from-conversations', { includeMessages });
      setConvResult(result);
      toast(t('import.conversations_success', { updated: result.updated }));
    } catch (e: any) {
      toast(t('import.conversations_failed'), 'error');
    }
    setConvImporting(false);
  };

  const exportCustomers = async () => {
    try {
      const data = await api.get<any>('/customers?pageSize=10000');
      const customers = data.data || [];
      const header = 'name,phone,email,tags';
      const rows = customers.map((c: any) =>
        `${c.name || ''},${c.phone || ''},${c.email || ''},${(c.tags || []).join(';')}`,
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast(t('import.export_success'));
    } catch (e) {
      toast(t('import.export_failed'), 'error');
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Upload size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('import.page_title')}</h1>
      </div>

      {/* CSV Import */}
      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-sage-600" />
          <h2 className="font-semibold">{t('import.csv_title')}</h2>
        </div>
        <p className="text-sm text-slate-500">{t('import.csv_desc')}</p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-sage-500 hover:bg-sage-50 transition-colors"
        >
          <Upload size={24} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600">{csvFile ? csvFile.name : t('import.csv_drop_zone')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('import.csv_format_hint')}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])}
        />

        {csvPreview.length > 0 && (
          <div className="border border-slate-100 rounded-xl overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-2 text-xs">{t('common.name')}</th>
                  <th className="text-left p-2 text-xs">{t('common.phone')}</th>
                  <th className="text-left p-2 text-xs">{t('common.email')}</th>
                  <th className="text-left p-2 text-xs">{t('common.tags')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {csvPreview.map((row, i) => (
                  <tr key={i}>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.phone}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2">{row.tags}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {csvFile && (
          <button
            onClick={importCsv}
            disabled={csvImporting}
            className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {csvImporting && <Loader2 size={14} className="animate-spin" />}
            {t('import.import_button')}
          </button>
        )}

        {csvResult && (
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-3 text-sm">
            <p className="text-sage-700">
              {t('import.csv_result', { created: csvResult.created, skipped: csvResult.skipped, errors: csvResult.errors })}
            </p>
          </div>
        )}
      </div>

      {/* Conversation Import */}
      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-lavender-600" />
          <h2 className="font-semibold">{t('import.conversations_title')}</h2>
        </div>
        <p className="text-sm text-slate-500">{t('import.conversations_desc')}</p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMessages}
            onChange={(e) => setIncludeMessages(e.target.checked)}
            className="rounded text-lavender-600"
          />
          <span className="text-sm">{t('import.include_messages')}</span>
        </label>
        <p className="text-xs text-slate-400">{t('import.include_messages_hint')}</p>

        <button
          onClick={importFromConversations}
          disabled={convImporting}
          className="bg-lavender-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-lavender-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {convImporting && <Loader2 size={14} className="animate-spin" />}
          {t('import.generate_profiles')}
        </button>

        {convResult && (
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-3 text-sm">
            <p className="text-sage-700">
              {t('import.conversations_result', { created: convResult.created, updated: convResult.updated })}
            </p>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-sage-600" />
          <h2 className="font-semibold">{t('import.export_title')}</h2>
        </div>
        <p className="text-sm text-slate-500">{t('import.export_desc')}</p>
        <button
          onClick={exportCustomers}
          className="border border-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <Download size={14} /> {t('import.export_button')}
        </button>
      </div>
    </div>
  );
}
