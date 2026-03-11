'use client';

import { cn } from '@/lib/cn';

interface MedicalRecord {
  id: string;
  version: number;
  allergies: string[];
  contraindications: string[];
  medications: string[];
  conditions: string[];
  skinType: string | null;
  fitzpatrickScale: string | null;
  bloodThinners: boolean;
  pregnant: boolean;
  breastfeeding: boolean;
  recentSurgery: string | null;
  notes: string | null;
  flagged: boolean;
  flagReason: string | null;
  consentGiven: boolean;
  consentDate: string | null;
  createdAt: string;
  recordedBy?: { name: string } | null;
}

interface MedicalHistoryDiffProps {
  oldRecord: MedicalRecord;
  newRecord: MedicalRecord;
}

type FieldDef =
  | { key: string; label: string; type: 'array' }
  | { key: string; label: string; type: 'boolean' }
  | { key: string; label: string; type: 'string' };

const FIELDS: FieldDef[] = [
  { key: 'allergies', label: 'Allergies', type: 'array' },
  { key: 'contraindications', label: 'Contraindications', type: 'array' },
  { key: 'medications', label: 'Medications', type: 'array' },
  { key: 'conditions', label: 'Conditions', type: 'array' },
  { key: 'skinType', label: 'Skin Type', type: 'string' },
  { key: 'fitzpatrickScale', label: 'Fitzpatrick Scale', type: 'string' },
  { key: 'bloodThinners', label: 'Blood Thinners', type: 'boolean' },
  { key: 'pregnant', label: 'Pregnant', type: 'boolean' },
  { key: 'breastfeeding', label: 'Breastfeeding', type: 'boolean' },
  { key: 'recentSurgery', label: 'Recent Surgery', type: 'string' },
  { key: 'notes', label: 'Notes', type: 'string' },
  { key: 'flagged', label: 'Flagged', type: 'boolean' },
  { key: 'flagReason', label: 'Flag Reason', type: 'string' },
  { key: 'consentGiven', label: 'Consent Given', type: 'boolean' },
];

function getFieldValue(record: MedicalRecord, key: string): any {
  return (record as any)[key];
}

function ArrayDiff({ oldItems, newItems }: { oldItems: string[]; newItems: string[] }) {
  const added = newItems.filter((item) => !oldItems.includes(item));
  const removed = oldItems.filter((item) => !newItems.includes(item));
  const unchanged = newItems.filter((item) => oldItems.includes(item));

  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {unchanged.map((item, i) => (
        <span key={`u-${i}`} className="rounded-full bg-sage-100 px-2 py-0.5 text-xs text-sage-600">
          {item}
        </span>
      ))}
      {added.map((item, i) => (
        <span key={`a-${i}`} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
          + {item}
        </span>
      ))}
      {removed.map((item, i) => (
        <span key={`r-${i}`} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 line-through">
          {item}
        </span>
      ))}
    </div>
  );
}

function BooleanDiff({ oldVal, newVal }: { oldVal: boolean; newVal: boolean }) {
  if (oldVal === newVal) return null;
  return (
    <span className="text-sm">
      <span className="text-red-600">{oldVal ? 'Yes' : 'No'}</span>
      <span className="mx-1 text-sage-400">&rarr;</span>
      <span className="text-green-600">{newVal ? 'Yes' : 'No'}</span>
    </span>
  );
}

function StringDiff({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) {
  if (oldVal === newVal) return null;
  return (
    <div className="text-sm">
      {oldVal && (
        <span className="text-red-600 line-through">{oldVal}</span>
      )}
      {oldVal && newVal && <span className="mx-1 text-sage-400">&rarr;</span>}
      {newVal && (
        <span className="text-green-600">{newVal}</span>
      )}
      {!oldVal && newVal && <span className="text-xs text-sage-400"> (added)</span>}
      {oldVal && !newVal && <span className="text-xs text-sage-400"> (removed)</span>}
    </div>
  );
}

export function MedicalHistoryDiff({ oldRecord, newRecord }: MedicalHistoryDiffProps) {
  const changedFields = FIELDS.filter((field) => {
    const oldVal = getFieldValue(oldRecord, field.key);
    const newVal = getFieldValue(newRecord, field.key);
    if (field.type === 'array') {
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    }
    return oldVal !== newVal;
  });

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-sage-900">Version {oldRecord.version}</h4>
          <p className="text-xs text-sage-500">{new Date(oldRecord.createdAt).toLocaleDateString()}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-sage-900">Version {newRecord.version}</h4>
          <p className="text-xs text-sage-500">{new Date(newRecord.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {changedFields.length === 0 ? (
        <p className="text-sm text-sage-500">No differences found.</p>
      ) : (
        <div className="space-y-4">
          {changedFields.map((field) => {
            const oldVal = getFieldValue(oldRecord, field.key);
            const newVal = getFieldValue(newRecord, field.key);

            return (
              <div key={field.key} className="border-t border-sage-100 pt-3">
                <p className="mb-1 text-xs font-medium text-sage-500">{field.label}</p>
                {field.type === 'array' && (
                  <ArrayDiff oldItems={oldVal} newItems={newVal} />
                )}
                {field.type === 'boolean' && (
                  <BooleanDiff oldVal={oldVal} newVal={newVal} />
                )}
                {field.type === 'string' && (
                  <StringDiff oldVal={oldVal} newVal={newVal} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
