'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Shell } from '@/components/shell';

function MarketingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/ai');
    }
  }, [user, router]);

  if (user?.role !== 'SUPER_ADMIN') return null;

  return <>{children}</>;
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>
        <MarketingGuard>{children}</MarketingGuard>
      </Shell>
    </AuthProvider>
  );
}
