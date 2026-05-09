'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Send } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const SUCCESS_MESSAGE = "Thanks. We'll review your clinic and reply within 2 business days.";
const INPUT_CLASS =
  'w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500';

const CHANNEL_OPTIONS = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WEB_CHAT', label: 'Website chat' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'OTHER', label: 'Other' },
];

const LEAD_VOLUME_OPTIONS = [
  { value: 'UNDER_50', label: 'Under 50/month' },
  { value: '50_150', label: '50-150/month' },
  { value: '150_500', label: '150-500/month' },
  { value: '500_PLUS', label: '500+/month' },
  { value: 'UNKNOWN', label: 'Not sure yet' },
];

type FormState = {
  clinicName: string;
  contactName: string;
  email: string;
  phone: string;
  websiteOrInstagram: string;
  countryTimezone: string;
  monthlyLeadVolume: string;
  currentChannels: string[];
  biggestFrontDeskPain: string;
  consent: boolean;
  company: string;
};

const initialState: FormState = {
  clinicName: '',
  contactName: '',
  email: '',
  phone: '',
  websiteOrInstagram: '',
  countryTimezone: '',
  monthlyLeadVolume: '',
  currentChannels: [],
  biggestFrontDeskPain: '',
  consent: false,
  company: '',
};

export default function PilotApplicationForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [startedAt, setStartedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setStartedAt(new Date().toISOString());
  }, []);

  const utm = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
    };
  }, []);

  const update = (key: keyof FormState, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (value: string) => {
    setForm((prev) => ({
      ...prev,
      currentChannels: prev.currentChannels.includes(value)
        ? prev.currentChannels.filter((channel) => channel !== value)
        : [...prev.currentChannels, value],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/pilot-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startedAt,
          monthlyLeadVolume: form.monthlyLeadVolume || undefined,
          phone: form.phone || undefined,
          websiteOrInstagram: form.websiteOrInstagram || undefined,
          countryTimezone: form.countryTimezone || undefined,
          ...utm,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Unable to submit application');
      }

      setSuccess(true);
      setForm(initialState);
    } catch (err: any) {
      setError(err.message || 'Unable to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft">
        <CheckCircle className="mx-auto h-12 w-12 text-sage-600" />
        <h2 className="mt-4 font-serif text-2xl font-bold text-slate-900">Application received</h2>
        <p className="mt-3 text-slate-500">{SUCCESS_MESSAGE}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-soft sm:p-8">
      {error && <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic name">
          <input
            value={form.clinicName}
            onChange={(e) => update('clinicName', e.target.value)}
            required
            minLength={2}
            maxLength={120}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Owner/contact name">
          <input
            value={form.contactName}
            onChange={(e) => update('contactName', e.target.value)}
            required
            minLength={2}
            maxLength={120}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
            maxLength={160}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            maxLength={40}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Website or Instagram">
          <input
            value={form.websiteOrInstagram}
            onChange={(e) => update('websiteOrInstagram', e.target.value)}
            maxLength={240}
            placeholder="@clinic or https://..."
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Country / timezone">
          <input
            value={form.countryTimezone}
            onChange={(e) => update('countryTimezone', e.target.value)}
            maxLength={120}
            placeholder="Canada / Pacific"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="Monthly lead volume" className="mt-4">
        <select
          value={form.monthlyLeadVolume}
          onChange={(e) => update('monthlyLeadVolume', e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Select a range</option>
          {LEAD_VOLUME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-slate-700">Current channels</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((option) => {
            const selected = form.currentChannels.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleChannel(option.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-sage-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Biggest front desk pain" className="mt-5">
        <textarea
          value={form.biggestFrontDeskPain}
          onChange={(e) => update('biggestFrontDeskPain', e.target.value)}
          required
          minLength={10}
          maxLength={1000}
          rows={5}
          placeholder="Example: Instagram leads get missed after hours, consult quotes need manual follow-up, and cancelled slots are hard to refill."
          className={`${INPUT_CLASS} resize-none`}
        />
      </Field>

      <input
        tabIndex={-1}
        autoComplete="off"
        value={form.company}
        onChange={(e) => update('company', e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <label className="mt-5 flex items-start gap-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => update('consent', e.target.checked)}
          required
          className="mt-1 h-4 w-4 rounded border-slate-300 text-sage-600 focus:ring-sage-500"
        />
        <span>
          I agree to be contacted about the Business Command Centre pilot and understand this is not
          medical software or clinical decision support.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="btn-press mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sage-700 disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit application'}
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
