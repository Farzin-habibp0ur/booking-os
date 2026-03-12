'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface SessionInput {
  serviceId: string;
  sequenceOrder: number;
  scheduledDate: string;
  notes: string;
}

interface TreatmentPlanBuilderProps {
  services: Array<{ id: string; name: string; price: number; durationMins: number; kind: string }>;
  initialData?: {
    diagnosis?: string;
    goals?: string;
    contraindications?: string;
    totalEstimate?: number;
    notes?: string;
    sessions?: SessionInput[];
  };
  onSubmit: (data: {
    diagnosis: string;
    goals: string;
    contraindications: string;
    totalEstimate: number;
    notes: string;
    sessions: SessionInput[];
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function TreatmentPlanBuilder({
  services,
  initialData,
  onSubmit,
  onCancel,
  loading,
}: TreatmentPlanBuilderProps) {
  const treatmentServices = services.filter((s) => s.kind === 'TREATMENT');

  const [diagnosis, setDiagnosis] = useState(initialData?.diagnosis || '');
  const [goals, setGoals] = useState(initialData?.goals || '');
  const [contraindications, setContraindications] = useState(initialData?.contraindications || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [sessions, setSessions] = useState<SessionInput[]>(
    initialData?.sessions || [{ serviceId: '', sequenceOrder: 1, scheduledDate: '', notes: '' }],
  );

  const totalEstimate = sessions.reduce((sum, s) => {
    const service = services.find((svc) => svc.id === s.serviceId);
    return sum + (service?.price || 0);
  }, 0);

  const addSession = () => {
    setSessions([
      ...sessions,
      {
        serviceId: '',
        sequenceOrder: sessions.length + 1,
        scheduledDate: '',
        notes: '',
      },
    ]);
  };

  const removeSession = (index: number) => {
    const updated = sessions
      .filter((_, i) => i !== index)
      .map((s, i) => ({
        ...s,
        sequenceOrder: i + 1,
      }));
    setSessions(updated);
  };

  const updateSession = (index: number, field: keyof SessionInput, value: string | number) => {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validSessions = sessions.filter((s) => s.serviceId);
    onSubmit({
      diagnosis,
      goals,
      contraindications,
      totalEstimate,
      notes,
      sessions: validSessions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="treatment-plan-builder">
      {/* Clinical Notes */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Clinical Assessment
        </h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
            placeholder="Clinical notes from consultation..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Patient Goals</label>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
            placeholder="What the patient hopes to achieve..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraindications</label>
          <textarea
            value={contraindications}
            onChange={(e) => setContraindications(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
            placeholder="Any flagged issues or contraindications..."
          />
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
            Treatment Sessions
          </h3>
          <button
            type="button"
            onClick={addSession}
            className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 font-medium"
          >
            <Plus size={14} />
            Add Session
          </button>
        </div>

        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div
              key={index}
              className="bg-slate-50 rounded-xl p-4 space-y-3"
              data-testid={`session-${index}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">
                    Session {session.sequenceOrder}
                  </span>
                </div>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSession(index)}
                    className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Treatment</label>
                  <select
                    value={session.serviceId}
                    onChange={(e) => updateSession(index, 'serviceId', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border-transparent focus:ring-2 focus:ring-sage-500 rounded-xl"
                    aria-label={`Service for session ${index + 1}`}
                  >
                    <option value="">Select treatment...</option>
                    {treatmentServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — ${s.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    value={session.scheduledDate}
                    onChange={(e) => updateSession(index, 'scheduledDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border-transparent focus:ring-2 focus:ring-sage-500 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Session Notes</label>
                <input
                  type="text"
                  value={session.notes}
                  onChange={(e) => updateSession(index, 'notes', e.target.value)}
                  placeholder="Optional notes for this session..."
                  className="w-full px-3 py-2 text-sm bg-white border-transparent focus:ring-2 focus:ring-sage-500 rounded-xl"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
          placeholder="Any additional notes..."
        />
      </div>

      {/* Estimate */}
      <div className="bg-sage-50 rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-sage-900">Total Estimate</span>
        <span className="text-lg font-serif font-semibold text-sage-900">
          ${totalEstimate.toFixed(2)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 text-sm border rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || sessions.every((s) => !s.serviceId)}
          className="flex-1 px-4 py-2.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Treatment Plan'}
        </button>
      </div>
    </form>
  );
}
