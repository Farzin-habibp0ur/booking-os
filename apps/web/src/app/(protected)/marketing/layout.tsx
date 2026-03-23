'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Marketing pages have been moved to the admin app (admin.businesscommandcentre.com).
 * This layout redirects any remaining /marketing/* requests to /ai.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    router.push('/ai');
  }, [router]);

  return null;
}
