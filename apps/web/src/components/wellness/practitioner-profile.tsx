'use client';

import { Award, Clock, Briefcase } from 'lucide-react';
import { cn } from '@/lib/cn';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Certification {
  id: string;
  name: string;
  issuedBy?: string;
  expiryDate?: string;
  isVerified: boolean;
}

interface WorkingHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOff: boolean;
}

interface PractitionerProfileProps {
  name: string;
  specialties: { id: string; name: string; category?: string }[];
  certifications: Certification[];
  workingHours: WorkingHour[];
}

export default function PractitionerProfile({
  name,
  specialties,
  certifications,
  workingHours,
}: PractitionerProfileProps) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5" data-testid="practitioner-profile">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-sage-50 rounded-full flex items-center justify-center">
          <span className="text-lg font-serif font-semibold text-sage-700">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h3 className="text-base font-serif font-semibold text-slate-900">{name}</h3>
          <p className="text-xs text-slate-500">
            {specialties.length} {specialties.length === 1 ? 'specialty' : 'specialties'}
          </p>
        </div>
      </div>

      {/* Specialties */}
      {specialties.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Services
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <span
                key={s.id}
                className="text-xs px-2 py-0.5 bg-sage-50 text-sage-700 rounded-full"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Award size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Certifications
            </span>
          </div>
          <div className="space-y-1.5">
            {certifications.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-xs"
                data-testid="certification-item"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800">{c.name}</span>
                  {c.isVerified && (
                    <span className="text-sage-600 text-[10px] bg-sage-50 px-1.5 py-0.5 rounded-full">
                      Verified
                    </span>
                  )}
                </div>
                {c.issuedBy && <span className="text-slate-400">{c.issuedBy}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Availability */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
            Weekly Availability
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((day, i) => {
            const wh = workingHours.find((h) => h.dayOfWeek === i);
            const isWorking = wh && !wh.isOff;
            return (
              <div
                key={day}
                className={cn(
                  'text-center py-1.5 rounded-lg text-xs',
                  isWorking ? 'bg-sage-50 text-sage-700' : 'bg-slate-50 text-slate-400',
                )}
                data-testid={`day-${day}`}
              >
                <div className="font-medium">{day}</div>
                {isWorking && (
                  <div className="text-[10px] mt-0.5">
                    {wh!.startTime}-{wh!.endTime}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
