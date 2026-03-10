'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { FormSkeleton } from '@/components/skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

interface IntakeFormData {
  fullName: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions: string;
  currentMedications: string;
  consentGiven: boolean;
  signatureName: string;
}

const INITIAL_FORM: IntakeFormData = {
  fullName: '',
  dateOfBirth: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  medicalConditions: '',
  currentMedications: '',
  consentGiven: false,
  signatureName: '',
};

export default function PortalIntakePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<IntakeFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({});

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }

    portalFetch('/portal/me')
      .then((prof) => {
        const prefs = prof.preferences || {};
        // Pre-fill name from profile
        setForm((prev) => ({
          ...prev,
          fullName: prof.name || '',
          // Restore previously saved intake data if it exists
          ...(prefs.intakeComplete
            ? {
                fullName: prefs.intakeFullName || prof.name || '',
                dateOfBirth: prefs.intakeDateOfBirth || '',
                emergencyContactName: prefs.intakeEmergencyContactName || '',
                emergencyContactPhone: prefs.intakeEmergencyContactPhone || '',
                medicalConditions: prefs.intakeMedicalConditions || '',
                currentMedications: prefs.intakeCurrentMedications || '',
                consentGiven: prefs.intakeConsentGiven || false,
                signatureName: prefs.intakeSignatureName || '',
              }
            : {}),
        }));
        if (prefs.intakeComplete) {
          setAlreadyComplete(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof IntakeFormData, string>> = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!form.emergencyContactName.trim())
      newErrors.emergencyContactName = 'Emergency contact name is required';
    if (!form.emergencyContactPhone.trim())
      newErrors.emergencyContactPhone = 'Emergency contact phone is required';
    if (!form.consentGiven) newErrors.consentGiven = 'You must provide consent to continue';
    if (!form.signatureName.trim()) newErrors.signatureName = 'Signature is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await portalFetch('/portal/me', {
        method: 'PATCH',
        body: JSON.stringify({
          customFields: {
            intakeComplete: true,
            intakeSubmittedAt: new Date().toISOString(),
            intakeFullName: form.fullName,
            intakeDateOfBirth: form.dateOfBirth,
            intakeEmergencyContactName: form.emergencyContactName,
            intakeEmergencyContactPhone: form.emergencyContactPhone,
            intakeMedicalConditions: form.medicalConditions,
            intakeCurrentMedications: form.currentMedications,
            intakeConsentGiven: form.consentGiven,
            intakeSignatureName: form.signatureName,
          },
        }),
      });
      setSubmitted(true);
      setAlreadyComplete(true);
      setEditing(false);
    } catch {
      // Error handled by portalFetch
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = (field: keyof IntakeFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (loading) {
    return <FormSkeleton rows={4} />;
  }

  // Success state after submission
  if (submitted && !editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/portal/${slug}/dashboard`)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Intake Form</h1>
        </div>
        <div
          className="bg-white rounded-2xl shadow-soft p-8 text-center"
          data-testid="success-state"
        >
          <div className="w-16 h-16 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-sage-600" />
          </div>
          <h2 className="text-xl font-serif font-semibold text-slate-900 mb-2">Thank you!</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your intake form has been submitted successfully.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push(`/portal/${slug}/dashboard`)}
              className="bg-sage-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
                setEditing(true);
              }}
              className="border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              data-testid="update-intake-btn"
            >
              Update Information
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Already complete state (returning visitor)
  if (alreadyComplete && !editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/portal/${slug}/dashboard`)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Intake Form</h1>
        </div>
        <div
          className="bg-white rounded-2xl shadow-soft p-8 text-center"
          data-testid="already-complete"
        >
          <div className="w-16 h-16 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-sage-600" />
          </div>
          <h2 className="text-xl font-serif font-semibold text-slate-900 mb-2">
            Your intake form is already on file
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            You can update your information at any time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push(`/portal/${slug}/dashboard`)}
              className="bg-sage-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => setEditing(true)}
              className="border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              data-testid="update-intake-btn"
            >
              Update Information
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Intake Form</h1>
      </div>

      {/* Progress indicator */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-3">
          <ClipboardList size={20} className="text-sage-600" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              {editing ? 'Update Your Information' : 'Complete Your Intake Form'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Please fill in all required fields before your first appointment.
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Personal Information */}
      <div className="bg-white rounded-2xl shadow-soft p-6" data-testid="intake-form">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
          Personal Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.fullName}
              onChange={(e) => handleUpdate('fullName', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="intake-fullName"
            />
            {errors.fullName && (
              <p className="text-xs text-red-600 mt-1" data-testid="error-fullName">
                {errors.fullName}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => handleUpdate('dateOfBirth', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="intake-dateOfBirth"
            />
            {errors.dateOfBirth && (
              <p className="text-xs text-red-600 mt-1" data-testid="error-dateOfBirth">
                {errors.dateOfBirth}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Emergency Contact */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">Emergency Contact</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contact Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.emergencyContactName}
              onChange={(e) => handleUpdate('emergencyContactName', e.target.value)}
              placeholder="Full name of emergency contact"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="intake-emergencyContactName"
            />
            {errors.emergencyContactName && (
              <p className="text-xs text-red-600 mt-1" data-testid="error-emergencyContactName">
                {errors.emergencyContactName}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contact Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.emergencyContactPhone}
              onChange={(e) => handleUpdate('emergencyContactPhone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="intake-emergencyContactPhone"
            />
            {errors.emergencyContactPhone && (
              <p className="text-xs text-red-600 mt-1" data-testid="error-emergencyContactPhone">
                {errors.emergencyContactPhone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Medical History */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">Medical History</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Medical Conditions / Allergies
            </label>
            <textarea
              value={form.medicalConditions}
              onChange={(e) => handleUpdate('medicalConditions', e.target.value)}
              placeholder="List any known medical conditions, allergies, or sensitivities..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
              data-testid="intake-medicalConditions"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Medications
            </label>
            <textarea
              value={form.currentMedications}
              onChange={(e) => handleUpdate('currentMedications', e.target.value)}
              placeholder="List any medications you are currently taking..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
              data-testid="intake-currentMedications"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Consent & Signature */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
          Consent & Signature
        </h2>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              I consent to the services provided and understand the policies of this business. I
              acknowledge that the information provided is accurate and complete to the best of my
              knowledge. I understand that withholding information may affect the quality of
              services received.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate('consentGiven', !form.consentGiven)}
            className="flex items-start gap-3 cursor-pointer text-left"
            data-testid="intake-consentGiven"
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${form.consentGiven ? 'bg-sage-600 border-sage-600 text-white' : 'border-slate-300 bg-white'}`}
              aria-hidden="true"
            >
              {form.consentGiven && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="text-sm text-slate-700">
              I have read and agree to the above consent statement{' '}
              <span className="text-red-500">*</span>
            </span>
          </button>
          {errors.consentGiven && (
            <p className="text-xs text-red-600" data-testid="error-consentGiven">
              {errors.consentGiven}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Signature (Type your full name) <span className="text-red-500">*</span>
            </label>
            <input
              value={form.signatureName}
              onChange={(e) => handleUpdate('signatureName', e.target.value)}
              placeholder="Type your full legal name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm italic focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="intake-signatureName"
            />
            {errors.signatureName && (
              <p className="text-xs text-red-600 mt-1" data-testid="error-signatureName">
                {errors.signatureName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-sage-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          data-testid="submit-intake-btn"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Submitting...' : editing ? 'Update Intake Form' : 'Submit Intake Form'}
        </button>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
