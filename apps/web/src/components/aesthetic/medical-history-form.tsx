'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { Loader2, Plus, X, AlertTriangle, ShieldCheck } from 'lucide-react';

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

interface MedicalHistoryFormProps {
  customerId: string;
  existingRecord?: MedicalRecord | null;
  onSaved?: (record: MedicalRecord) => void;
  onCancel?: () => void;
}

const FITZPATRICK_OPTIONS = [
  { value: 'I', label: 'I — Very fair, always burns' },
  { value: 'II', label: 'II — Fair, usually burns' },
  { value: 'III', label: 'III — Medium, sometimes burns' },
  { value: 'IV', label: 'IV — Olive, rarely burns' },
  { value: 'V', label: 'V — Brown, very rarely burns' },
  { value: 'VI', label: 'VI — Dark brown/black, never burns' },
];

function TagInput({
  label,
  items,
  onAdd,
  onRemove,
  inputValue,
  onInputChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  placeholder?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdd();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-sage-700">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-sage-200 px-3 py-2 text-sm focus:border-sage-400 focus:outline-none focus:ring-1 focus:ring-sage-400"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!inputValue.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-sage-100 px-3 py-2 text-sm font-medium text-sage-700 hover:bg-sage-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-sm text-sage-700"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-full p-0.5 hover:bg-sage-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MedicalHistoryForm({
  customerId,
  existingRecord,
  onSaved,
  onCancel,
}: MedicalHistoryFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Array field states
  const [allergies, setAllergies] = useState<string[]>(existingRecord?.allergies ?? []);
  const [allergyInput, setAllergyInput] = useState('');
  const [contraindications, setContraindications] = useState<string[]>(existingRecord?.contraindications ?? []);
  const [contraindicationInput, setContraindicationInput] = useState('');
  const [medications, setMedications] = useState<string[]>(existingRecord?.medications ?? []);
  const [medicationInput, setMedicationInput] = useState('');
  const [conditions, setConditions] = useState<string[]>(existingRecord?.conditions ?? []);
  const [conditionInput, setConditionInput] = useState('');

  // Skin assessment
  const [skinType, setSkinType] = useState(existingRecord?.skinType ?? '');
  const [fitzpatrickScale, setFitzpatrickScale] = useState(existingRecord?.fitzpatrickScale ?? '');

  // Safety flags
  const [bloodThinners, setBloodThinners] = useState(existingRecord?.bloodThinners ?? false);
  const [pregnant, setPregnant] = useState(existingRecord?.pregnant ?? false);
  const [breastfeeding, setBreastfeeding] = useState(existingRecord?.breastfeeding ?? false);
  const [recentSurgery, setRecentSurgery] = useState(existingRecord?.recentSurgery ?? '');

  // Notes & consent
  const [notes, setNotes] = useState(existingRecord?.notes ?? '');
  const [consentGiven, setConsentGiven] = useState(existingRecord?.consentGiven ?? false);

  const addTag = (
    input: string,
    setInput: (v: string) => void,
    items: string[],
    setItems: (v: string[]) => void,
  ) => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
      setInput('');
    }
  };

  const removeTag = (items: string[], setItems: (v: string[]) => void, index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        customerId,
        allergies,
        contraindications,
        medications,
        conditions,
        skinType: skinType || null,
        fitzpatrickScale: fitzpatrickScale || null,
        bloodThinners,
        pregnant,
        breastfeeding,
        recentSurgery: recentSurgery || null,
        notes: notes || null,
        consentGiven,
      };

      const { data } = await api.post('/medical-records', payload);
      toast({ title: 'Medical record saved', variant: 'success' });
      onSaved?.(data);
    } catch (err: any) {
      toast({
        title: 'Failed to save medical record',
        description: err?.response?.data?.message ?? 'An error occurred',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Conditions & Allergies */}
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <h3 className="mb-4 text-lg font-semibold text-sage-900">Conditions &amp; Allergies</h3>
        <div className="space-y-5">
          <TagInput
            label="Allergies"
            items={allergies}
            onAdd={() => addTag(allergyInput, setAllergyInput, allergies, setAllergies)}
            onRemove={(i) => removeTag(allergies, setAllergies, i)}
            inputValue={allergyInput}
            onInputChange={setAllergyInput}
            placeholder="e.g. Lidocaine, Latex"
          />
          <TagInput
            label="Contraindications"
            items={contraindications}
            onAdd={() => addTag(contraindicationInput, setContraindicationInput, contraindications, setContraindications)}
            onRemove={(i) => removeTag(contraindications, setContraindications, i)}
            inputValue={contraindicationInput}
            onInputChange={setContraindicationInput}
            placeholder="e.g. Accutane within 6 months"
          />
          <TagInput
            label="Medical Conditions"
            items={conditions}
            onAdd={() => addTag(conditionInput, setConditionInput, conditions, setConditions)}
            onRemove={(i) => removeTag(conditions, setConditions, i)}
            inputValue={conditionInput}
            onInputChange={setConditionInput}
            placeholder="e.g. Diabetes, Keloid scarring"
          />
          <TagInput
            label="Current Medications"
            items={medications}
            onAdd={() => addTag(medicationInput, setMedicationInput, medications, setMedications)}
            onRemove={(i) => removeTag(medications, setMedications, i)}
            inputValue={medicationInput}
            onInputChange={setMedicationInput}
            placeholder="e.g. Retinol, Blood pressure medication"
          />
        </div>
      </section>

      {/* Section 2: Skin Assessment */}
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <h3 className="mb-4 text-lg font-semibold text-sage-900">Skin Assessment</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-sage-700">Skin Type</label>
            <input
              type="text"
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              placeholder="e.g. Oily, Dry, Combination"
              className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm focus:border-sage-400 focus:outline-none focus:ring-1 focus:ring-sage-400"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-sage-700">Fitzpatrick Scale</label>
            <select
              value={fitzpatrickScale}
              onChange={(e) => setFitzpatrickScale(e.target.value)}
              className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm focus:border-sage-400 focus:outline-none focus:ring-1 focus:ring-sage-400"
            >
              <option value="">Select scale...</option>
              {FITZPATRICK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 3: Safety Flags */}
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-sage-900">Safety Flags</h3>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <ToggleSwitch
              label="Blood thinners"
              checked={bloodThinners}
              onChange={setBloodThinners}
            />
            <ToggleSwitch
              label="Pregnant"
              checked={pregnant}
              onChange={setPregnant}
            />
            <ToggleSwitch
              label="Breastfeeding"
              checked={breastfeeding}
              onChange={setBreastfeeding}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-sage-700">Recent Surgery</label>
            <input
              type="text"
              value={recentSurgery}
              onChange={(e) => setRecentSurgery(e.target.value)}
              placeholder="e.g. Rhinoplasty, 3 months ago"
              className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm focus:border-sage-400 focus:outline-none focus:ring-1 focus:ring-sage-400"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Notes */}
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <h3 className="mb-4 text-lg font-semibold text-sage-900">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Additional notes about the patient's medical history..."
          className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm focus:border-sage-400 focus:outline-none focus:ring-1 focus:ring-sage-400"
        />
      </section>

      {/* Section 5: Consent */}
      <section className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-sage-600" />
          <h3 className="text-lg font-semibold text-sage-900">Consent</h3>
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-sage-300 text-sage-600 focus:ring-sage-500"
          />
          <span className="text-sm text-sage-700">
            I consent to the collection and storage of my medical information for treatment purposes.
          </span>
        </label>
        {existingRecord?.consentGiven && existingRecord.consentDate && (
          <p className="mt-2 text-xs text-sage-500">
            Consent given on {new Date(existingRecord.consentDate).toLocaleDateString()}
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-sage-200 px-5 py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {existingRecord ? 'Update Record' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-2',
          checked ? 'bg-amber-500' : 'bg-sage-200',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <span className="text-sm font-medium text-sage-700">{label}</span>
    </label>
  );
}
