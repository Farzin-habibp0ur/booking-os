'use client';

import { useState, useEffect } from 'react';
import { Award, Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { apiFetch } from '@/lib/api';

interface Certification {
  id: string;
  name: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentUrl: string | null;
  isVerified: boolean;
}

interface CertificationManagerProps {
  staffId: string;
  staffName: string;
}

export default function CertificationManager({ staffId, staffName }: CertificationManagerProps) {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const loadCerts = () => {
    setLoading(true);
    apiFetch(`/staff/${staffId}/certifications`)
      .then((data: Certification[]) => setCerts(Array.isArray(data) ? data : []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCerts();
  }, [staffId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/staff/${staffId}/certifications`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          issuedBy: issuedBy || undefined,
          issuedDate: issuedDate || undefined,
          expiryDate: expiryDate || undefined,
        }),
      });
      setName('');
      setIssuedBy('');
      setIssuedDate('');
      setExpiryDate('');
      setShowForm(false);
      loadCerts();
    } catch (err: any) {
      setError(err.message || 'Failed to add certification');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (certId: string) => {
    try {
      await apiFetch(`/staff/${staffId}/certifications/${certId}`, { method: 'DELETE' });
      loadCerts();
    } catch {
      // silently ignore
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    const daysLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 30;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5" data-testid="certification-manager">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-sage-600" />
          <h3 className="text-sm font-semibold text-slate-900">Certifications — {staffName}</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-slate-50 rounded-xl p-4 mb-4" data-testid="cert-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Certification Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. RMT, Yoga 200hr"
                className="w-full px-3 py-2 text-sm bg-white border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Issued By</label>
              <input
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="e.g. College of Massage Therapists"
                className="w-full px-3 py-2 text-sm bg-white border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Issued Date</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Certification'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError('');
              }}
              className="px-4 py-2 text-sm border rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Certifications list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">No certifications yet</p>
      ) : (
        <div className="space-y-2">
          {certs.map((cert) => (
            <div
              key={cert.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-xl border',
                isExpired(cert.expiryDate)
                  ? 'border-red-200 bg-red-50'
                  : isExpiringSoon(cert.expiryDate)
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-100',
              )}
              data-testid="cert-item"
            >
              <div className="flex items-center gap-2">
                <Award
                  size={14}
                  className={cn(
                    isExpired(cert.expiryDate)
                      ? 'text-red-500'
                      : isExpiringSoon(cert.expiryDate)
                        ? 'text-amber-500'
                        : 'text-sage-500',
                  )}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">{cert.name}</span>
                    {cert.isVerified && (
                      <span className="text-[10px] bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded-full">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {cert.issuedBy && <span>{cert.issuedBy}</span>}
                    {cert.expiryDate && (
                      <span
                        className={cn(
                          isExpired(cert.expiryDate) && 'text-red-600',
                          isExpiringSoon(cert.expiryDate) && 'text-amber-600',
                        )}
                      >
                        {isExpired(cert.expiryDate)
                          ? 'Expired'
                          : isExpiringSoon(cert.expiryDate)
                            ? 'Expiring soon'
                            : `Expires ${new Date(cert.expiryDate).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemove(cert.id)}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                aria-label="Remove certification"
              >
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
