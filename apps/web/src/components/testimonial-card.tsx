'use client';

import { Star, Quote, Check, X, Sparkles, Pencil, Trash2 } from 'lucide-react';

export interface Testimonial {
  id: string;
  name: string;
  role?: string | null;
  company?: string | null;
  content: string;
  rating?: number | null;
  status: string;
  avatarUrl?: string | null;
  createdAt: string;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onFeature?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  APPROVED: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  FEATURED: { bg: 'bg-lavender-50', text: 'text-lavender-700', label: 'Featured' },
};

export function TestimonialCard({
  testimonial,
  onApprove,
  onReject,
  onFeature,
  onEdit,
  onDelete,
  showActions = true,
}: TestimonialCardProps) {
  const badge = STATUS_BADGES[testimonial.status] || STATUS_BADGES.PENDING;
  const isFeatured = testimonial.status === 'FEATURED';
  const truncated =
    testimonial.content.length > 150
      ? testimonial.content.slice(0, 150) + '...'
      : testimonial.content;

  return (
    <div
      data-testid={`testimonial-card-${testimonial.id}`}
      className={`rounded-2xl shadow-soft p-5 bg-white ${
        isFeatured ? 'border-2 border-lavender-200 bg-lavender-50/30' : ''
      }`}
    >
      {/* Quote mark */}
      <Quote size={24} className="text-sage-200 mb-2" />

      {/* Content */}
      <p className="text-sm text-slate-700 mb-3" data-testid="testimonial-content">
        {truncated}
      </p>

      {/* Rating */}
      {testimonial.rating && (
        <div className="flex gap-0.5 mb-3" data-testid="testimonial-rating">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              className={
                i < testimonial.rating! ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
              }
            />
          ))}
        </div>
      )}

      {/* Author */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{testimonial.name}</p>
          {(testimonial.role || testimonial.company) && (
            <p className="text-xs text-slate-500">
              {[testimonial.role, testimonial.company].filter(Boolean).join(' at ')}
            </p>
          )}
        </div>
        {showActions && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          {testimonial.status !== 'APPROVED' && testimonial.status !== 'FEATURED' && onApprove && (
            <button
              onClick={() => onApprove(testimonial.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors"
              data-testid="btn-approve"
            >
              <Check size={12} /> Approve
            </button>
          )}
          {testimonial.status !== 'REJECTED' && onReject && (
            <button
              onClick={() => onReject(testimonial.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              data-testid="btn-reject"
            >
              <X size={12} /> Reject
            </button>
          )}
          {testimonial.status !== 'FEATURED' && onFeature && (
            <button
              onClick={() => onFeature(testimonial.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-lavender-50 text-lavender-700 hover:bg-lavender-100 transition-colors"
              data-testid="btn-feature"
            >
              <Sparkles size={12} /> Feature
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(testimonial.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              data-testid="btn-edit"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(testimonial.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              data-testid="btn-delete"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
