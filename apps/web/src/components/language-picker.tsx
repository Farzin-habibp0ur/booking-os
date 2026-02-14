'use client';

import { useI18n, SUPPORTED_LOCALES } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export function LanguagePicker() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <Globe size={14} className="text-gray-400" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="text-sm bg-transparent border-none text-gray-600 cursor-pointer focus:outline-none py-0"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
