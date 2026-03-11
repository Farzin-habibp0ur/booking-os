'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FolderOpen, FileText, ClipboardList, Calendar, User, Loader2 } from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

interface IntakeData {
  submittedAt?: string;
  fullName?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string;
  medications?: string;
}

interface BookingNote {
  id: string;
  date: string;
  service: string;
  staff: string | null;
  notes: string;
}

interface DocumentsResponse {
  intake: IntakeData | null;
  bookingNotes: BookingNote[];
}

export default function PortalDocumentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }
    portalFetch('/portal/documents')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-semibold text-slate-900">My Documents</h1>

      {/* Intake form data */}
      <section>
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <ClipboardList size={18} className="text-sage-600" />
          Intake Form
        </h2>
        {data?.intake ? (
          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.intake.fullName && (
                <div>
                  <p className="text-xs text-slate-500">Full Name</p>
                  <p className="text-sm font-medium text-slate-900">{data.intake.fullName}</p>
                </div>
              )}
              {data.intake.dateOfBirth && (
                <div>
                  <p className="text-xs text-slate-500">Date of Birth</p>
                  <p className="text-sm font-medium text-slate-900">{data.intake.dateOfBirth}</p>
                </div>
              )}
              {data.intake.emergencyContactName && (
                <div>
                  <p className="text-xs text-slate-500">Emergency Contact</p>
                  <p className="text-sm font-medium text-slate-900">
                    {data.intake.emergencyContactName}
                    {data.intake.emergencyContactPhone && ` · ${data.intake.emergencyContactPhone}`}
                  </p>
                </div>
              )}
              {data.intake.medicalConditions && (
                <div>
                  <p className="text-xs text-slate-500">Medical Conditions</p>
                  <p className="text-sm font-medium text-slate-900">{data.intake.medicalConditions}</p>
                </div>
              )}
              {data.intake.medications && (
                <div>
                  <p className="text-xs text-slate-500">Current Medications</p>
                  <p className="text-sm font-medium text-slate-900">{data.intake.medications}</p>
                </div>
              )}
            </div>
            {data.intake.submittedAt && (
              <p className="text-xs text-slate-400 pt-2 border-t">
                Submitted{' '}
                {new Date(data.intake.submittedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-soft p-6 text-center">
            <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No intake form on file</p>
            <button
              onClick={() => router.push(`/portal/${slug}/intake`)}
              className="mt-3 px-4 py-2 bg-sage-600 text-white text-sm rounded-xl hover:bg-sage-700 transition-colors"
            >
              Complete Intake Form
            </button>
          </div>
        )}
      </section>

      {/* Booking notes / visit summaries */}
      <section>
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <FileText size={18} className="text-lavender-600" />
          Visit Notes
        </h2>
        {data?.bookingNotes && data.bookingNotes.length > 0 ? (
          <div className="space-y-3">
            {data.bookingNotes.map((note) => (
              <div key={note.id} className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={12} />
                    {new Date(note.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-xs font-medium text-slate-700">{note.service}</span>
                  {note.staff && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <User size={12} />
                      {note.staff}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-line">{note.notes}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-soft p-6 text-center">
            <FolderOpen size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No visit notes yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Notes from completed appointments will appear here
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
