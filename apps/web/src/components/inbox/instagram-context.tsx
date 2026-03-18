'use client';

import { cn } from '@/lib/cn';
import { Instagram, Image, Megaphone, MessageCircle } from 'lucide-react';

interface InstagramContextProps {
  metadata: Record<string, any>;
  className?: string;
}

export function InstagramContext({ metadata, className }: InstagramContextProps) {
  if (!metadata) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {metadata.storyReplyUrl && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5">
          <Image size={12} className="text-purple-500 flex-shrink-0" />
          <span>Replied to your story</span>
        </div>
      )}
      {metadata.referral && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-lavender-50 rounded-lg px-2.5 py-1.5">
          <Megaphone size={12} className="text-lavender-500 flex-shrink-0" />
          <span>
            {metadata.referral.source === 'ADS'
              ? 'Came from an ad'
              : `Referral: ${metadata.referral.source || 'Instagram'}`}
          </span>
        </div>
      )}
      {metadata.postback && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-sage-50 rounded-lg px-2.5 py-1.5">
          <MessageCircle size={12} className="text-sage-500 flex-shrink-0" />
          <span>Ice breaker: {metadata.postback}</span>
        </div>
      )}
    </div>
  );
}

export function InstagramChannelBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700">
      <Instagram size={8} />
      IG
    </span>
  );
}
