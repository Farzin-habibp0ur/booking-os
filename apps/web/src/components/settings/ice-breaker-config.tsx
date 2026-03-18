'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { MessageCircle, Plus, Trash2, Save, Loader2 } from 'lucide-react';

interface IceBreakerPrompt {
  question: string;
  payload: string;
}

interface IceBreakerConfigProps {
  locationId: string;
  initialPrompts?: IceBreakerPrompt[];
}

export function IceBreakerConfig({ locationId, initialPrompts = [] }: IceBreakerConfigProps) {
  const [prompts, setPrompts] = useState<IceBreakerPrompt[]>(
    initialPrompts.length > 0
      ? initialPrompts
      : [{ question: '', payload: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addPrompt() {
    if (prompts.length >= 4) return;
    setPrompts([...prompts, { question: '', payload: '' }]);
  }

  function removePrompt(index: number) {
    setPrompts(prompts.filter((_, i) => i !== index));
  }

  function updatePrompt(index: number, field: 'question' | 'payload', value: string) {
    const updated = [...prompts];
    updated[index] = { ...updated[index], [field]: value };
    setPrompts(updated);
    setSaved(false);
  }

  async function handleSave() {
    const validPrompts = prompts.filter((p) => p.question.trim());
    if (validPrompts.length === 0) return;

    setSaving(true);
    try {
      await api.post(`/instagram-auth/${locationId}/ice-breakers`, {
        prompts: validPrompts.map((p) => ({
          question: p.question.trim(),
          payload: p.payload.trim() || p.question.trim().toLowerCase().replace(/\s+/g, '_'),
        })),
      });
      setSaved(true);
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-6 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={18} className="text-slate-600" />
        <h3 className="font-medium text-slate-900">Ice Breaker Prompts</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Ice breakers appear when a customer opens a conversation with you for the first
        time. Add up to 4 quick-tap prompts.
      </p>

      <div className="space-y-3">
        {prompts.map((prompt, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={prompt.question}
                onChange={(e) => updatePrompt(index, 'question', e.target.value)}
                placeholder={`e.g. "Book an appointment"`}
                maxLength={80}
                className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            {prompts.length > 1 && (
              <button
                onClick={() => removePrompt(index)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4">
        {prompts.length < 4 && (
          <button
            onClick={addPrompt}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-sage-600 hover:bg-sage-50 transition-colors"
          >
            <Plus size={14} />
            Add Prompt
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors ml-auto"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved' : 'Save Ice Breakers'}
        </button>
      </div>
    </div>
  );
}
