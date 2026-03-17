import { cn } from '@/lib/cn';

export const REJECTION_CODE_LABELS: Record<string, string> = {
  R01: 'Missing Research',
  R02: 'Low Quality',
  R03: 'Off-Brand',
  R04: 'Duplicate Content',
  R05: 'Wrong Format',
  R06: 'Missing CTA',
  R07: 'SEO Issues',
  R08: 'Factual Errors',
  R09: 'Compliance Issue',
  R10: 'Other',
};

export const REJECTION_CODES = Object.keys(REJECTION_CODE_LABELS);

const SEVERITY_GROUPS: Record<string, { label: string; codes: string[] }> = {
  CRITICAL: { label: 'Critical', codes: ['R08', 'R09'] },
  MAJOR: { label: 'Major', codes: ['R02', 'R03', 'R07'] },
  MINOR: { label: 'Minor', codes: ['R01', 'R04', 'R05', 'R06', 'R10'] },
};

interface RejectionCodePickerProps {
  selectedCode: string;
  onSelect: (code: string) => void;
  grouped?: boolean;
  className?: string;
}

export function RejectionCodePicker({
  selectedCode,
  onSelect,
  grouped = false,
  className,
}: RejectionCodePickerProps) {
  return (
    <select
      data-testid="rejection-code-picker"
      value={selectedCode}
      onChange={(e) => onSelect(e.target.value)}
      className={cn(
        'bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm',
        className,
      )}
    >
      {grouped
        ? Object.entries(SEVERITY_GROUPS).map(([severity, group]) => (
            <optgroup key={severity} label={group.label}>
              {group.codes.map((code) => (
                <option key={code} value={code}>
                  {code} — {REJECTION_CODE_LABELS[code]}
                </option>
              ))}
            </optgroup>
          ))
        : REJECTION_CODES.map((code) => (
            <option key={code} value={code}>
              {code} — {REJECTION_CODE_LABELS[code]}
            </option>
          ))}
    </select>
  );
}
