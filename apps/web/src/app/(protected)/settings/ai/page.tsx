'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AISettingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ai/settings');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-slate-500 text-sm">Redirecting to AI Hub...</p>
    </div>
  );
}
