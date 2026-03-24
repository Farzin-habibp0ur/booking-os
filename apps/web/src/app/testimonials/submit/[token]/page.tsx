'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function TestimonialSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'form' | 'submitted' | 'error' | 'already'>('loading');
  const [info, setInfo] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    fetch(`${apiUrl}/testimonials/public/verify/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('invalid');
        return res.json();
      })
      .then((data) => {
        if (data.alreadySubmitted) {
          setStatus('already');
        } else {
          setInfo(data);
          setName(data.customerName || '');
          setStatus('form');
        }
      })
      .catch(() => setStatus('error'));
  }, [token, apiUrl]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (content.length < 20) {
      setError('Please write at least 20 characters');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/testimonials/public/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, content, rating, name: name || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Submission failed');
      }
      setStatus('submitted');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFCFD] px-4 py-12">
      <div className="max-w-lg w-full">
        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-soft p-8 text-center animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto mb-4" />
            <div className="h-4 bg-slate-100 rounded w-64 mx-auto" />
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">Invalid Link</h1>
            <p className="text-sm text-slate-500">This review link is invalid or has expired.</p>
          </div>
        )}

        {status === 'already' && (
          <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
            <div className="w-12 h-12 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-sage-600" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
              Already Submitted
            </h1>
            <p className="text-sm text-slate-500">
              You&apos;ve already submitted a review. Thank you!
            </p>
          </div>
        )}

        {status === 'submitted' && (
          <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
            <div className="w-12 h-12 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-sage-600" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">Thank You!</h1>
            <p className="text-sm text-slate-500">
              Your review has been submitted and is pending approval.
            </p>
          </div>
        )}

        {status === 'form' && (
          <div className="bg-white rounded-2xl shadow-soft p-8">
            <h1 className="text-xl font-serif font-semibold text-slate-900 text-center mb-1">
              Share Your Experience
            </h1>
            {info?.businessName && (
              <p className="text-sm text-slate-500 text-center mb-6">
                with {info.businessName}
              </p>
            )}

            {/* Star rating */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 block mb-2">
                How would you rate your experience?
              </label>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={cn(
                        'transition-colors',
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Tell us about your experience
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What did you enjoy most? How was the service?"
                rows={5}
                maxLength={5000}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{content.length}/5000 characters</p>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Your name (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-4 py-3 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
