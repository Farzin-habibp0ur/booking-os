'use client';

import { Check, CheckCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DeliveryStatusProps {
  status: string;
  className?: string;
}

export function DeliveryStatus({ status, className }: DeliveryStatusProps) {
  switch (status) {
    case 'SENT':
      return (
        <span
          className={cn('inline-flex items-center', className)}
          title="Sent"
          data-testid="delivery-sent"
        >
          <Check size={12} className="text-sage-300" />
        </span>
      );
    case 'DELIVERED':
      return (
        <span
          className={cn('inline-flex items-center', className)}
          title="Delivered"
          data-testid="delivery-delivered"
        >
          <CheckCheck size={12} className="text-sage-300" />
        </span>
      );
    case 'READ':
      return (
        <span
          className={cn('inline-flex items-center', className)}
          title="Read"
          data-testid="delivery-read"
        >
          <CheckCheck size={12} className="text-blue-400" />
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={cn('inline-flex items-center', className)}
          title="Failed"
          data-testid="delivery-failed"
        >
          <AlertCircle size={12} className="text-red-400" />
        </span>
      );
    default:
      return null;
  }
}
