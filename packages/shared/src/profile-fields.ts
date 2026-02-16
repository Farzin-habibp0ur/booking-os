export interface ProfileFieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'boolean' | 'select';
  category: 'basic' | 'medical' | 'custom';
  options?: string[];
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'firstName', label: 'First Name', type: 'text', category: 'basic' },
  { key: 'lastName', label: 'Last Name', type: 'text', category: 'basic' },
  { key: 'email', label: 'Email Address', type: 'email', category: 'basic' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', category: 'basic' },
  { key: 'address', label: 'Address', type: 'text', category: 'basic' },
  { key: 'allergies', label: 'Allergies', type: 'text', category: 'medical' },
  { key: 'medicalNotes', label: 'Medical Notes', type: 'text', category: 'medical' },
  { key: 'emergencyContact', label: 'Emergency Contact', type: 'text', category: 'medical' },
];

export function checkProfileCompleteness(
  customer: { name: string; email?: string | null; customFields?: Record<string, any> },
  requiredKeys: string[],
): { complete: boolean; missingFields: ProfileFieldDef[] } {
  const missingFields: ProfileFieldDef[] = [];

  for (const key of requiredKeys) {
    const fieldDef = PROFILE_FIELDS.find((f) => f.key === key);
    if (!fieldDef) continue;

    let hasValue = false;

    if (key === 'firstName') {
      const parts = (customer.name || '').trim().split(/\s+/);
      hasValue = parts.length > 0 && parts[0].length > 0;
    } else if (key === 'lastName') {
      const parts = (customer.name || '').trim().split(/\s+/);
      hasValue = parts.length > 1 && parts[parts.length - 1].length > 0;
    } else if (key === 'email') {
      hasValue = !!customer.email;
    } else {
      hasValue = !!customer.customFields?.[key];
    }

    if (!hasValue) {
      missingFields.push(fieldDef);
    }
  }

  return { complete: missingFields.length === 0, missingFields };
}

export function checkIntakeCompleteness(
  customer: { customFields?: Record<string, any> },
  fields: Array<{ key: string; label: string }>,
): { filled: number; total: number; missing: string[] } {
  const total = fields.length;
  const missing: string[] = [];

  for (const field of fields) {
    const value = customer.customFields?.[field.key];
    // boolean false counts as filled; only undefined/null/'' are missing
    if (value === undefined || value === null || value === '') {
      missing.push(field.key);
    }
  }

  return { filled: total - missing.length, total, missing };
}
