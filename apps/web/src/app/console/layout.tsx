'use client';

import { AuthProvider } from '@/lib/auth';
import { ConsoleShell } from '@/components/console-shell';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </AuthProvider>
  );
}
