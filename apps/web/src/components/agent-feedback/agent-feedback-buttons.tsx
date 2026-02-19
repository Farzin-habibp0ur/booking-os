'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface AgentFeedbackButtonsProps {
  actionCardId: string;
  existingRating?: string | null;
  onSubmit: (actionCardId: string, rating: string, comment?: string) => Promise<void>;
  compact?: boolean;
}

export function AgentFeedbackButtons({
  actionCardId,
  existingRating,
  onSubmit,
  compact,
}: AgentFeedbackButtonsProps) {
  const [rating, setRating] = useState<string | null>(existingRating || null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async (value: string) => {
    if (rating) return; // Already rated
    setSubmitting(true);
    try {
      await onSubmit(actionCardId, value);
      setRating(value);
      if (value === 'NOT_HELPFUL') setShowComment(true);
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(actionCardId, 'NOT_HELPFUL', comment);
      setShowComment(false);
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1" data-testid="feedback-buttons">
        <button
          onClick={() => handleRate('HELPFUL')}
          disabled={submitting || !!rating}
          className={`p-1 rounded-lg transition-colors ${
            rating === 'HELPFUL'
              ? 'bg-sage-100 text-sage-700'
              : 'text-slate-400 hover:text-sage-600 hover:bg-sage-50'
          }`}
          data-testid="helpful-btn"
          title="Helpful"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={() => handleRate('NOT_HELPFUL')}
          disabled={submitting || !!rating}
          className={`p-1 rounded-lg transition-colors ${
            rating === 'NOT_HELPFUL'
              ? 'bg-red-100 text-red-700'
              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
          }`}
          data-testid="not-helpful-btn"
          title="Not helpful"
        >
          <ThumbsDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div data-testid="feedback-buttons">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Was this helpful?</span>
        <button
          onClick={() => handleRate('HELPFUL')}
          disabled={submitting || !!rating}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            rating === 'HELPFUL'
              ? 'bg-sage-100 text-sage-700'
              : 'text-slate-500 hover:bg-sage-50 hover:text-sage-700'
          }`}
          data-testid="helpful-btn"
        >
          <ThumbsUp size={12} />
          Yes
        </button>
        <button
          onClick={() => handleRate('NOT_HELPFUL')}
          disabled={submitting || !!rating}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            rating === 'NOT_HELPFUL'
              ? 'bg-red-100 text-red-700'
              : 'text-slate-500 hover:bg-red-50 hover:text-red-700'
          }`}
          data-testid="not-helpful-btn"
        >
          <ThumbsDown size={12} />
          No
        </button>
      </div>

      {showComment && (
        <div className="mt-2 flex gap-2" data-testid="comment-section">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could be better?"
            className="flex-1 text-xs bg-slate-50 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-sage-500 focus:bg-white border-transparent"
            data-testid="comment-input"
          />
          <button
            onClick={handleCommentSubmit}
            disabled={submitting || !comment.trim()}
            className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800"
            data-testid="submit-comment"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
