'use client';

import { AuthProvider } from '@/lib/auth';
import { Shell } from '@/components/shell';

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
