'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { ChevronRight } from 'lucide-react';
import {
  getSettingsCategoriesForRole,
  getFirstPageForCategory,
  type SettingsCategory,
} from '@/lib/settings-config';
import { ELEVATION } from '@/lib/design-tokens';

const ACCENT_CLASSES: Record<string, string> = {
  sage: 'bg-sage-50 text-sage-600 dark:bg-sage-900/30 dark:text-sage-400',
  lavender: 'bg-lavender-50 text-lavender-600 dark:bg-lavender-900/30 dark:text-lavender-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function SettingsHub() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role || 'ADMIN';
  const categories = getSettingsCategoriesForRole(role);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((cat) => (
        <SettingsCategoryCard key={cat.key} category={cat} onClick={() => router.push(getFirstPageForCategory(cat))} />
      ))}
    </div>
  );
}

function SettingsCategoryCard({
  category,
  onClick,
}: {
  category: SettingsCategory;
  onClick: () => void;
}) {
  const Icon = category.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-4 p-5 bg-white dark:bg-slate-900 text-left',
        ELEVATION.card,
        'hover:shadow-soft-lg transition-shadow duration-200 btn-press group',
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          ACCENT_CLASSES[category.accent],
        )}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {category.label}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {category.description}
        </p>
      </div>
      <ChevronRight
        size={16}
        className="text-slate-300 dark:text-slate-600 mt-1 group-hover:text-sage-500 transition-colors"
      />
    </button>
  );
}
