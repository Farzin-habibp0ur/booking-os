'use client';

import { AuthProvider } from '@/lib/auth';
import { Shell } from '@/components/shell';

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
